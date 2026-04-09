import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { CreditCardSettings, CreditCardSummary } from "@/types/creditCard";
import { readSecureSettingData, writeSecureSettingData } from "@/lib/secure-store/user-settings";
import { readSecureCardPayload } from "@/lib/secure-store/payment-cards";

export const defaultCreditCardSettings: CreditCardSettings = {
  enabled: false,
  cardName: "Cartao principal",
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

async function getFinanceSettingRow(uid: string) {
  const rows = await supabaseSelect("user_settings", {
    select: "id,data",
    filters: { uid, setting_key: "creditCard" },
    limit: 1,
  });
  return rows[0];
}

export async function getCreditCardSettings(uid: string): Promise<CreditCardSettings> {
  const row = await getFinanceSettingRow(uid);
  if (!row) return defaultCreditCardSettings;
  const data = readSecureSettingData<Partial<CreditCardSettings>>(row.data);
  return sanitizeSettings(data);
}

export async function saveCreditCardSettings(uid: string, patch: Partial<CreditCardSettings>): Promise<CreditCardSettings> {
  const current = await getCreditCardSettings(uid);
  const next = sanitizeSettings({
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  });

  const row = await getFinanceSettingRow(uid);
  await supabaseUpsertRows(
    "user_settings",
    [
      {
        id: String(row?.id || `${uid}__creditCard`),
        uid,
        setting_key: "creditCard",
        data: writeSecureSettingData(next),
        updated_at: new Date().toISOString(),
      },
    ],
    { onConflict: "id" }
  );
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

function toPaymentCardPolicyDoc(row: Record<string, unknown>): PaymentCardPolicyDoc {
  const raw = readSecureCardPayload(row.raw);
  const type =
    row.card_type === "debit_card" || row.card_type === "credit_and_debit"
      ? row.card_type
      : raw.type === "debit_card" || raw.type === "credit_and_debit"
        ? (raw.type as PaymentCardPolicyDoc["type"])
        : "credit_card";
  return {
    id: String(row.source_id || ""),
    bankName: String(row.bank_name || raw.bankName || ""),
    last4: String(row.last4 || raw.last4 || ""),
    type,
    limitEnabled:
      row.limit_enabled === undefined || row.limit_enabled === null
        ? (raw.limitEnabled as boolean | undefined)
        : Boolean(row.limit_enabled),
    creditLimit:
      typeof row.credit_limit === "number"
        ? row.credit_limit
        : typeof raw.creditLimit === "number"
          ? raw.creditLimit
          : undefined,
    alertThresholdPct:
      typeof row.alert_threshold_pct === "number"
        ? row.alert_threshold_pct
        : typeof raw.alertThresholdPct === "number"
          ? raw.alertThresholdPct
          : undefined,
    blockOnLimitExceeded:
      row.block_on_limit_exceeded === undefined || row.block_on_limit_exceeded === null
        ? (raw.blockOnLimitExceeded as boolean | undefined)
        : Boolean(row.block_on_limit_exceeded),
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
  return (
    cards.find((card) => {
      const bank = card.bankName.toLowerCase();
      return bank && card.last4 && cardLabel.includes(bank) && cardLabel.includes(card.last4);
    }) || null
  );
}

async function getPendingCreditTransactions(uid: string) {
  const rows = await supabaseSelect("transactions", {
    select: "source_id,tx_type,tx_status,payment_method,raw",
    filters: { uid },
  });

  return rows
    .map((row) => ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>)
    .filter(
      (tx) => tx.paymentMethod === "credit_card" && tx.type === "expense" && tx.status === "pending"
    );
}

export async function computeCreditCardSummary(uid: string, limit: number): Promise<CreditCardSummary> {
  const txs = await getPendingCreditTransactions(uid);

  let used = 0;
  let trackedCount = 0;
  let untrackedCount = 0;

  txs.forEach((tx) => {
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
    pendingCount: txs.length,
    trackedCount,
    untrackedCount,
  };
}

export async function enforceCreditCardPolicy(uid: string) {
  const [settings, cardRows, pendingTxs] = await Promise.all([
    getCreditCardSettings(uid),
    supabaseSelect("payment_cards", {
      select: "source_id,bank_name,last4,card_type,limit_enabled,credit_limit,alert_threshold_pct,block_on_limit_exceeded,raw",
      filters: { uid },
    }),
    getPendingCreditTransactions(uid),
  ]);

  const cards = cardRows.map((row) => toPaymentCardPolicyDoc(row));
  const creditCards = cards.filter((card) => isCreditCapable(card.type));

  const perCardUsed = new Map<string, number>();
  let trackedCount = 0;
  let untrackedCount = 0;
  let totalUsed = 0;

  pendingTxs.forEach((tx) => {
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
    pendingCount: pendingTxs.length,
    trackedCount,
    untrackedCount,
  };

  const rows = await supabaseSelect("profiles", {
    select: "uid,raw",
    filters: { uid },
    limit: 1,
  });
  if (rows.length > 0) {
    const raw = ((rows[0].raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    raw.creditCardMeta = {
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
    };

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          raw,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );
  }

  return { settings, summary };
}

