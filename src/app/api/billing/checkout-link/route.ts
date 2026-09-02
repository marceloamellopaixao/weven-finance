import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { changePreapprovalPlanForUser, createPreapprovalCheckout } from "@/lib/billing/mercadopago";
import { DEFAULT_ACCESS_CONTROL_CONFIG, DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserRole } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { parseBillingInterval, parseUpgradePlan } from "@/services/billing/checkoutIntent";
import { resolveActingContext } from "@/lib/impersonation/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { hasBillingExemption, normalizeAccessControlConfig } from "@/lib/access-control/config";
import { normalizePlansConfig as normalizeSystemPlans } from "@/lib/plans/catalog";
import { canAccessResource } from "@/lib/access-control/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const plan = parseUpgradePlan(request.nextUrl.searchParams.get("plan"));
    const interval = parseBillingInterval(request.nextUrl.searchParams.get("interval"));
    const adminTestRequested = request.nextUrl.searchParams.get("mode") === "admin-test";

    if (!plan) {
      return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
    }

    const userRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const userRole = ((userRow?.role as UserRole | undefined) ?? (userRaw.role as UserRole | undefined) ?? "client");
    const accessControlRows = await supabaseSelect("system_configs", {
      select: "data",
      filters: { key: "access_control" },
      limit: 1,
    });
    const accessControl = accessControlRows.length > 0
      ? normalizeAccessControlConfig(accessControlRows[0]?.data)
      : DEFAULT_ACCESS_CONTROL_CONFIG;
    const canRunAdminTest = adminTestRequested && await canAccessResource(uid, "admin.pages.preview", "read");
    if (adminTestRequested && !canRunAdminTest) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    if (hasBillingExemption(accessControl, { uid, role: userRole }) && !canRunAdminTest) {
      return NextResponse.json({ ok: false, error: "role_billing_exempt" }, { status: 409 });
    }

    const plansRows = await supabaseSelect("system_configs", {
      filters: { key: "plans" },
      limit: 1,
    });
    const plans: PlansConfig = plansRows[0]?.data ? normalizeSystemPlans(plansRows[0].data, DEFAULT_PLANS_CONFIG) : DEFAULT_PLANS_CONFIG;

    const selectedPlan = plans[plan];
    if (!selectedPlan?.active) {
      return NextResponse.json({ ok: false, error: "plan_inactive" }, { status: 409 });
    }

    const configuredAppUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
    const runtimeBaseUrl = `${request.nextUrl.protocol}//${request.nextUrl.host}`;
    const selectedBaseUrl = configuredAppUrl || runtimeBaseUrl;
    const isPublicHttpsUrl =
      selectedBaseUrl.startsWith("https://") &&
      !selectedBaseUrl.includes("localhost") &&
      !selectedBaseUrl.includes("127.0.0.1");
    const checkoutAttemptId = crypto.randomUUID();
    const activationPath = `/billing/activating?plan=${plan}&interval=${interval}&attempt=${checkoutAttemptId}${canRunAdminTest ? "&mode=admin-test" : ""}`;
    const publicBackUrlOverride = process.env.MERCADOPAGO_BACK_URL?.trim();
    const hasValidBackUrlOverride = Boolean(
      publicBackUrlOverride?.startsWith("https://") &&
      !publicBackUrlOverride.includes("localhost") &&
      !publicBackUrlOverride.includes("127.0.0.1")
    );
    const returnUrl = isPublicHttpsUrl
      ? `${selectedBaseUrl}${activationPath}`
      : hasValidBackUrlOverride
        ? publicBackUrlOverride!
        : "https://www.mercadopago.com.br/subscriptions";
    const payerEmail = String(userRow?.email || userRaw.email || "").trim().toLowerCase();
    if (!payerEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 422 });
    }
    const mercadoPagoTestMode = process.env.MERCADOPAGO_TEST_MODE === "true";
    const configuredTestPayerEmail = process.env.MERCADOPAGO_TEST_PAYER_EMAIL?.trim().toLowerCase();
    if (mercadoPagoTestMode && !configuredTestPayerEmail) {
      return NextResponse.json({ ok: false, error: "missing_mercadopago_test_payer_email" }, { status: 422 });
    }
    const billingPayerEmail = mercadoPagoTestMode ? configuredTestPayerEmail! : payerEmail;
    const billing = ((userRow?.billing as Record<string, unknown> | undefined) ??
      (userRaw.billing as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;
    const checkoutAmount = interval === "yearly" && typeof selectedPlan.yearlyPrice === "number"
      ? selectedPlan.yearlyPrice
      : Number(selectedPlan.price || 0);
    if (!Number.isFinite(checkoutAmount) || checkoutAmount <= 0) {
      return NextResponse.json({ ok: false, error: "invalid_checkout_amount" }, { status: 422 });
    }
    const currentPlan = String(userRow?.plan || userRaw.plan || "free");
    const currentPaymentStatus = String(userRow?.payment_status || userRaw.paymentStatus || billing.paymentStatus || "pending");
    const currentPreapprovalId = typeof billing.providerSubscriptionId === "string"
      ? billing.providerSubscriptionId
      : typeof billing.preapprovalId === "string"
        ? billing.preapprovalId
        : "";

    if (!canRunAdminTest && currentPreapprovalId && currentPaymentStatus === "paid" && currentPlan !== plan) {
      const changed = await changePreapprovalPlanForUser({
        uid,
        preapprovalId: currentPreapprovalId,
        userEmail: billingPayerEmail,
        plan,
        interval,
        amount: checkoutAmount,
        currency: "BRL",
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
      return NextResponse.json({
        ok: true,
        checkoutUrl: null,
        preapprovalId: changed.preapprovalId,
        checkoutAttemptId: null,
        changedInPlace: true,
        targetPlan: changed.targetPlan,
        nextChargeAt: changed.nextChargeAt,
        amount: changed.amount,
      }, { status: 200 });
    }

    const checkout = await createPreapprovalCheckout({
      uid,
      payerEmail: billingPayerEmail,
      plan,
      interval,
      amount: checkoutAmount,
      currency: "BRL",
      returnUrl,
    });

    billing.pendingPreapprovalId = checkout.preapprovalId;
    billing.pendingPlan = plan;
    billing.pendingBillingInterval = interval;
    billing.pendingCheckoutAt = new Date().toISOString();
    billing.pendingCheckoutAttemptId = checkoutAttemptId;
    billing.pendingCheckoutMode = canRunAdminTest ? "admin-test" : "standard";
    billing.pendingPayerEmail = billingPayerEmail;
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

    await supabaseUpsertRows(
      "billing_events",
      [
        {
          id: `checkout_attempt_${checkoutAttemptId}`,
          uid,
          event_type: "checkout_attempt",
          action: "create",
          provider: "system",
          raw: {
            uid,
            plan,
            interval,
            paymentStatus: "pending",
            preapprovalId: checkout.preapprovalId,
            checkoutAttemptId,
            createdAt: new Date().toISOString(),
            returnUrl: returnUrl ?? null,
            mode: canRunAdminTest ? "admin-test" : "standard",
          },
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(
      { ok: true, checkoutUrl: checkout.checkoutUrl, preapprovalId: checkout.preapprovalId, checkoutAttemptId },
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
