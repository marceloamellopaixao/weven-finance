import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/services/firebase/admin";
import { confirmLatestPreapprovalForUser, confirmPreapprovalForUser } from "@/lib/billing/mercadopago";
import { UserPlan } from "@/types/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: unknown): UserPlan | undefined {
  if (value === "free" || value === "pro" || value === "premium") return value;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;
    if (!token) {
      return NextResponse.json({ ok: false, error: "missing_auth_token" }, { status: 401 });
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const body = (await request.json()) as { preapprovalId?: string; expectedPlan?: UserPlan };

    const userRef = adminDb.collection("users").doc(decoded.uid);
    const userSnap = await userRef.get();
    const userData = userSnap.data() ?? {};
    const userEmail = ((userData.email as string | undefined) ?? decoded.email ?? "").trim();
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 400 });
    }
    const pendingPreapprovalId =
      typeof userData.billing === "object" &&
      userData.billing !== null &&
      typeof (userData.billing as { pendingPreapprovalId?: unknown }).pendingPreapprovalId === "string"
        ? (userData.billing as { pendingPreapprovalId: string }).pendingPreapprovalId
        : undefined;
    const pendingPlan = (
      typeof userData.billing === "object" && userData.billing !== null
    )
      ? parsePlan((userData.billing as { pendingPlan?: unknown }).pendingPlan)
      : undefined;
    const pendingCheckoutAt = (
      typeof userData.billing === "object" && userData.billing !== null &&
      typeof (userData.billing as { pendingCheckoutAt?: unknown }).pendingCheckoutAt === "string"
    )
      ? (userData.billing as { pendingCheckoutAt: string }).pendingCheckoutAt
      : undefined;

    const preapprovalId = body.preapprovalId?.trim() || pendingPreapprovalId;
    const expectedPlan = parsePlan(body.expectedPlan) || pendingPlan;
    let result;
    if (preapprovalId) {
      try {
        result = await confirmPreapprovalForUser({
          uid: decoded.uid,
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
          uid: decoded.uid,
          userEmail,
          expectedPlan: expectedPlan === "pro" || expectedPlan === "premium" ? expectedPlan : undefined,
          checkoutStartedAt: pendingCheckoutAt,
        });
      }
    } else {
      result = await confirmLatestPreapprovalForUser({
        uid: decoded.uid,
        userEmail,
        expectedPlan: expectedPlan === "pro" || expectedPlan === "premium" ? expectedPlan : undefined,
        checkoutStartedAt: pendingCheckoutAt,
      });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Confirm preapproval API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}
