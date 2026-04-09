import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { MAX_FINANCIAL_AMOUNT } from "@/lib/money";
import { PiggyBankGoalType } from "@/types/piggyBank";
import { enforceCreditCardPolicy } from "@/lib/credit-card/limit";
import { filterActiveJsonRows } from "@/lib/account-archive/server";
import { encryptDataForUser } from "@/lib/crypto-server";
import { readSecureCardPayload, writeSecureCardPayload } from "@/lib/secure-store/payment-cards";
import {
  readSecurePiggyHistoryPayload,
  readSecurePiggyPayload,
  writeSecurePiggyHistoryPayload,
  writeSecurePiggyPayload,
} from "@/lib/secure-store/piggy-banks";
import { supabaseDeleteByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function sanitizeText(value: unknown, max = 120) {
  return String(value || "").trim().slice(0, max);
}

function sanitizeMoney(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_FINANCIAL_AMOUNT);
}

function buildPiggyBankResponse(
  piggy: Record<string, unknown>,
  historyRows: Record<string, unknown>[],
  safeSlug: string
) {
  const piggyRaw = readSecurePiggyPayload(piggy.raw);
  const history = historyRows
    .map((row) => {
      const entry = readSecurePiggyHistoryPayload(row.raw);
      return {
        id: String(row.source_id || row.id || ""),
        piggyBankId: safeSlug,
        amount: Number(row.amount || entry.amount || 0),
        withdrawalMode:
          typeof row.withdrawal_mode === "string"
            ? row.withdrawal_mode
            : typeof entry.withdrawalMode === "string"
              ? entry.withdrawalMode
              : undefined,
        yieldType:
          typeof row.yield_type === "string"
            ? row.yield_type
            : typeof entry.yieldType === "string"
              ? entry.yieldType
              : undefined,
        sourceType: row.source_type === "cash" || entry.sourceType === "cash" ? "cash" : "bank",
        cardId: typeof row.card_id === "string" ? row.card_id : typeof entry.cardId === "string" ? entry.cardId : undefined,
        cardLabel:
          typeof row.card_label === "string"
            ? row.card_label
            : typeof entry.cardLabel === "string"
              ? entry.cardLabel
              : undefined,
        appliedToCardLimit: Boolean(row.applied_to_card_limit ?? entry.appliedToCardLimit),
        createdAt:
          typeof row.created_at === "string"
            ? row.created_at
            : typeof entry.createdAt === "string"
              ? entry.createdAt
              : undefined,
      };
    })
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  return {
    id: String(piggy.source_id || piggy.id || ""),
    slug: String(piggy.slug || piggyRaw.slug || safeSlug),
    name: String(piggy.name || piggyRaw.name || "Cofrinho"),
    goalType: sanitizeGoalType(piggy.goal_type || piggyRaw.goalType),
    totalSaved: Number(piggy.total_saved || piggyRaw.totalSaved || 0),
    withdrawalMode:
      typeof piggy.withdrawal_mode === "string"
        ? piggy.withdrawal_mode
        : typeof piggyRaw.withdrawalMode === "string"
          ? piggyRaw.withdrawalMode
          : undefined,
    yieldType:
      typeof piggy.yield_type === "string"
        ? piggy.yield_type
        : typeof piggyRaw.yieldType === "string"
          ? piggyRaw.yieldType
          : undefined,
    createdAt:
      typeof piggy.created_at === "string"
        ? piggy.created_at
        : typeof piggyRaw.createdAt === "string"
          ? piggyRaw.createdAt
          : undefined,
    updatedAt:
      typeof piggy.updated_at === "string"
        ? piggy.updated_at
        : typeof piggyRaw.updatedAt === "string"
          ? piggyRaw.updatedAt
          : undefined,
    lastDepositAt: typeof piggyRaw.lastDepositAt === "string" ? piggyRaw.lastDepositAt : undefined,
    history,
  };
}

