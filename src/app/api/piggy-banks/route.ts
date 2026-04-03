import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { PiggyBankGoalType } from "@/types/piggyBank";
import { enforceCreditCardPolicy } from "@/lib/credit-card/limit";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

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
  if (goalType === "card_limit") return "Cofrinho do Cartao";
  if (goalType === "emergency_reserve") return "Reserva de Emergencia";
  if (goalType === "travel") return "Fazer uma Viagem";
  if (goalType === "home_renovation") return "Reformar a Casa";
  if (goalType === "dream_purchase") return "Sonho de Consumo";
  return "Novo Objetivo";
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const rows = await supabaseSelect("piggy_banks", {
      select: "source_id,slug,name,goal_type,total_saved,withdrawal_mode,yield_type,created_at,updated_at,raw",
      filters: { uid: actingUid },
      order: "updated_at.desc.nullslast",
    });

    const piggyBanks = rows.map((row) => {
      const raw = (row.raw as Record<string, unknown> | null) ?? {};
      return {
        id: String(row.source_id || ""),
        slug: String(row.slug || raw.slug || row.source_id || ""),
        name: String(row.name || raw.name || "Cofrinho"),
        goalType: sanitizeGoalType(row.goal_type || raw.goalType),
        totalSaved: Number(row.total_saved || raw.totalSaved || 0),
        createdAt: String(row.created_at || raw.createdAt || ""),
        updatedAt: String(row.updated_at || raw.updatedAt || ""),
        lastDepositAt: typeof raw.lastDepositAt === "string" ? raw.lastDepositAt : null,
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

    let cardLabel: string | undefined;
    if (goalType === "card_limit" && cardId) {
      const cardRows = await supabaseSelect("payment_cards", {
        filters: { uid, source_id: cardId },
        limit: 1,
      });
      if (cardRows.length === 0) {
        return NextResponse.json({ ok: false, error: "card_not_found" }, { status: 404 });
      }

      const cardRow = cardRows[0];
      const cardRaw = (cardRow.raw as Record<string, unknown> | null) ?? {};
      const bankName = String(cardRow.bank_name || cardRaw.bankName || "Cartao");
      const last4 = String(cardRow.last4 || cardRaw.last4 || "");
      const currentLimit = Number(cardRow.credit_limit || cardRaw.creditLimit || 0);
      const nextLimit = currentLimit + amount;

      cardLabel = `${bankName} •••• ${last4}`;
      cardRaw.creditLimit = nextLimit;
      cardRaw.limitEnabled = true;
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
            limit_enabled: true,
            raw: cardRaw,
            updated_at: nowIso,
          },
        ],
        { onConflict: "id" }
      );
    }

    const piggyRows = await supabaseSelect("piggy_banks", {
      filters: { uid, source_id: slug },
      limit: 1,
    });

    const piggyRaw = ((piggyRows[0]?.raw as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
    const currentTotal = Number(piggyRows[0]?.total_saved || piggyRaw.totalSaved || 0);
    const nextTotal = currentTotal + amount;

    const mergedPiggyRaw: Record<string, unknown> = {
      ...piggyRaw,
      slug,
      name: goalName,
      goalType,
      totalSaved: nextTotal,
      ...(cardId ? { cardId } : {}),
      ...(cardLabel ? { cardLabel } : {}),
      ...(withdrawalMode ? { withdrawalMode } : {}),
      ...(yieldType ? { yieldType } : {}),
      lastDepositAt: nowIso,
      createdAt: String(piggyRaw.createdAt || nowIso),
      updatedAt: nowIso,
      createdBy: acting.requesterUid,
    };

    const piggyId = String(piggyRows[0]?.id || `${uid}__${slug}`);
    await supabaseUpsertRows(
      "piggy_banks",
      [
        {
          id: piggyId,
          uid,
          source_id: slug,
          slug,
          name: goalName,
          goal_type: goalType,
          total_saved: nextTotal,
          withdrawal_mode: withdrawalMode || null,
          yield_type: yieldType || null,
          raw: mergedPiggyRaw,
          created_at: piggyRows[0]?.created_at || nowIso,
          updated_at: nowIso,
        },
      ],
      { onConflict: "id" }
    );

    const historyId = crypto.randomUUID();
    const historyRaw = {
      piggyBankId: slug,
      amount,
      sourceType,
      ...(withdrawalMode ? { withdrawalMode } : {}),
      ...(yieldType ? { yieldType } : {}),
      ...(cardId ? { cardId } : {}),
      ...(cardLabel ? { cardLabel } : {}),
      appliedToCardLimit: goalType === "card_limit",
      createdAt: nowIso,
      createdBy: acting.requesterUid,
    };

    await supabaseUpsertRows("piggy_bank_history", [
      {
        id: historyId,
        piggy_bank_id: piggyId,
        uid,
        source_id: historyId,
        amount,
        withdrawal_mode: withdrawalMode || null,
        yield_type: yieldType || null,
        source_type: sourceType,
        card_id: cardId || null,
        card_label: cardLabel || null,
        applied_to_card_limit: goalType === "card_limit",
        raw: historyRaw,
        created_at: nowIso,
      },
    ]);

    const txId = crypto.randomUUID();
    const txRaw = {
      userId: uid,
      piggyBankSlug: slug,
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
      createdAt: nowIso,
    };

    await supabaseUpsertRows("transactions", [
      {
        id: `${uid}__${txId}`,
        uid,
        source_id: txId,
        description: txRaw.description,
        amount,
        amount_text: String(amount),
        amount_for_limit: amount,
        tx_type: "expense",
        category: txRaw.category,
        tx_status: "paid",
        payment_method: txRaw.paymentMethod,
        card_id: cardId || null,
        card_label: cardLabel || null,
        card_type: goalType === "card_limit" ? "credit_card" : null,
        tx_date: today,
        due_date: today,
        raw: txRaw,
        created_at: nowIso,
      },
    ]);

    const profileRows = await supabaseSelect("profiles", {
      select: "uid,transaction_count,raw",
      filters: { uid },
      limit: 1,
    });
    if (profileRows.length > 0) {
      const profileRaw = ((profileRows[0].raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const nextCount = Number(profileRows[0].transaction_count || profileRaw.transactionCount || 0) + 1;
      profileRaw.transactionCount = nextCount;
      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid,
            transaction_count: nextCount,
            raw: profileRaw,
            updated_at: nowIso,
          },
        ],
        { onConflict: "uid" }
      );
    }

    await enforceCreditCardPolicy(uid);

    return NextResponse.json({ ok: true, slug }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

