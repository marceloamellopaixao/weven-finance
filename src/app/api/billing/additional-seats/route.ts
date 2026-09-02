import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { verifyRequestAuth } from "@/lib/auth/server";
import { changePreapprovalPlanForUser, getPreapprovalBillingInfoForUser } from "@/lib/billing/mercadopago";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { getUserPlanContext } from "@/lib/plans/server";
import { buildWorkspaceSeatSummary, countOccupiedWorkspaceSeats } from "@/lib/workspaces/seats";
import { getOwnedWorkspace } from "@/lib/workspaces/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:billing-additional-seats:post", max: 10, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    const auth = await verifyRequestAuth(request);
    uid = auth.uid;
    const body = await request.json() as { workspaceId?: string; quantity?: number };
    const workspaceId = String(body.workspaceId || "").trim();
    const quantity = Math.floor(Number(body.quantity));
    if (!workspaceId || !Number.isFinite(quantity) || quantity < 0) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const workspace = await getOwnedWorkspace(auth.uid, workspaceId);
    if (!workspace || (workspace.workspace_type !== "family" && workspace.workspace_type !== "business")) {
      return NextResponse.json({ ok: false, error: "workspace_not_owned" }, { status: 403 });
    }
    const expectedPlan = workspace.workspace_type === "family" ? "family" : "business";
    const planContext = await getUserPlanContext(auth.uid);
    if (planContext.plan !== expectedPlan || planContext.isBillingExempt) {
      return NextResponse.json({ ok: false, error: "seat_billing_not_available" }, { status: 409 });
    }
    const plan = planContext.plans[expectedPlan];
    const maxAdditional = plan.maxAdditionalSeats == null ? null : Math.max(0, Math.floor(Number(plan.maxAdditionalSeats)));
    if (maxAdditional !== null && quantity > maxAdditional) {
      return NextResponse.json({ ok: false, error: "additional_seat_limit_reached" }, { status: 409 });
    }

    const [profileRows, memberRows] = await Promise.all([
      supabaseSelect("profiles", { filters: { uid: auth.uid }, limit: 1 }),
      supabaseSelect("workspace_members", {
        filters: { workspace_uid: auth.uid, workspace_id: workspaceId },
        conditions: { member_status: "in.(active,pending)" },
        limit: 100,
      }),
    ]);
    const profile = profileRows[0];
    if (!profile) return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    const raw = ((profile.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const billing = ((profile.billing as Record<string, unknown> | null) || (raw.billing as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const preapprovalId = String(billing.providerSubscriptionId || billing.preapprovalId || "").trim();
    if (!preapprovalId || String(profile.payment_status || raw.paymentStatus || "") !== "paid") {
      return NextResponse.json({ ok: false, error: "subscription_not_active_for_seat_change" }, { status: 409 });
    }

    const occupied = countOccupiedWorkspaceSeats(auth.uid, memberRows);
    const preview = buildWorkspaceSeatSummary({ plan, occupied, additionalSeats: quantity, fallbackIncluded: expectedPlan === "family" ? 4 : 5 });
    if (preview.capacity < occupied) {
      return NextResponse.json({ ok: false, error: "cannot_remove_occupied_seats" }, { status: 409 });
    }

    const gateway = await getPreapprovalBillingInfoForUser({ uid: auth.uid, preapprovalId, userEmail: auth.email });
    const unitPrice = gateway.interval === "yearly" ? preview.additionalSeatYearlyPrice : preview.additionalSeatPrice;
    const basePrice = gateway.interval === "yearly" ? Number(plan.yearlyPrice || 0) : Number(plan.price || 0);
    if (!unitPrice || !Number.isFinite(basePrice) || basePrice <= 0) {
      return NextResponse.json({ ok: false, error: "additional_seat_price_not_configured" }, { status: 409 });
    }
    const totalAmount = Number((basePrice + quantity * unitPrice).toFixed(2));
    const pendingAt = new Date().toISOString();
    const pendingBilling = {
      ...billing,
      pendingAdditionalSeats: quantity,
      pendingAdditionalSeatsAt: pendingAt,
    };
    await supabaseUpsertRows("profiles", [{
      uid: auth.uid,
      billing: pendingBilling,
      raw: { ...raw, billing: pendingBilling },
      updated_at: pendingAt,
    }], { onConflict: "uid" });
    const changed = await changePreapprovalPlanForUser({
      uid: auth.uid,
      preapprovalId,
      userEmail: auth.email,
      plan: expectedPlan,
      interval: gateway.interval,
      amount: totalAmount,
      currency: "BRL",
    });

    const refreshedRows = await supabaseSelect("profiles", { filters: { uid: auth.uid }, limit: 1 });
    const refreshed = refreshedRows[0] || profile;
    const refreshedRaw = ((refreshed.raw as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const refreshedBilling = ((refreshed.billing as Record<string, unknown> | null) || (refreshedRaw.billing as Record<string, unknown> | null) || {}) as Record<string, unknown>;
    const now = new Date().toISOString();
    const nextBilling = {
      ...refreshedBilling,
      billingInterval: gateway.interval,
      additionalSeats: quantity,
      additionalSeatUnitPrice: unitPrice,
      additionalSeatsUpdatedAt: now,
      pendingAdditionalSeats: null,
      pendingAdditionalSeatsAt: null,
    };
    await supabaseUpsertRows("profiles", [{
      uid: auth.uid,
      billing: nextBilling,
      raw: { ...refreshedRaw, billing: nextBilling },
      updated_at: now,
    }], { onConflict: "uid" });

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({
      ok: true,
      seats: preview,
      amount: totalAmount,
      interval: gateway.interval,
      nextChargeAt: changed.nextChargeAt,
      chargePolicy: "next_renewal_no_immediate_charge",
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" || message === "invalid_auth_token" ? 401 : 500;
    apiLogger.error({ message: "billing_additional_seats_failed", requestId: meta.requestId, route: meta.route, method: meta.method, meta: { uid, error: message } });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
