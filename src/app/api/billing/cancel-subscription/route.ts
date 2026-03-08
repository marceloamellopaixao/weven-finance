import { NextRequest, NextResponse } from "next/server";
import { cancelSubscriptionForUser } from "@/lib/billing/mercadopago";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect } from "@/services/supabase/admin";
import { pushNotification } from "@/lib/notifications/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyRequestAuth(request);
    const userRows = await supabaseSelect("profiles", {
      filters: { uid: decoded.uid },
      limit: 1,
    });
    const userRow = userRows[0];
    const userRaw = ((userRow?.raw as Record<string, unknown> | undefined) ?? {});
    const userEmail = (String(userRow?.email || decoded.email || userRaw.email || "")).trim();
    if (!userEmail) {
      return NextResponse.json({ ok: false, error: "missing_user_email" }, { status: 400 });
    }

    const result = await cancelSubscriptionForUser({
      uid: decoded.uid,
      userEmail,
    });

    await pushNotification({
      uid: decoded.uid,
      kind: "billing",
      title: "Assinatura cancelada",
      message: "Seu plano voltou para Free. Você pode reativar quando quiser.",
      href: "/settings?tab=billing",
      meta: { targetPlan: result.targetPlan, targetPaymentStatus: result.targetPaymentStatus },
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("Cancel subscription API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}

