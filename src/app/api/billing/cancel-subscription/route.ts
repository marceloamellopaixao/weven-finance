import { NextRequest, NextResponse } from "next/server";
import { cancelSubscriptionForUser } from "@/lib/billing/mercadopago";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { supabaseSelect } from "@/services/supabase/admin";
import { pushNotification } from "@/lib/notifications/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:billing-cancel:post", max: 10, windowMs: 60_000, critical: true });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return rateLimitResponse(rate);
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const userRate = await checkRateLimit(request, { key: "api:billing-cancel:user", max: Number(process.env.RATE_LIMIT_BILLING_ACTIONS_PER_MINUTE || 10), windowMs: 60_000, identity: { userId: acting.requesterUid, tenantId: uid }, critical: true });
    if (!userRate.allowed) return rateLimitResponse(userRate);
    const userRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const userEmail = (String(userRow?.email || userRaw.email || "")).trim();
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 400 });
    }

    const result = await cancelSubscriptionForUser({
      uid,
      userEmail,
    });

    await pushNotification({
      uid,
      kind: "billing",
      title: "Assinatura cancelada",
      message: "Seu plano voltou para Free. Você pode reativar quando quiser.",
      href: "/settings?tab=billing",
      meta: { targetPlan: result.targetPlan, targetPaymentStatus: result.targetPaymentStatus },
    });

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "billing_cancel_subscription_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}

