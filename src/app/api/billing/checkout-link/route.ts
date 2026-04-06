import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { buildCheckoutUrl } from "@/lib/billing/mercadopago";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan, UserRole } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: string | null): UserPlan | null {
  if (!value) return null;
  if (value === "free" || value === "pro" || value === "premium") return value;
  return null;
}

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:billing-checkout:get", max: 30, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const plan = parsePlan(request.nextUrl.searchParams.get("plan"));

    if (!plan || plan === "free") {
      return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
    }

    const userRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const userRole = ((userRow?.role as UserRole | undefined) ?? (userRaw.role as UserRole | undefined) ?? "client");
    const isBillingExemptRole = userRole === "admin" || userRole === "moderator";
    if (isBillingExemptRole) {
      return NextResponse.json({ ok: false, error: "role_billing_exempt" }, { status: 409 });
    }

    const plansRows = await supabaseSelect("system_configs", {
      filters: { key: "plans" },
      limit: 1,
    });
    const plans = (plansRows[0]?.data as PlansConfig | undefined) ?? DEFAULT_PLANS_CONFIG;

    const selectedPlan = plans[plan];
    if (!selectedPlan?.active) {
      return NextResponse.json({ ok: false, error: "plan_inactive" }, { status: 409 });
    }

    if (!selectedPlan.paymentLink) {
      return NextResponse.json({ ok: false, error: "plan_missing_payment_link" }, { status: 422 });
    }

    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const runtimeBaseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const selectedBaseUrl = configuredAppUrl || runtimeBaseUrl;
    const isPublicHttpsUrl =
      selectedBaseUrl.startsWith("https://") &&
      !selectedBaseUrl.includes("localhost") &&
      !selectedBaseUrl.includes("127.0.0.1");
    const checkoutAttemptId = crypto.randomUUID();
    const returnUrl = isPublicHttpsUrl
      ? `${selectedBaseUrl}/billing/activating?plan=${plan}&attempt=${checkoutAttemptId}`
      : undefined;
    const checkoutUrl = buildCheckoutUrl(selectedPlan.paymentLink, {
      uid,
      plan,
      returnUrl,
    });

    const billing = ((userRow?.billing as Record<string, unknown> | undefined) ??
      (userRaw.billing as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;

    billing.pendingPreapprovalId = null;
    billing.pendingPlan = plan;
    billing.pendingCheckoutAt = new Date().toISOString();
    billing.pendingCheckoutAttemptId = checkoutAttemptId;
    billing.lastError = null;

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          billing,
          raw: { ...userRaw, billing },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(
      { ok: true, checkoutUrl, preapprovalId: null, checkoutAttemptId },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "billing_checkout_link_failed",
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
