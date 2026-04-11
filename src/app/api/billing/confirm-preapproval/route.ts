import { NextRequest, NextResponse } from "next/server";
import { confirmLatestPreapprovalForUser, confirmPreapprovalForUser } from "@/lib/billing/mercadopago";
import { UserPlan } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { pushNotification } from "@/lib/notifications/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getCheckoutAttemptContext(checkoutAttemptId: string) {
  const rows = await supabaseSelect("billing_events", {
    filters: { id: `checkout_attempt_${checkoutAttemptId}` },
    limit: 1,
  });

  if (rows.length === 0) return null;
  const raw = ((rows[0].raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  return {
    uid: typeof raw.uid === "string" ? raw.uid : null,
    plan: parsePlan(raw.plan),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : null,
  };
}

function parsePlan(value: unknown): UserPlan | undefined {
  if (value === "free" || value === "pro" || value === "premium") return value;
  return undefined;
}

function getConfirmErrorStatus(message: string) {
  if (message === "missing_auth_token") return 401;
  if (message === "preapproval_not_found_for_user") return 404;
  if (message === "preapproval_ambiguous_match") return 409;
  if (message === "payer_email_mismatch") return 403;
  if (message === "plan_mismatch") return 409;
  if (message === "user_not_found") return 404;
  return 500;
}

function isExpectedConfirmError(message: string) {
  return (
    message === "preapproval_not_found_for_user" ||
    message === "preapproval_ambiguous_match" ||
    message === "payer_email_mismatch" ||
    message === "plan_mismatch" ||
    message === "user_not_found"
  );
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

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const body = (await request.json()) as {
      preapprovalId?: string;
      expectedPlan?: UserPlan;
      checkoutAttemptId?: string;
    };

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
    const pendingCheckoutAttemptId =
      typeof billing.pendingCheckoutAttemptId === "string" ? billing.pendingCheckoutAttemptId : undefined;
    const checkoutAttemptId = body.checkoutAttemptId?.trim() || pendingCheckoutAttemptId;

    if (checkoutAttemptId && pendingCheckoutAttemptId && checkoutAttemptId !== pendingCheckoutAttemptId) {
      return NextResponse.json({ ok: false, error: "checkout_attempt_mismatch" }, { status: 409 });
    }

    const checkoutAttempt = checkoutAttemptId
      ? await getCheckoutAttemptContext(checkoutAttemptId)
      : null;

    if (checkoutAttemptId && !checkoutAttempt) {
      return NextResponse.json({ ok: false, error: "checkout_attempt_not_found" }, { status: 404 });
    }

    if (checkoutAttempt?.uid && checkoutAttempt.uid !== uid) {
      return NextResponse.json({ ok: false, error: "checkout_attempt_forbidden" }, { status: 403 });
    }

    const preapprovalId = body.preapprovalId?.trim() || pendingPreapprovalId;
    const expectedPlan = parsePlan(body.expectedPlan) || checkoutAttempt?.plan || pendingPlan;
    const checkoutStartedAt = checkoutAttempt?.createdAt || pendingCheckoutAt;
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
          checkoutStartedAt,
        });
      }
    } else {
      result = await confirmLatestPreapprovalForUser({
        uid,
        userEmail,
        expectedPlan: expectedPlan === "pro" || expectedPlan === "premium" ? expectedPlan : undefined,
        checkoutStartedAt,
      });
    }

    if (checkoutAttemptId) {
      await supabaseUpsertRows(
        "billing_events",
        [
          {
            id: `checkout_attempt_${checkoutAttemptId}`,
            uid,
            event_type: "checkout_attempt",
            action: "confirmed",
            provider: "system",
            raw: {
              uid,
              plan: expectedPlan ?? null,
              checkoutAttemptId,
              createdAt: checkoutStartedAt ?? null,
              confirmedAt: new Date().toISOString(),
              targetPlan: result.targetPlan,
              targetPaymentStatus: result.targetPaymentStatus,
              preapprovalId: preapprovalId ?? null,
            },
            created_at: new Date().toISOString(),
          },
        ],
        { onConflict: "id" }
      );
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
    const status = getConfirmErrorStatus(message);
    const logPayload = {
      message: "billing_confirm_preapproval_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      uid: uid ?? undefined,
      meta: { uid, error: message },
    };
    if (isExpectedConfirmError(message)) {
      apiLogger.warn(logPayload);
    } else {
      apiLogger.error(logPayload);
    }
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}