async function loadPiggyBank(uid: string, safeSlug: string) {
  const piggyRows = await supabaseSelect("piggy_banks", {
    filters: { uid, source_id: safeSlug },
    limit: 1,
  });
  const activePiggyRows = filterActiveJsonRows(piggyRows);
  if (activePiggyRows.length === 0) {
    return null;
  }

  const piggy = activePiggyRows[0];
  const historyRows = filterActiveJsonRows(await supabaseSelect("piggy_bank_history", {
    filters: { uid, piggy_bank_id: String(piggy.id) },
    order: "created_at.desc.nullslast",
  }));

  return {
    piggy,
    historyRows,
    detail: buildPiggyBankResponse(piggy, historyRows, safeSlug),
  };
}

async function applyCardLimitAdjustment(
  uid: string,
  cardId: string,
  amountDelta: number,
  nowIso: string
) {
  if (!cardId || amountDelta === 0) return;
  const cardRows = await supabaseSelect("payment_cards", {
    filters: { uid, source_id: cardId },
    limit: 1,
  });
  if (cardRows.length === 0) return;

  const cardRow = cardRows[0];
  const cardRaw = readSecureCardPayload(cardRow.raw);
  const currentLimit = Number(cardRow.credit_limit || cardRaw.creditLimit || 0);
  const nextLimit = Math.max(0, currentLimit + amountDelta);
  const bankName = String(cardRow.bank_name || cardRaw.bankName || "Cartao");
  const last4 = String(cardRow.last4 || cardRaw.last4 || "");

  cardRaw.creditLimit = nextLimit;
  cardRaw.limitEnabled = nextLimit > 0;
  cardRaw.updatedAt = nowIso;

  await supabaseUpsertRows(
    "payment_cards",
    [
      {
        id: cardRow.id,
        uid,
        source_id: cardId,
        bank_name: bankName,
        last4,
        card_type: cardRow.card_type || cardRaw.type || "credit_card",
        credit_limit: nextLimit,
        limit_enabled: nextLimit > 0,
        raw: writeSecureCardPayload(cardRaw),
        updated_at: nowIso,
      },
    ],
    { onConflict: "id" }
  );
}

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { actingUid } = await resolveActingContext(_request);
    const { slug } = await context.params;
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }

    const loaded = await loadPiggyBank(actingUid, safeSlug);
    if (!loaded) {
      return NextResponse.json({ ok: false, error: "piggy_bank_not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, piggyBank: loaded.detail }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "piggy-banks:update",
      actionLabel: "Atualizar porquinho",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const { slug } = await context.params;
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }

    const loaded = await loadPiggyBank(acting.actingUid, safeSlug);
    if (!loaded) {
      return NextResponse.json({ ok: false, error: "piggy_bank_not_found" }, { status: 404 });
    }

    const body = (await request.json()) as {
      action?: "edit" | "adjustBalance";
      name?: string;
      withdrawalMode?: string;
      yieldType?: string;
      amount?: number;
      direction?: "deposit" | "withdraw";
      sourceType?: "bank" | "cash";
    };

    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const piggyRaw = readSecurePiggyPayload(loaded.piggy.raw);
    const currentName = String(loaded.piggy.name || piggyRaw.name || loaded.detail.name || "Cofrinho");

    if (body.action === "edit") {
      const nextName = sanitizeText(body.name, 80) || currentName;
      const withdrawalMode = sanitizeText(body.withdrawalMode, 120);
      const yieldType = sanitizeText(body.yieldType, 120);
      const mergedRaw: Record<string, unknown> = {
        ...piggyRaw,
        name: nextName,
        ...(withdrawalMode ? { withdrawalMode } : { withdrawalMode: "" }),
        ...(yieldType ? { yieldType } : { yieldType: "" }),
        updatedAt: nowIso,
      };

      await supabaseUpsertRows(
        "piggy_banks",
        [
          {
            id: loaded.piggy.id,
            uid: acting.actingUid,
            source_id: safeSlug,
            slug: safeSlug,
            name: nextName,
            goal_type: loaded.piggy.goal_type || piggyRaw.goalType || loaded.detail.goalType,
            total_saved: loaded.detail.totalSaved,
            withdrawal_mode: withdrawalMode || null,
            yield_type: yieldType || null,
            raw: writeSecurePiggyPayload(mergedRaw),
            created_at: loaded.piggy.created_at || nowIso,
            updated_at: nowIso,
          },
        ],
        { onConflict: "id" }
      );

      const refreshed = await loadPiggyBank(acting.actingUid, safeSlug);
      return NextResponse.json({ ok: true, piggyBank: refreshed?.detail }, { status: 200 });
    }

    if (body.action === "adjustBalance") {
      const amount = sanitizeMoney(body.amount);
      const direction = body.direction === "withdraw" ? "withdraw" : "deposit";
      const sourceType = body.sourceType === "cash" ? "cash" : "bank";
      if (!amount) {
        return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
      }
      if (direction === "withdraw" && amount > loaded.detail.totalSaved) {
        return NextResponse.json({ ok: false, error: "insufficient_piggy_balance" }, { status: 400 });
      }

      const amountDelta = direction === "withdraw" ? -amount : amount;
      const nextTotal = loaded.detail.totalSaved + amountDelta;
      const linkedHistoryEntry = loaded.detail.history.find((entry) => entry.appliedToCardLimit && entry.cardId);
      const linkedCardId =
        (typeof piggyRaw.cardId === "string" && piggyRaw.cardId) ||
        linkedHistoryEntry?.cardId ||
        "";
      const linkedCardLabel =
        (typeof piggyRaw.cardLabel === "string" && piggyRaw.cardLabel) ||
        linkedHistoryEntry?.cardLabel ||
        undefined;
      const shouldAdjustCard = loaded.detail.goalType === "card_limit" && Boolean(linkedCardId);

      if (shouldAdjustCard) {
        await applyCardLimitAdjustment(acting.actingUid, linkedCardId, amountDelta, nowIso);
      }

      const mergedRaw: Record<string, unknown> = {
        ...piggyRaw,
        totalSaved: nextTotal,
        updatedAt: nowIso,
        ...(direction === "deposit" ? { lastDepositAt: nowIso } : {}),
        ...(linkedCardId ? { cardId: linkedCardId } : {}),
        ...(linkedCardLabel ? { cardLabel: linkedCardLabel } : {}),
      };

      await supabaseUpsertRows(
        "piggy_banks",
        [
          {
            id: loaded.piggy.id,
            uid: acting.actingUid,
            source_id: safeSlug,
            slug: safeSlug,
            name: currentName,
            goal_type: loaded.piggy.goal_type || piggyRaw.goalType || loaded.detail.goalType,
            total_saved: nextTotal,
            withdrawal_mode: loaded.detail.withdrawalMode || null,
            yield_type: loaded.detail.yieldType || null,
            raw: writeSecurePiggyPayload(mergedRaw),
            created_at: loaded.piggy.created_at || nowIso,
            updated_at: nowIso,
          },
        ],
        { onConflict: "id" }
      );

      const historyId = crypto.randomUUID();
      const historyRaw = {
        piggyBankId: safeSlug,
        amount,
        sourceType,
        ...(loaded.detail.withdrawalMode ? { withdrawalMode: loaded.detail.withdrawalMode } : {}),
        ...(loaded.detail.yieldType ? { yieldType: loaded.detail.yieldType } : {}),
        ...(linkedCardId ? { cardId: linkedCardId } : {}),
        ...(linkedCardLabel ? { cardLabel: linkedCardLabel } : {}),
        appliedToCardLimit: shouldAdjustCard,
        adjustmentDirection: direction,
        createdAt: nowIso,
        createdBy: acting.requesterUid,
      };

      await supabaseUpsertRows("piggy_bank_history", [
        {
          id: historyId,
          piggy_bank_id: loaded.piggy.id,
          uid: acting.actingUid,
          source_id: historyId,
          amount,
          withdrawal_mode: loaded.detail.withdrawalMode || null,
          yield_type: loaded.detail.yieldType || null,
          source_type: sourceType,
          card_id: linkedCardId || null,
          card_label: linkedCardLabel || null,
          applied_to_card_limit: shouldAdjustCard,
          raw: writeSecurePiggyHistoryPayload(historyRaw),
          created_at: nowIso,
        },
      ]);

      const txId = crypto.randomUUID();
      const txDescription = direction === "withdraw" ? `Resgate do Cofrinho: ${currentName}` : `Aporte no Cofrinho: ${currentName}`;
      const encryptedDescription = encryptDataForUser(txDescription, acting.actingUid);
      const encryptedAmount = encryptDataForUser(amount, acting.actingUid);
      const txRaw = {
        userId: acting.actingUid,
        piggyBankSlug: safeSlug,
        description: encryptedDescription,
        amount: encryptedAmount,
        amountForLimit: amount,
        type: direction === "withdraw" ? "income" : "expense",
        category: `Cofrinho > ${currentName}`,
        status: "paid",
        paymentMethod: sourceType === "cash" ? "cash" : "transfer",
        date: today,
        dueDate: today,
        isEncrypted: true,
        isArchived: false,
        ...(linkedCardId ? { cardId: linkedCardId } : {}),
        ...(linkedCardLabel ? { cardLabel: linkedCardLabel } : {}),
        ...(shouldAdjustCard ? { cardType: "credit_card" } : {}),
        createdAt: nowIso,
      };

      await supabaseUpsertRows("transactions", [
        {
          id: `${acting.actingUid}__${txId}`,
          uid: acting.actingUid,
          source_id: txId,
          description: encryptedDescription,
          amount,
          amount_text: encryptedAmount,
          amount_for_limit: shouldAdjustCard ? amount : null,
          tx_type: direction === "withdraw" ? "income" : "expense",
          category: txRaw.category,
          tx_status: "paid",
          payment_method: txRaw.paymentMethod,
          card_id: linkedCardId || null,
          card_label: linkedCardLabel || null,
          card_type: shouldAdjustCard ? "credit_card" : null,
          tx_date: today,
          due_date: today,
          raw: txRaw,
          created_at: nowIso,
        },
      ]);

      await enforceCreditCardPolicy(acting.actingUid);
      const refreshed = await loadPiggyBank(acting.actingUid, safeSlug);
      return NextResponse.json({ ok: true, piggyBank: refreshed?.detail }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "piggy-banks:delete",
      actionLabel: "Excluir porquinho",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const { slug } = await context.params;
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }

    const loaded = await loadPiggyBank(acting.actingUid, safeSlug);
    if (!loaded) {
      return NextResponse.json({ ok: false, error: "piggy_bank_not_found" }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const linkedAmountsByCard = new Map<string, number>();
    for (const entry of loaded.detail.history) {
      if (!entry.appliedToCardLimit || !entry.cardId) continue;
      const current = linkedAmountsByCard.get(entry.cardId) || 0;
      const direction = ((loaded.historyRows.find((row) => String(row.source_id || row.id || "") === entry.id)?.raw as Record<string, unknown> | null) ?? {}).adjustmentDirection === "withdraw" ? -1 : 1;
      linkedAmountsByCard.set(entry.cardId, current + entry.amount * direction);
    }

    for (const [cardId, amount] of linkedAmountsByCard.entries()) {
      if (!amount) continue;
      await applyCardLimitAdjustment(acting.actingUid, cardId, -amount, nowIso);
    }

    const candidateTransactions = await supabaseSelect("transactions", {
      select: "id,source_id,description,category,raw",
      filters: { uid: acting.actingUid },
      conditions: {
        category: `eq.${encodeURIComponent(`Cofrinho > ${loaded.detail.name}`)}`,
      },
    });

    const piggyTransactions = candidateTransactions.filter((row) => {
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      const rawSlug = typeof raw.piggyBankSlug === "string" ? raw.piggyBankSlug : "";
      const description = String(row.description || "");
      if (rawSlug === safeSlug) return true;
      return description === `Aporte no Cofrinho: ${loaded.detail.name}` || description === `Resgate do Cofrinho: ${loaded.detail.name}`;
    });

    for (const tx of piggyTransactions) {
      await supabaseDeleteByFilters("transactions", {
        uid: acting.actingUid,
        source_id: String(tx.source_id || ""),
      });
    }

    for (const row of loaded.historyRows) {
      await supabaseDeleteByFilters("piggy_bank_history", {
        uid: acting.actingUid,
        source_id: String(row.source_id || ""),
      });
    }

    await supabaseDeleteByFilters("piggy_banks", {
      uid: acting.actingUid,
      source_id: safeSlug,
    });

    await enforceCreditCardPolicy(acting.actingUid);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
