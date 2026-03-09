import { NextRequest, NextResponse } from "next/server";
import { confirmLatestPreapprovalForUser, confirmPreapprovalForUser } from "@/lib/billing/mercadopago";
import { UserPlan } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { supabaseSelect } from "@/services/supabase/admin";
import { pushNotification } from "@/lib/notifications/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: unknown): UserPlan | undefined {
  if (value === "free" || value === "pro" || value === "premium") return value;
  return undefined;
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:billing-confirm:post", max: 20, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const decoded = await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const body = (await request.json()) as { preapprovalId?: string; expectedPlan?: UserPlan };

    const userRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const billing = ((userRow?.billing as Record<string, unknown> | undefined) ??
      (userRaw.billing as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;

    const userEmail = (String(userRow?.email || userRaw.email || "")).trim();
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 400 });
    }

    const pendingPreapprovalId = typeof billing.pendingPreapprovalId === "string" ? billing.pendingPreapprovalId : undefined;
    const pendingPlan = parsePlan(billing.pendingPlan);
    const pendingCheckoutAt = typeof billing.pendingCheckoutAt === "string" ? billing.pendingCheckoutAt : undefined;

    const preapprovalId = body.preapprovalId?.trim() || pendingPreapprovalId;
    const expectedPlan = parsePlan(body.expectedPlan) || pendingPlan;
    let result;
    if (preapprovalId) {
      try {
        result = await confirmPreapprovalForUser({
          uid,
          preapprovalId,
          expectedPlan,
          userEmail,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const shouldFallbackToSearch =
          message.includes("does not exist") ||
          message.includes("(404)") ||
          message.includes("preapproval_not_found");

        if (!shouldFallbackToSearch) {
          throw error;
        }

        result = await confirmLatestPreapprovalForUser({
          uid,
          userEmail,
          expectedPlan: expectedPlan === "pro" || expectedPlan === "premium" ? expectedPlan : undefined,
          checkoutStartedAt: pendingCheckoutAt,
        });
      }
    } else {
      result = await confirmLatestPreapprovalForUser({
        uid,
        userEmail,
        expectedPlan: expectedPlan === "pro" || expectedPlan === "premium" ? expectedPlan : undefined,
        checkoutStartedAt: pendingCheckoutAt,
      });
    }

    await pushNotification({
      uid,
      kind: "billing",
      title: "Assinatura atualizada",
      message: `Seu plano foi atualizado para ${result.targetPlan}.`,
      href: "/settings?tab=billing",
      meta: {
        targetPlan: result.targetPlan,
        targetPaymentStatus: result.targetPaymentStatus,
      },
    });

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "billing_confirm_preapproval_failed",
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

