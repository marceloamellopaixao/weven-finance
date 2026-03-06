import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const groupId = request.nextUrl.searchParams.get("groupId")?.trim();

    let queryRef: FirebaseFirestore.Query = adminDb.collection("users").doc(uid).collection("transactions");
    if (groupId) {
      queryRef = queryRef.where("groupId", "==", groupId);
    }

    const snapshot = await queryRef.get();
    const transactions: Array<Record<string, unknown> & { id: string; createdAt: string | null; dueDate?: string }> = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        ...data,
        createdAt: toIsoDate(data.createdAt),
        dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
      };
    });

    transactions.sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")));
    return NextResponse.json({ ok: true, transactions }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const body = (await request.json()) as
      | { action: "createMany"; transactions: Record<string, unknown>[] }
      | { action: "updateMany"; updates: Array<{ id: string; updates: Record<string, unknown> }> }
      | { action: "toggleStatus"; transactionId: string; currentStatus: "paid" | "pending" }
      | { action: "cancelFuture"; groupId: string; lastInstallmentDate: string };

    if (body.action === "createMany") {
      const approval = await ensureImpersonationWriteApproval({
        request,
        acting,
        actionType: "transactions:createMany",
        actionLabel: "Criar lancamentos financeiros",
      });
      if (!approval.allowed) {
        return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
      }

      const txs = Array.isArray(body.transactions) ? body.transactions : [];
      if (txs.length === 0) {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const batch = adminDb.batch();
      txs.forEach((tx) => {
        const ref = adminDb.collection("users").doc(uid).collection("transactions").doc();
        batch.set(ref, {
          ...tx,
          userId: uid,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      batch.set(
        adminDb.collection("users").doc(uid),
        { transactionCount: FieldValue.increment(txs.length) },
        { merge: true }
      );
      await batch.commit();
      return NextResponse.json({ ok: true, created: txs.length }, { status: 200 });
    }

    if (body.action === "updateMany") {
      const approval = await ensureImpersonationWriteApproval({
        request,
        acting,
        actionType: "transactions:updateMany",
        actionLabel: "Atualizar lancamentos financeiros",
      });
      if (!approval.allowed) {
        return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
      }

      const updates = Array.isArray(body.updates) ? body.updates : [];
      if (updates.length === 0) {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }
      const batch = adminDb.batch();
      updates.forEach((entry) => {
        if (!entry?.id) return;
        const ref = adminDb.collection("users").doc(uid).collection("transactions").doc(entry.id);
        batch.set(ref, entry.updates || {}, { merge: true });
      });
      await batch.commit();
      return NextResponse.json({ ok: true, updated: updates.length }, { status: 200 });
    }

    if (body.action === "toggleStatus") {
      const approval = await ensureImpersonationWriteApproval({
        request,
        acting,
        actionType: "transactions:toggleStatus",
        actionLabel: "Alterar status de pagamento de lancamento",
      });
      if (!approval.allowed) {
        return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
      }

      if (!body.transactionId || !body.currentStatus) {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }
      const nextStatus = body.currentStatus === "paid" ? "pending" : "paid";
      await adminDb
        .collection("users")
        .doc(uid)
        .collection("transactions")
        .doc(body.transactionId)
        .set({ status: nextStatus }, { merge: true });

      return NextResponse.json({ ok: true, status: nextStatus }, { status: 200 });
    }

    if (body.action === "cancelFuture") {
      const approval = await ensureImpersonationWriteApproval({
        request,
        acting,
        actionType: "transactions:cancelFuture",
        actionLabel: "Cancelar parcelas futuras",
      });
      if (!approval.allowed) {
        return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
      }

      if (!body.groupId || !body.lastInstallmentDate) {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const snapshot = await adminDb
        .collection("users")
        .doc(uid)
        .collection("transactions")
        .where("groupId", "==", body.groupId)
        .where("dueDate", ">", body.lastInstallmentDate)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ ok: true, deleted: 0 }, { status: 200 });
      }

      const batch = adminDb.batch();
      snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      batch.set(
        adminDb.collection("users").doc(uid),
        { transactionCount: FieldValue.increment(-snapshot.size) },
        { merge: true }
      );
      await batch.commit();
      return NextResponse.json({ ok: true, deleted: snapshot.size }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "transactions:patch",
      actionLabel: "Editar lancamento financeiro",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as { transactionId?: string; updates?: Record<string, unknown> };
    if (!body.transactionId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await adminDb
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .doc(body.transactionId)
      .set(body.updates, { merge: true });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "transactions:delete",
      actionLabel: "Excluir lancamento financeiro",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const transactionId = request.nextUrl.searchParams.get("transactionId")?.trim();
    const groupId = request.nextUrl.searchParams.get("groupId")?.trim();

    if (!transactionId && !groupId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    if (groupId) {
      const snapshot = await adminDb
        .collection("users")
        .doc(uid)
        .collection("transactions")
        .where("groupId", "==", groupId)
        .get();

      if (snapshot.empty) {
        return NextResponse.json({ ok: true, deleted: 0 }, { status: 200 });
      }

      const batch = adminDb.batch();
      snapshot.docs.forEach((docSnap) => batch.delete(docSnap.ref));
      batch.set(
        adminDb.collection("users").doc(uid),
        { transactionCount: FieldValue.increment(-snapshot.size) },
        { merge: true }
      );
      await batch.commit();
      return NextResponse.json({ ok: true, deleted: snapshot.size }, { status: 200 });
    }

    await adminDb.collection("users").doc(uid).collection("transactions").doc(transactionId as string).delete();
    await adminDb.collection("users").doc(uid).set(
      { transactionCount: FieldValue.increment(-1) },
      { merge: true }
    );
    return NextResponse.json({ ok: true, deleted: 1 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_auth_token" ? 401
        : message.startsWith("impersonation_") ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
