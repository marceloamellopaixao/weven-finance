import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/services/firebase/admin";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { PiggyBankGoalType } from "@/types/piggyBank";
import { enforceCreditCardPolicy } from "@/lib/credit-card/limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

function sanitizeGoalType(value: unknown): PiggyBankGoalType {
  if (
    value === "card_limit" ||
    value === "emergency_reserve" ||
    value === "travel" ||
    value === "home_renovation" ||
    value === "dream_purchase" ||
    value === "custom"
  ) {
    return value;
  }
  return "custom";
}

function sanitizeText(value: unknown, max = 80) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, 999999999);
}

function slugifyGoalName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/-+/g, "_");
  return normalized || "cofrinho";
}

function getDefaultGoalName(goalType: PiggyBankGoalType) {
  if (goalType === "card_limit") return "Cofrinho do Cartão";
  if (goalType === "emergency_reserve") return "Reserva de Emergencia";
  if (goalType === "travel") return "Fazer uma Viagem";
  if (goalType === "home_renovation") return "Reformar a Casa";
  if (goalType === "dream_purchase") return "Sonho de Consumo";
  return "Novo Objetivo";
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const snapshot = await adminDb.collection("users").doc(actingUid).collection("piggy_banks").get();

    const piggyBanks = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        slug: String(data.slug || docSnap.id),
        name: String(data.name || "Cofrinho"),
        goalType: sanitizeGoalType(data.goalType),
        totalSaved: Number(data.totalSaved || 0),
        createdAt: toIsoDate(data.createdAtServer) || (typeof data.createdAt === "string" ? data.createdAt : null),
        updatedAt: toIsoDate(data.updatedAtServer) || (typeof data.updatedAt === "string" ? data.updatedAt : null),
        lastDepositAt: toIsoDate(data.lastDepositAtServer) || (typeof data.lastDepositAt === "string" ? data.lastDepositAt : null),
      };
    });

    piggyBanks.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    return NextResponse.json({ ok: true, piggyBanks }, { status: 200 });
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
      actionType: "piggy-banks:deposit",
      actionLabel: "Guardar valor no cofrinho",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      action?: "deposit";
      goalType?: PiggyBankGoalType;
      goalName?: string;
      amount?: number;
      withdrawalMode?: string;
      yieldType?: string;
      sourceType?: "bank" | "cash";
      cardId?: string;
    };

    if (body.action !== "deposit") {
      return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
    }

    const goalType = sanitizeGoalType(body.goalType);
    const goalName = sanitizeText(body.goalName, 80) || getDefaultGoalName(goalType);
    const amount = sanitizeMoney(body.amount);
    const withdrawalMode = sanitizeText(body.withdrawalMode, 120);
    const yieldType = sanitizeText(body.yieldType, 120);
    const sourceType = body.sourceType === "cash" ? "cash" : "bank";
    const cardId = sanitizeText(body.cardId, 120);
    if (!amount) {
      return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
    }
    if (goalType === "card_limit" && !cardId) {
      return NextResponse.json({ ok: false, error: "missing_card_id_for_card_limit" }, { status: 400 });
    }

    const uid = acting.actingUid;
    const now = new Date();
    const nowIso = now.toISOString();
    const today = nowIso.slice(0, 10);
    const slug = slugifyGoalName(goalName);

    const piggyRef = adminDb.collection("users").doc(uid).collection("piggy_banks").doc(slug);
    const historyRef = piggyRef.collection("history").doc();

    let cardLabel: string | undefined;
    if (goalType === "card_limit" && cardId) {
      const cardRef = adminDb.collection("users").doc(uid).collection("payment_cards").doc(cardId);
      const cardSnap = await cardRef.get();
      if (!cardSnap.exists) {
        return NextResponse.json({ ok: false, error: "card_not_found" }, { status: 404 });
      }
      const cardData = cardSnap.data() as Record<string, unknown>;
      const currentLimit = Number(cardData.creditLimit || 0);
      const nextLimit = currentLimit + amount;
      cardLabel = `${String(cardData.bankName || "Cartão")} •••• ${String(cardData.last4 || "")}`;
      await cardRef.set(
        {
          creditLimit: nextLimit,
          limitEnabled: true,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    }

    const batch = adminDb.batch();
    batch.set(
      piggyRef,
      {
        slug,
        name: goalName,
        goalType,
        totalSaved: FieldValue.increment(amount),
        ...(withdrawalMode ? { withdrawalMode } : {}),
        ...(yieldType ? { yieldType } : {}),
        lastDepositAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
        createdBy: acting.requesterUid,
        createdAtServer: FieldValue.serverTimestamp(),
        updatedAtServer: FieldValue.serverTimestamp(),
        lastDepositAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    batch.set(historyRef, {
      piggyBankId: slug,
      amount,
      sourceType,
      ...(withdrawalMode ? { withdrawalMode } : {}),
      ...(yieldType ? { yieldType } : {}),
      ...(cardId ? { cardId } : {}),
      ...(cardLabel ? { cardLabel } : {}),
      appliedToCardLimit: goalType === "card_limit",
      createdAt: nowIso,
      createdAtServer: FieldValue.serverTimestamp(),
      createdBy: acting.requesterUid,
    });

    const txRef = adminDb.collection("users").doc(uid).collection("transactions").doc();
    batch.set(txRef, {
      userId: uid,
      description: `Aporte no Cofrinho: ${goalName}`,
      amount,
      amountForLimit: amount,
      type: "expense",
      category: `Cofrinho > ${goalName}`,
      status: "paid",
      paymentMethod: sourceType === "cash" ? "cash" : "transfer",
      date: today,
      dueDate: today,
      isEncrypted: false,
      isArchived: false,
      ...(cardId ? { cardId } : {}),
      ...(cardLabel ? { cardLabel } : {}),
      ...(goalType === "card_limit" ? { cardType: "credit_card" } : {}),
      createdAt: FieldValue.serverTimestamp(),
    });
    batch.set(adminDb.collection("users").doc(uid), { transactionCount: FieldValue.increment(1) }, { merge: true });

    await batch.commit();
    await enforceCreditCardPolicy(uid);

    return NextResponse.json({ ok: true, slug }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
