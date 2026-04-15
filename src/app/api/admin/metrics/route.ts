import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { requireAccessResource } from "@/lib/access-control/server";
import { supabaseSelect } from "@/services/supabase/admin";

type MetricsAlert = {
  code: string;
  level: "critical" | "high" | "medium";
  title: string;
  description: string;
  value?: number;
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-metrics:get", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await requireAccessResource(request, "admin.metrics.read", "read");

    const windowMinutes = Math.min(Math.max(Number(request.nextUrl.searchParams.get("windowMinutes") || "60"), 5), 1440);
    const cutoff = new Date(Date.now() - windowMinutes * 60_000).toISOString();
    const previousCutoff = new Date(Date.now() - windowMinutes * 2 * 60_000).toISOString();

    const rows = await supabaseSelect("api_request_metrics", {
      select: "route,method,status,duration_ms,created_at,error_code",
      order: "created_at.desc.nullslast",
      limit: 5000,
    });

    const inWindow = rows.filter((row) => typeof row.created_at === "string" && row.created_at >= cutoff);
    const previousWindow = rows.filter(
      (row) => typeof row.created_at === "string" && row.created_at >= previousCutoff && row.created_at < cutoff
    );
    const total = inWindow.length;
    const errors = inWindow.filter((row) => Number(row.status || 0) >= 500).length;
    const rateLimited = inWindow.filter((row) => Number(row.status || 0) === 429).length;
    const avgDurationMs =
      total === 0
        ? 0
        : Math.round(
            inWindow.reduce((sum, row) => sum + Number(row.duration_ms || 0), 0) / Math.max(total, 1)
          );

    const byRouteMap = new Map<string, { route: string; total: number; errors: number; rateLimited: number; avgDurationMs: number; _sumDuration: number }>();
    for (const row of inWindow) {
      const route = String(row.route || "unknown");
      const current = byRouteMap.get(route) || {
        route,
        total: 0,
        errors: 0,
        rateLimited: 0,
        avgDurationMs: 0,
        _sumDuration: 0,
      };
      current.total += 1;
      if (Number(row.status || 0) >= 500) current.errors += 1;
      if (Number(row.status || 0) === 429) current.rateLimited += 1;
      current._sumDuration += Number(row.duration_ms || 0);
      byRouteMap.set(route, current);
    }

    const byRoute = Array.from(byRouteMap.values())
      .map((item) => ({
        route: item.route,
        total: item.total,
        errors: item.errors,
        rateLimited: item.rateLimited,
        avgDurationMs: item.total > 0 ? Math.round(item._sumDuration / item.total) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12);

    const billingRows = await supabaseSelect("billing_events", {
      select: "id,event_type,raw,created_at",
      filters: { provider: "mercadopago" },
      order: "created_at.desc.nullslast",
      limit: 1000,
    });
    const billingCutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const paymentFailures24h = billingRows.filter((row) => {
      const createdAt = typeof row.created_at === "string" ? row.created_at : "";
      if (!createdAt || createdAt < billingCutoff24h) return false;
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      const targetPaymentStatus = String(raw.targetPaymentStatus || "").toLowerCase();
      return targetPaymentStatus === "not_paid" || targetPaymentStatus === "overdue" || targetPaymentStatus === "canceled";
    }).length;
    const delayedThresholdIso = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const webhookDelayedCount = billingRows.filter((row) => {
      const createdAt = typeof row.created_at === "string" ? row.created_at : "";
      if (!createdAt || createdAt > delayedThresholdIso) return false;
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      const status = String(raw.status || "").toLowerCase();
      return status === "accepted" || status === "pending" || status === "retry_failed" || status === "error";
    }).length;

    const alerts: MetricsAlert[] = [];
    const errorRatePct = total > 0 ? Number(((errors / total) * 100).toFixed(2)) : 0;
    const rateLimitedPct = total > 0 ? Number(((rateLimited / total) * 100).toFixed(2)) : 0;
    const previousTotal = previousWindow.length;
    const trafficDropPct =
      previousTotal > 0 ? Number((((previousTotal - total) / previousTotal) * 100).toFixed(2)) : 0;

    if (errorRatePct >= 10) {
      alerts.push({
        code: "error_rate_high",
        level: "critical",
        title: "Taxa de erro crítica",
        description: `A taxa de erro está em ${errorRatePct}% (acima de 10%).`,
        value: errorRatePct,
      });
    } else if (errorRatePct >= 5) {
      alerts.push({
        code: "error_rate_warning",
        level: "high",
        title: "Taxa de erro elevada",
        description: `A taxa de erro está em ${errorRatePct}% (acima de 5%).`,
        value: errorRatePct,
      });
    }

    if (rateLimitedPct >= 15) {
      alerts.push({
        code: "rate_limit_critical",
        level: "high",
        title: "Muitas respostas 429",
        description: `${rateLimitedPct}% das requisições foram limitadas por rate limit.`,
        value: rateLimitedPct,
      });
    } else if (rateLimitedPct >= 8) {
      alerts.push({
        code: "rate_limit_warning",
        level: "medium",
        title: "Aumento de respostas 429",
        description: `${rateLimitedPct}% das requisições foram limitadas.`,
        value: rateLimitedPct,
      });
    }

    if (avgDurationMs >= 1200) {
      alerts.push({
        code: "latency_critical",
        level: "high",
        title: "Latência alta",
        description: `Latência média de ${avgDurationMs}ms no período.`,
        value: avgDurationMs,
      });
    } else if (avgDurationMs >= 700) {
      alerts.push({
        code: "latency_warning",
        level: "medium",
        title: "Latência em atenção",
        description: `Latência média de ${avgDurationMs}ms.`,
        value: avgDurationMs,
      });
    }

    if (previousTotal >= 50 && trafficDropPct >= 40) {
      alerts.push({
        code: "traffic_drop",
        level: "medium",
        title: "Queda brusca de tráfego",
        description: `Volume caiu ${trafficDropPct}% em relação à janela anterior.`,
        value: trafficDropPct,
      });
    }

    if (paymentFailures24h > 0) {
      alerts.push({
        code: "payment_failures_detected",
        level: paymentFailures24h >= 5 ? "high" : "medium",
        title: "Falhas de pagamento detectadas",
        description: `${paymentFailures24h} evento(s) com status de inadimplencia nas ultimas 24h.`,
        value: paymentFailures24h,
      });
    }

    if (webhookDelayedCount > 0) {
      alerts.push({
        code: "webhook_delayed_detected",
        level: webhookDelayedCount >= 3 ? "high" : "medium",
        title: "Webhook com atraso de processamento",
        description: `${webhookDelayedCount} evento(s) de billing pendente(s) ha mais de 10 minutos.`,
        value: webhookDelayedCount,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        windowMinutes,
        summary: {
          total,
          errors,
          rateLimited,
          avgDurationMs,
          errorRatePct,
          rateLimitedPct,
          previousTotal,
          trafficDropPct,
          paymentFailures24h,
          webhookDelayedCount,
        },
        alerts,
        byRoute,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_metrics_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
