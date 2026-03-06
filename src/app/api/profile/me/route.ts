import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const snap = await adminDb.collection("users").doc(uid).get();
    if (!snap.exists) {
      return NextResponse.json({ ok: true, profile: null }, { status: 200 });
    }
    return NextResponse.json({ ok: true, profile: { uid, ...snap.data() } }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
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
      actionType: "profile:update",
      actionLabel: "Editar perfil do usuário",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      displayName?: string;
      completeName?: string;
      phone?: string;
    };
    await adminDb.collection("users").doc(uid).set(
      {
        displayName: body.displayName ?? "",
        completeName: body.completeName ?? "",
        phone: body.phone ?? "",
      },
      { merge: true }
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
