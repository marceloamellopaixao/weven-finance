import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const ref = adminDb.collection("users").doc(uid).collection("settings").doc("finance");
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() as { currentBalance?: unknown }) : undefined;
    const currentBalance = typeof data?.currentBalance === "number" ? data.currentBalance : 0;
    return NextResponse.json({ ok: true, currentBalance }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "finance:update-balance",
      actionLabel: "Atualizar saldo financeiro",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as { currentBalance?: number };
    if (typeof body.currentBalance !== "number" || Number.isNaN(body.currentBalance)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const ref = adminDb.collection("users").doc(uid).collection("settings").doc("finance");
    await ref.set({ currentBalance: body.currentBalance }, { merge: true });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_auth_token" ? 401
        : message.startsWith("impersonation_") ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
