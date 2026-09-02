import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { buildPlanLimitMessage, getPlanCapabilities } from "@/lib/plans/capabilities";
import { getUserPlanContext } from "@/lib/plans/server";
import { hasAccess } from "@/lib/access-control/config";
import { MAX_FINANCIAL_AMOUNT } from "@/lib/money";
import { filterActiveJsonRows } from "@/lib/account-archive/server";
import { readSecureCardPayload, writeSecureCardPayload } from "@/lib/secure-store/payment-cards";
import { PaymentCard, PaymentCardType } from "@/types/paymentCard";
import { resolveApiErrorStatus } from "@/lib/api/error";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseUpsertRows,
} from "@/services/supabase/admin";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";
import { canManageFamilyCard, canViewFamilyCard } from "@/lib/workspaces/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CARD_SELECT_WITH_WORKSPACE =
  "source_id,workspace_id,bank_name,last4,card_type,brand,bin,due_date,closing_day,limit_enabled,credit_limit,alert_threshold_pct,block_on_limit_exceeded,created_at,updated_at,raw";
const CARD_SELECT_LEGACY =
  "source_id,bank_name,last4,card_type,brand,bin,due_date,closing_day,limit_enabled,credit_limit,alert_threshold_pct,block_on_limit_exceeded,created_at,updated_at,raw";

function isMissingWorkspaceColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("workspace_id") || message.includes("PGRST204");
}

function withoutWorkspaceColumn(row: Record<string, unknown>) {
  const { workspace_id: _workspaceId, ...legacyRow } = row;
  void _workspaceId;
  return legacyRow;
}

async function upsertCardRows(rows: Array<Record<string, unknown>>) {
  try {
    await supabaseUpsertRows("payment_cards", rows, { onConflict: "id" });
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    await supabaseUpsertRows("payment_cards", rows.map(withoutWorkspaceColumn), { onConflict: "id" });
  }
}

function getRowWorkspaceId(row: Record<string, unknown>) {
  const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const secureRaw = readSecureCardPayload(row.raw) || {};
  return String(row.workspace_id || raw.workspaceId || secureRaw.workspaceId || "");
}

function getRowCreatedByUid(row: Record<string, unknown>) {
  const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const secureRaw = readSecureCardPayload(row.raw) || {};
  return String(row.created_by_uid || raw.createdBy || secureRaw.createdBy || "");
}

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
  return Number.isInteger(num) && num >= 1 && num <= 31 ? num : null;
}

function sanitizeCurrency(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.min(num, MAX_FINANCIAL_AMOUNT);
}

const sanitizeClosingDay = sanitizeDueDate;

function sanitizePercent(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(1, num));
}

function toCardRow(uid: string, sourceId: string, data: Record<string, unknown>, workspaceId?: string | null) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    workspace_id: workspaceId || null,
    source_id: sourceId,
    bank_name: data.bankName ?? null,
    last4: data.last4 ?? null,
    card_type: data.type ?? null,
    brand: data.brand ?? null,
    bin: data.bin ?? null,
    due_date: sanitizeDueDate(data.dueDate),
    closing_day: sanitizeClosingDay(data.closingDay),
    limit_enabled: data.limitEnabled == null ? null : Boolean(data.limitEnabled),
    credit_limit: sanitizeCurrency(data.creditLimit),
    alert_threshold_pct: sanitizePercent(data.alertThresholdPct),
    block_on_limit_exceeded:
      data.blockOnLimitExceeded == null ? null : Boolean(data.blockOnLimitExceeded),
    raw: writeSecureCardPayload({ ...data, workspaceId: workspaceId || null }),
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updated_at: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

function toClientCard(row: Record<string, unknown>): PaymentCard {
  const raw = readSecureCardPayload(row.raw);
  return {
    id: String(row.source_id || ""),
    bankName: String(row.bank_name || raw?.bankName || ""),
    last4: String(row.last4 || raw?.last4 || ""),
    type: sanitizeType(row.card_type ?? raw?.type),
    brand: sanitizeBrand(row.brand ?? raw?.brand) || undefined,
    bin: sanitizeBin(row.bin ?? raw?.bin) || undefined,
    dueDate: sanitizeDueDate(row.due_date ?? raw?.dueDate) || undefined,
    closingDay: sanitizeClosingDay(row.closing_day ?? raw?.closingDay) || undefined,
    limitEnabled:
      row.limit_enabled === undefined || row.limit_enabled === null
        ? undefined
        : Boolean(row.limit_enabled),
    creditLimit: sanitizeCurrency(row.credit_limit ?? raw?.creditLimit) || undefined,
    alertThresholdPct: sanitizePercent(row.alert_threshold_pct ?? raw?.alertThresholdPct) || undefined,
    blockOnLimitExceeded:
      row.block_on_limit_exceeded === undefined || row.block_on_limit_exceeded === null
        ? undefined
        : Boolean(row.block_on_limit_exceeded),
    createdAt:
      (typeof row.created_at === "string" ? row.created_at : undefined) ||
      (typeof raw?.createdAt === "string" ? raw.createdAt : undefined),
    updatedAt:
      (typeof row.updated_at === "string" ? row.updated_at : undefined) ||
      (typeof raw?.updatedAt === "string" ? raw.updatedAt : undefined),
  };
}

