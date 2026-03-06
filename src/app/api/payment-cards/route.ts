import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { adminDb } from "@/services/firebase/admin";
import { PaymentCard, PaymentCardType } from "@/types/paymentCard";
import { resolveApiErrorStatus } from "@/lib/api/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sanitizeBankName(value: unknown) {
  return String(value || "").trim().slice(0, 40);
}

function sanitizeLast4(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(-4);
}

function sanitizeType(value: unknown): PaymentCardType {
  if (value === "debit_card") return "debit_card";
  if (value === "credit_and_debit") return "credit_and_debit";
  return "credit_card";
}

function sanitizeBrand(value: unknown) {
  return String(value || "").trim().slice(0, 40);
}

function sanitizeBin(value: unknown) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function sanitizeDueDate(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  return (Number.isInteger(num) && num >= 1 && num <= 31) ? num : null;
}

function sanitizeCurrency(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(num, 999999999);
}

function sanitizePercent(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(1, num));
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const snapshot = await adminDb
      .collection("users")
      .doc(actingUid)
      .collection("payment_cards")
      .get();

    const cards: PaymentCard[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        bankName: String(data.bankName || ""),
        last4: String(data.last4 || ""),
        type: sanitizeType(data.type),
        brand: sanitizeBrand(data.brand) || undefined,
        bin: sanitizeBin(data.bin) || undefined,
        dueDate: sanitizeDueDate(data.dueDate) || undefined,
        limitEnabled: data.limitEnabled === undefined ? undefined : Boolean(data.limitEnabled),
        creditLimit: sanitizeCurrency(data.creditLimit) || undefined,
        alertThresholdPct: sanitizePercent(data.alertThresholdPct) || undefined,
        blockOnLimitExceeded: data.blockOnLimitExceeded === undefined ? undefined : Boolean(data.blockOnLimitExceeded),
        createdAt: typeof data.createdAt === "string" ? data.createdAt : undefined,
        updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
      };
    });

    cards.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return NextResponse.json({ ok: true, cards }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "payment-cards:create",
      actionLabel: "Cadastrar cartão",
    });
    if (!approval.allowed) {
      return NextResponse.json(
        { ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId },
        { status: 409 }
      );
    }

    const body = (await request.json()) as Partial<PaymentCard>;
    const bankName = sanitizeBankName(body.bankName);
    const last4 = sanitizeLast4(body.last4);
    const type = sanitizeType(body.type);
    const brand = sanitizeBrand(body.brand);
    const bin = sanitizeBin(body.bin);
    const dueDate = sanitizeDueDate(body.dueDate);
    const creditLimit = sanitizeCurrency(body.creditLimit);
    const alertThresholdPct = sanitizePercent(body.alertThresholdPct);
    const limitEnabled = body.limitEnabled === undefined ? undefined : Boolean(body.limitEnabled);
    const blockOnLimitExceeded = body.blockOnLimitExceeded === undefined ? undefined : Boolean(body.blockOnLimitExceeded);

    if (!bankName || last4.length !== 4) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const payloadData: Record<string, unknown> = {
      bankName,
      last4,
      type,
      ...(brand ? { brand } : {}),
      ...(bin.length >= 6 ? { bin } : {}),
      ...(type === "credit_card" && dueDate ? { dueDate } : {}),
      ...(type === "credit_card" || type === "credit_and_debit"
        ? {
            ...(creditLimit !== null ? { creditLimit } : {}),
            ...(alertThresholdPct !== null ? { alertThresholdPct } : {}),
            ...(limitEnabled !== undefined ? { limitEnabled } : {}),
            ...(blockOnLimitExceeded !== undefined ? { blockOnLimitExceeded } : {}),
          }
        : {}),
      createdAt: nowIso,
      updatedAt: nowIso,
      createdBy: acting.requesterUid,
      createdAtServer: FieldValue.serverTimestamp(),
    };

    const ref = await adminDb.collection("users").doc(acting.actingUid).collection("payment_cards").add(payloadData);

    return NextResponse.json({ ok: true, id: ref.id }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "payment-cards:update",
      actionLabel: "Editar cartão",
    });
    if (!approval.allowed) {
      return NextResponse.json(
        { ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId },
        { status: 409 }
      );
    }

    const body = (await request.json()) as { cardId?: string; updates?: Partial<PaymentCard> };
    if (!body.cardId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (body.updates.bankName !== undefined) {
      const bankName = sanitizeBankName(body.updates.bankName);
      if (!bankName) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      updates.bankName = bankName;
    }
    if (body.updates.last4 !== undefined) {
      const last4 = sanitizeLast4(body.updates.last4);
      if (last4.length !== 4) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      updates.last4 = last4;
    }
    if (body.updates.type !== undefined) {
      updates.type = sanitizeType(body.updates.type);
    }
    if (body.updates.brand !== undefined) {
      const brand = sanitizeBrand(body.updates.brand);
      updates.brand = brand || FieldValue.delete();
    }
    if (body.updates.bin !== undefined) {
      const bin = sanitizeBin(body.updates.bin);
      updates.bin = bin.length >= 6 ? bin : FieldValue.delete();
    }
    if (body.updates.dueDate !== undefined) {
      const dueDate = sanitizeDueDate(body.updates.dueDate);
      updates.dueDate = dueDate || FieldValue.delete();
    }
    if (body.updates.creditLimit !== undefined) {
      const creditLimit = sanitizeCurrency(body.updates.creditLimit);
      updates.creditLimit = creditLimit !== null ? creditLimit : FieldValue.delete();
    }
    if (body.updates.alertThresholdPct !== undefined) {
      const pct = sanitizePercent(body.updates.alertThresholdPct);
      updates.alertThresholdPct = pct !== null ? pct : FieldValue.delete();
    }
    if (body.updates.limitEnabled !== undefined) {
      updates.limitEnabled = Boolean(body.updates.limitEnabled);
    }
    if (body.updates.blockOnLimitExceeded !== undefined) {
      updates.blockOnLimitExceeded = Boolean(body.updates.blockOnLimitExceeded);
    }
    updates.updatedAt = new Date().toISOString();

    await adminDb
      .collection("users")
      .doc(acting.actingUid)
      .collection("payment_cards")
      .doc(body.cardId)
      .set(updates, { merge: true });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "payment-cards:delete",
      actionLabel: "Excluir cartão",
    });
    if (!approval.allowed) {
      return NextResponse.json(
        { ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId },
        { status: 409 }
      );
    }

    const cardId = request.nextUrl.searchParams.get("cardId")?.trim();
    if (!cardId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await adminDb.collection("users").doc(acting.actingUid).collection("payment_cards").doc(cardId).delete();
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
