import { NextRequest, NextResponse } from "next/server";
import { confirmLatestPreapprovalForUser, confirmPreapprovalForUser } from "@/lib/billing/mercadopago";
import { UserPlan } from "@/types/user";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect } from "@/services/supabase/admin";
import { pushNotification } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parsePlan(value: unknown): UserPlan | undefined {
  if (value === "free" || value === "pro" || value === "premium") return value;
  return undefined;
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyRequestAuth(request);
    const body = (await request.json()) as { preapprovalId?: string; expectedPlan?: UserPlan };

    const userRows = await supabaseSelect("profiles", {
      filters: { uid: decoded.uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const billing = ((userRow?.billing as Record<string, unknown> | undefined) ??
      (userRaw.billing as Record<string, unknown> | undefined) ??
      {}) as Record<string, unknown>;

    const userEmail = (String(userRow?.email || decoded.email || userRaw.email || "")).trim();
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

    await pushNotification({
      uid: decoded.uid,
      kind: "billing",
      title: "Assinatura atualizada",
      message: `Seu plano foi atualizado para ${result.targetPlan}.`,
      href: "/settings?tab=billing",
      meta: {
        targetPlan: result.targetPlan,
        targetPaymentStatus: result.targetPaymentStatus,
      },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Confirm preapproval API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}

