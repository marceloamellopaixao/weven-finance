import { NextRequest, NextResponse } from "next/server";
import { buildCheckoutUrl } from "@/lib/billing/mercadopago";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan, UserRole } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: string | null): UserPlan | null {
  if (!value) return null;
  if (value === "free" || value === "pro" || value === "premium") return value;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const decoded = await verifyRequestAuth(request);
    const plan = parsePlan(request.nextUrl.searchParams.get("plan"));

    if (!plan || plan === "free") {
      return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
    }

    const userRows = await supabaseSelect("profiles", {
      filters: { uid: decoded.uid },
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
    const returnUrl = isPublicHttpsUrl
      ? `${selectedBaseUrl}/settings?billing_return=1&plan=${plan}`
      : undefined;
    const checkoutUrl = buildCheckoutUrl(selectedPlan.paymentLink, {
      uid: decoded.uid,
      plan,
      returnUrl,
    });

    const billing = ((userRow?.billing as Record<string, unknown> | undefined) ??
      (userRaw.billing as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;

    billing.pendingPreapprovalId = null;
    billing.pendingPlan = plan;
    billing.pendingCheckoutAt = new Date().toISOString();
    billing.lastError = null;

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid: decoded.uid,
          billing,
          raw: { ...userRaw, billing },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );

    return NextResponse.json({ ok: true, checkoutUrl, preapprovalId: null }, { status: 200 });
  } catch (error) {
    console.error("Checkout link API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}

