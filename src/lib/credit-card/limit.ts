import { adminDb } from "@/services/firebase/admin";
import { CreditCardSettings, CreditCardSummary } from "@/types/creditCard";

export const defaultCreditCardSettings: CreditCardSettings = {
  enabled: false,
  cardName: "Cartão principal",
  limit: 0,
  alertThresholdPct: 80,
  blockOnLimitExceeded: false,
  autoUnblockWhenBelowLimit: true,
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeSettings(raw: Partial<CreditCardSettings> | undefined): CreditCardSettings {
  return {
    enabled: Boolean(raw?.enabled),
    cardName: String(raw?.cardName || defaultCreditCardSettings.cardName).slice(0, 60),
    limit: clampNumber(raw?.limit, 0, 999999999, 0),
    alertThresholdPct: clampNumber(raw?.alertThresholdPct, 1, 100, 80),
    blockOnLimitExceeded: raw?.blockOnLimitExceeded ?? false,
    autoUnblockWhenBelowLimit: raw?.autoUnblockWhenBelowLimit ?? true,
    updatedAt: typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}

export async function getCreditCardSettings(uid: string): Promise<CreditCardSettings> {
  const snap = await adminDb.collection("users").doc(uid).collection("settings").doc("creditCard").get();
  if (!snap.exists) return defaultCreditCardSettings;
  const data = snap.data() as Partial<CreditCardSettings>;
  return sanitizeSettings(data);
}

export async function saveCreditCardSettings(uid: string, patch: Partial<CreditCardSettings>): Promise<CreditCardSettings> {
  const current = await getCreditCardSettings(uid);
  const next = sanitizeSettings({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  await adminDb.collection("users").doc(uid).collection("settings").doc("creditCard").set(next, { merge: true });
  return next;
}

function readAmountForLimit(tx: Record<string, unknown>) {
  if (typeof tx.amountForLimit === "number" && Number.isFinite(tx.amountForLimit)) return tx.amountForLimit;
  if (typeof tx.amount === "number" && Number.isFinite(tx.amount)) return tx.amount;
  return null;
}

type PaymentCardPolicyDoc = {
  id: string;
  bankName: string;
  last4: string;
  type: "credit_card" | "debit_card" | "credit_and_debit";
  limitEnabled?: boolean;
  creditLimit?: number;
  alertThresholdPct?: number;
  blockOnLimitExceeded?: boolean;
};

function isCreditCapable(type: PaymentCardPolicyDoc["type"]) {
  return type === "credit_card" || type === "credit_and_debit";
}

function toPaymentCardPolicyDoc(id: string, data: Record<string, unknown>): PaymentCardPolicyDoc {
  const type =
    data.type === "debit_card" || data.type === "credit_and_debit"
      ? data.type
      : "credit_card";
  return {
    id,
    bankName: String(data.bankName || ""),
    last4: String(data.last4 || ""),
    type,
    limitEnabled: data.limitEnabled === undefined ? undefined : Boolean(data.limitEnabled),
    creditLimit: typeof data.creditLimit === "number" ? data.creditLimit : undefined,
    alertThresholdPct: typeof data.alertThresholdPct === "number" ? data.alertThresholdPct : undefined,
    blockOnLimitExceeded: data.blockOnLimitExceeded === undefined ? undefined : Boolean(data.blockOnLimitExceeded),
  };
}

function mapTxToCard(tx: Record<string, unknown>, cards: PaymentCardPolicyDoc[]) {
  const cardId = typeof tx.cardId === "string" ? tx.cardId : "";
  if (cardId) {
    const byId = cards.find((card) => card.id === cardId);
    if (byId) return byId;
  }
  const cardLabel = String(tx.cardLabel || "").toLowerCase();
  if (!cardLabel) return null;
  return cards.find((card) => {
    const bank = card.bankName.toLowerCase();
    return bank && card.last4 && cardLabel.includes(bank) && cardLabel.includes(card.last4);
  }) || null;
}

export async function computeCreditCardSummary(uid: string, limit: number): Promise<CreditCardSummary> {
  const snapshot = await adminDb
    .collection("users")
    .doc(uid)
    .collection("transactions")
    .where("paymentMethod", "==", "credit_card")
    .where("type", "==", "expense")
    .where("status", "==", "pending")
    .get();

  let used = 0;
  let trackedCount = 0;
  let untrackedCount = 0;

  snapshot.docs.forEach((docSnap) => {
    const tx = docSnap.data() as Record<string, unknown>;
    const amount = readAmountForLimit(tx);
    if (amount === null) {
      untrackedCount += 1;
      return;
    }
    used += amount;
    trackedCount += 1;
  });

  const safeLimit = Math.max(0, Number(limit || 0));
  const available = safeLimit - used;
  const usagePct = safeLimit <= 0 ? 0 : (used / safeLimit) * 100;
  const isExceeded = safeLimit > 0 && used > safeLimit;

  return {
    used,
    available,
    usagePct,
    isExceeded,
    pendingCount: snapshot.size,
    trackedCount,
    untrackedCount,
  };
}

export async function enforceCreditCardPolicy(uid: string) {
  const [settings, cardsSnapshot, pendingCreditSnapshot] = await Promise.all([
    getCreditCardSettings(uid),
    adminDb.collection("users").doc(uid).collection("payment_cards").get(),
    adminDb
      .collection("users")
      .doc(uid)
      .collection("transactions")
      .where("paymentMethod", "==", "credit_card")
      .where("type", "==", "expense")
      .where("status", "==", "pending")
      .get(),
  ]);
  const cards = cardsSnapshot.docs.map((docSnap) =>
    toPaymentCardPolicyDoc(docSnap.id, docSnap.data() as Record<string, unknown>)
  );
  const creditCards = cards.filter((card) => isCreditCapable(card.type));

  const perCardUsed = new Map<string, number>();
  let trackedCount = 0;
  let untrackedCount = 0;
  let totalUsed = 0;

  pendingCreditSnapshot.docs.forEach((docSnap) => {
    const tx = docSnap.data() as Record<string, unknown>;
    const amount = readAmountForLimit(tx);
    if (amount === null) {
      untrackedCount += 1;
      return;
    }
    const linkedCard = mapTxToCard(tx, creditCards);
    if (!linkedCard) {
      untrackedCount += 1;
      return;
    }
    trackedCount += 1;
    totalUsed += amount;
    perCardUsed.set(linkedCard.id, (perCardUsed.get(linkedCard.id) || 0) + amount);
  });

  const perCard: Record<string, unknown> = {};
  const exceededCardIds: string[] = [];
  let totalLimit = 0;

  creditCards.forEach((card) => {
    const cardUsed = perCardUsed.get(card.id) || 0;
    const cardLimit = Math.max(0, Number(card.creditLimit ?? settings.limit ?? 0));
    const cardEnabled = Boolean(card.limitEnabled ?? settings.enabled);
    const cardAlertThreshold = clampNumber(card.alertThresholdPct ?? settings.alertThresholdPct, 1, 100, 80);
    const cardBlockOnExceeded = false;
    const cardIsExceeded = cardLimit > 0 && cardUsed > cardLimit;
    const cardAvailable = cardLimit - cardUsed;
    const cardUsagePct = cardLimit <= 0 ? 0 : (cardUsed / cardLimit) * 100;
    totalLimit += cardLimit;

    if (cardEnabled && cardIsExceeded) {
      exceededCardIds.push(card.id);
    }

    perCard[card.id] = {
      cardId: card.id,
      bankName: card.bankName,
      last4: card.last4,
      used: cardUsed,
      limit: cardLimit,
      available: cardAvailable,
      usagePct: cardUsagePct,
      isExceeded: cardIsExceeded,
      enabled: cardEnabled,
      alertThresholdPct: cardAlertThreshold,
      blockOnLimitExceeded: cardBlockOnExceeded,
    };
  });

  const summary: CreditCardSummary = {
    used: totalUsed,
    available: totalLimit - totalUsed,
    usagePct: totalLimit <= 0 ? 0 : (totalUsed / totalLimit) * 100,
    isExceeded: exceededCardIds.length > 0,
    pendingCount: pendingCreditSnapshot.size,
    trackedCount,
    untrackedCount,
  };

  const patch: Record<string, unknown> = {
    creditCardMeta: {
      used: summary.used,
      available: summary.available,
      usagePct: summary.usagePct,
      isExceeded: summary.isExceeded,
      pendingCount: summary.pendingCount,
      trackedCount: summary.trackedCount,
      untrackedCount: summary.untrackedCount,
      exceededCardIds,
      perCard,
      lastEvaluatedAt: new Date().toISOString(),
    },
  };

  await adminDb.collection("users").doc(uid).set(patch, { merge: true });
  return { settings, summary };
}
