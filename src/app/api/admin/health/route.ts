import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { supabaseSelect } from "@/services/supabase/admin";

type StaffRole = "admin" | "moderator" | "support" | "client";

type HealthAlert = {
  code: string;
  level: "critical" | "high" | "medium";
  title: string;
  description: string;
};

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const role = String(row.role || raw.role || "client") as StaffRole;
  return { uid: decoded.uid, role };
}

function isManager(role: StaffRole) {
  return role === "admin" || role === "moderator";
}

function minutesSince(isoDate?: string | null) {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-health:get", max: 30, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const now = Date.now();
    const last24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const last1h = new Date(now - 60 * 60 * 1000).toISOString();

    const [profileProbe] = await supabaseSelect("profiles", { select: "uid", limit: 1 });
    const dbHealthy = Boolean(profileProbe);

    const billingEvents = await supabaseSelect("billing_events", {
      select: "action,event_type,provider,raw,created_at",
      order: "created_at.desc.nullslast",
      limit: 1000,
    });

    const apiMetrics = await supabaseSelect("api_request_metrics", {
      select: "status,duration_ms,created_at",
      order: "created_at.desc.nullslast",
      limit: 2000,
    });

    const profiles = await supabaseSelect("profiles", {
      select: "uid,payment_status,plan,raw",
      limit: 2000,
    });

    const latestWebhook = billingEvents.find((row) => String(row.provider || "").toLowerCase() === "mercadopago");
    const latestWebhookAt = typeof latestWebhook?.created_at === "string" ? latestWebhook.created_at : null;
    const webhookDelayMinutes = minutesSince(latestWebhookAt);
    const webhookFailures24h = billingEvents.filter((row) => {
      if (typeof row.created_at !== "string" || row.created_at < last24h) return false;
      if (String(row.provider || "").toLowerCase() !== "mercadopago") return false;
      const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const status = String(raw.status || "").toLowerCase();
      return status.includes("fail") || status === "rejected" || status === "invalid_signature";
    }).length;

    const failedPayments24h = billingEvents.filter((row) => {
      if (typeof row.created_at !== "string" || row.created_at < last24h) return false;
      const action = String(row.action || "").toLowerCase();
      const eventType = String(row.event_type || "").toLowerCase();
      const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const status = String(raw.status || "").toLowerCase();
      return (
        action.includes("fail") ||
        action.includes("rejected") ||
        eventType.includes("fail") ||
        status === "rejected" ||
        status === "cancelled"
      );
    }).length;

    const pendingRecoveryUsers = profiles.filter((row) => {
      const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const paymentStatus = String(row.payment_status || raw.paymentStatus || "").toLowerCase();
      const plan = String(row.plan || raw.plan || "free").toLowerCase();
      return (paymentStatus === "pending" || paymentStatus === "not_paid") && plan !== "free";
    }).length;

    const metricsLastHour = apiMetrics.filter(
      (row) => typeof row.created_at === "string" && row.created_at >= last1h
    );
    const apiErrors1h = metricsLastHour.filter((row) => Number(row.status || 0) >= 500).length;
    const apiAvgLatency1h =
      metricsLastHour.length === 0
        ? 0
        : Math.round(
            metricsLastHour.reduce((sum, row) => sum + Number(row.duration_ms || 0), 0) /
              metricsLastHour.length
          );

    const alerts: HealthAlert[] = [];

    if (!dbHealthy) {
      alerts.push({
        code: "db_unhealthy",
        level: "critical",
        title: "Banco indisponível",
        description: "Não foi possível validar leitura básica do banco.",
      });
    }
    if (webhookDelayMinutes !== null && webhookDelayMinutes > 120) {
      alerts.push({
        code: "webhook_delayed",
        level: "high",
        title: "Webhook possivelmente atrasado",
        description: `Ultimo evento Mercado Pago ha ${webhookDelayMinutes} minutos.`,
      });
    }
    if (failedPayments24h >= 10) {
      alerts.push({
        code: "payment_failures_high",
        level: "high",
        title: "Falhas de pagamento elevadas",
        description: `${failedPayments24h} falhas nas ultimas 24h.`,
      });
    }
    if (webhookFailures24h > 0) {
      alerts.push({
        code: "webhook_failures_detected",
        level: webhookFailures24h >= 5 ? "high" : "medium",
        title: "Falhas no processamento do webhook",
        description: `${webhookFailures24h} eventos com falha nas ultimas 24h.`,
      });
    }
    if (apiErrors1h >= 15) {
      alerts.push({
        code: "api_errors_high",
        level: "critical",
        title: "Erros de API elevados",
        description: `${apiErrors1h} erros 5xx na ultima hora.`,
      });
    }
    if (apiAvgLatency1h >= 1200) {
      alerts.push({
        code: "api_latency_high",
        level: "medium",
        title: "Latencia elevada",
        description: `Latencia media ${apiAvgLatency1h}ms na ultima hora.`,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        health: {
          dbHealthy,
          latestWebhookAt,
          webhookDelayMinutes,
          webhookFailures24h,
          failedPayments24h,
          pendingRecoveryUsers,
          apiErrors1h,
          apiAvgLatency1h,
          observability: {
            sentryConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
            upstashConfigured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
          },
        },
        alerts,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_health_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
