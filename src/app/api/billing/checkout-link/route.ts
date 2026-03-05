import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { buildCheckoutUrl } from "@/lib/billing/mercadopago";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: string | null): UserPlan | null {
  if (!value) return null;
  if (value === "free" || value === "pro" || value === "premium") return value;
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_auth_token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const plan = parsePlan(request.nextUrl.searchParams.get("plan"));

    if (!plan || plan === "free") {
      return NextResponse.json({ ok: false, error: "invalid_plan" }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const userEmail = (userSnap.data()?.email as string | undefined) ?? decoded.email;

    const plansDoc = await adminDb.collection("system").doc("plans").get();
    const plans = (plansDoc.exists ? (plansDoc.data() as PlansConfig) : DEFAULT_PLANS_CONFIG) ?? DEFAULT_PLANS_CONFIG;

    const selectedPlan = plans[plan];
    if (!selectedPlan?.active) {
      return NextResponse.json({ ok: false, error: "plan_inactive" }, { status: 409 });
    }

    if (!selectedPlan.paymentLink) {
      return NextResponse.json({ ok: false, error: "plan_missing_payment_link" }, { status: 422 });
    }

    const checkoutUrl = buildCheckoutUrl(selectedPlan.paymentLink, {
      uid: decoded.uid,
      plan,
      email: userEmail,
    });

    return NextResponse.json({ ok: true, checkoutUrl }, { status: 200 });
  } catch (error) {
    console.error("Checkout link API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