async function getCards(uid: string, workspaceId?: string | null, includeLegacyRows = true) {
  let rows: Record<string, unknown>[];
  try {
    rows = await supabaseSelect("payment_cards", {
      select: CARD_SELECT_WITH_WORKSPACE,
      filters: { uid },
      order: "updated_at.desc.nullslast",
    });
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    rows = await supabaseSelect("payment_cards", {
      select: CARD_SELECT_LEGACY,
      filters: { uid },
      order: "updated_at.desc.nullslast",
    });
  }
  const activeRows = filterActiveJsonRows(rows);
  if (!workspaceId) return activeRows;
  return activeRows.filter((row) => {
    const rowWorkspaceId = getRowWorkspaceId(row);
    return rowWorkspaceId === workspaceId || (!rowWorkspaceId && includeLegacyRows);
  });
}

async function deleteCard(uid: string, sourceId: string, workspaceId?: string | null) {
  try {
    await supabaseDeleteByFilters(
      "payment_cards",
      workspaceId ? { uid, source_id: sourceId, workspace_id: workspaceId } : { uid, source_id: sourceId }
    );
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    await supabaseDeleteByFilters("payment_cards", { uid, source_id: sourceId });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const workspaceContext = await resolveActiveWorkspaceContext(actingUid, request.nextUrl.searchParams.get("workspaceId"));
    const rows = await getCards(workspaceContext.ownerUid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    const cards = rows
      .filter((row) => canViewFamilyCard(workspaceContext.member, getRowCreatedByUid(row)))
      .map(toClientCard);

    cards.sort((a, b) =>
      String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))
    );
    return NextResponse.json({ ok: true, cards }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const requestLocale = request.headers.get("accept-language")?.split(",")[0];
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

    const body = (await request.json()) as Partial<PaymentCard> & { workspaceId?: string };
    const workspaceContext = await resolveActiveWorkspaceContext(acting.actingUid, body.workspaceId);
    if (!canManageFamilyCard(workspaceContext.member, acting.actingUid)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const uid = workspaceContext.ownerUid;
    const [existingCards, planContext] = await Promise.all([
      getCards(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows),
      getUserPlanContext(uid),
    ]);
    const capabilities = getPlanCapabilities(planContext.plan, planContext.plans, planContext.featureAccess);

    if (
      !planContext.isBillingExempt &&
      !hasAccess(planContext.accessControl, { uid, plan: planContext.plan, role: planContext.role }, "cards.write", "write")
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    if (!planContext.isBillingExempt && capabilities.maxCards !== null && existingCards.length >= capabilities.maxCards) {
      return NextResponse.json(
        {
          ok: false,
          error: buildPlanLimitMessage({
            plan: planContext.plan,
            resourceLabel: "cartão",
            resourcePluralLabel: "cartões",
            max: capabilities.maxCards,
            locale: requestLocale,
            resourceKey: "cards",
          }),
        },
        { status: 403 }
      );
    }

    const bankName = sanitizeBankName(body.bankName);
    const last4 = sanitizeLast4(body.last4);
    const type = sanitizeType(body.type);
    const brand = sanitizeBrand(body.brand);
    const bin = sanitizeBin(body.bin);
    const dueDate = sanitizeDueDate(body.dueDate);
    const closingDay = sanitizeClosingDay(body.closingDay);
    const creditLimit = sanitizeCurrency(body.creditLimit);
    const alertThresholdPct = sanitizePercent(body.alertThresholdPct);
    const limitEnabled = body.limitEnabled === undefined ? undefined : Boolean(body.limitEnabled);
    const blockOnLimitExceeded = body.blockOnLimitExceeded === undefined ? undefined : Boolean(body.blockOnLimitExceeded);

    if (!bankName || last4.length !== 4) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const cardId = crypto.randomUUID();
    const payloadData: Record<string, unknown> = {
      bankName,
      last4,
      type,
      ...(brand ? { brand } : {}),
      ...(bin.length >= 6 ? { bin } : {}),
      ...(type === "credit_card" || type === "credit_and_debit"
        ? {
            ...(dueDate ? { dueDate } : {}),
            ...(closingDay ? { closingDay } : {}),
          }
        : {}),
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
    };

    await upsertCardRows([toCardRow(uid, cardId, payloadData, workspaceContext.workspaceId)]);

    return NextResponse.json({ ok: true, id: cardId }, { status: 200 });
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

    const body = (await request.json()) as { cardId?: string; workspaceId?: string; updates?: Partial<PaymentCard> };
    if (!body.cardId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const workspaceContext = await resolveActiveWorkspaceContext(acting.actingUid, body.workspaceId);
    const uid = workspaceContext.ownerUid;
    const planContext = await getUserPlanContext(uid);
    if (
      !planContext.isBillingExempt &&
        !hasAccess(planContext.accessControl, { uid, plan: planContext.plan, role: planContext.role }, "cards.write", "write")
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const rows = await getCards(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    const existing = rows.find((row) => String(row.source_id || "") === body.cardId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "card_not_found" }, { status: 404 });
    }
    if (!canManageFamilyCard(workspaceContext.member, getRowCreatedByUid(existing))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const raw = readSecureCardPayload(existing.raw);
    const merged: Record<string, unknown> = {
      ...raw,
      updatedAt: new Date().toISOString(),
    };

    if (body.updates.bankName !== undefined) {
      const value = sanitizeBankName(body.updates.bankName);
      if (!value) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      merged.bankName = value;
    }
    if (body.updates.last4 !== undefined) {
      const value = sanitizeLast4(body.updates.last4);
      if (value.length !== 4) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      merged.last4 = value;
    }
    if (body.updates.type !== undefined) merged.type = sanitizeType(body.updates.type);
    if (body.updates.brand !== undefined) {
      const value = sanitizeBrand(body.updates.brand);
      if (value) merged.brand = value;
      else delete merged.brand;
    }
    if (body.updates.bin !== undefined) {
      const value = sanitizeBin(body.updates.bin);
      if (value.length >= 6) merged.bin = value;
      else delete merged.bin;
    }
    if (body.updates.dueDate !== undefined) {
      const value = sanitizeDueDate(body.updates.dueDate);
      if (value) merged.dueDate = value;
      else delete merged.dueDate;
    }
    if (body.updates.closingDay !== undefined) {
      const value = sanitizeClosingDay(body.updates.closingDay);
      if (value) merged.closingDay = value;
      else delete merged.closingDay;
    }
    if (body.updates.creditLimit !== undefined) {
      const value = sanitizeCurrency(body.updates.creditLimit);
      if (value !== null) merged.creditLimit = value;
      else delete merged.creditLimit;
    }
    if (body.updates.alertThresholdPct !== undefined) {
      const value = sanitizePercent(body.updates.alertThresholdPct);
      if (value !== null) merged.alertThresholdPct = value;
      else delete merged.alertThresholdPct;
    }
    if (body.updates.limitEnabled !== undefined) merged.limitEnabled = Boolean(body.updates.limitEnabled);
    if (body.updates.blockOnLimitExceeded !== undefined) {
      merged.blockOnLimitExceeded = Boolean(body.updates.blockOnLimitExceeded);
    }

    await upsertCardRows([toCardRow(uid, body.cardId, merged, workspaceContext.workspaceId)]);

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
    const workspaceContext = await resolveActiveWorkspaceContext(acting.actingUid, request.nextUrl.searchParams.get("workspaceId"));
    const uid = workspaceContext.ownerUid;
    if (!cardId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    const rows = await getCards(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows);
    const existing = rows.find((row) => String(row.source_id || "") === cardId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "card_not_found" }, { status: 404 });
    }
    if (!canManageFamilyCard(workspaceContext.member, getRowCreatedByUid(existing))) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const planContext = await getUserPlanContext(uid);
    if (
      !planContext.isBillingExempt &&
      !hasAccess(planContext.accessControl, { uid, plan: planContext.plan, role: planContext.role }, "cards.delete", "write")
    ) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    await deleteCard(uid, cardId, workspaceContext.workspaceId);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

