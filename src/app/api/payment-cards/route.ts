import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { PaymentCard, PaymentCardType } from "@/types/paymentCard";
import { resolveApiErrorStatus } from "@/lib/api/error";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseUpsertRows,
} from "@/services/supabase/admin";

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
  return Number.isInteger(num) && num >= 1 && num <= 31 ? num : null;
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

function toCardRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    source_id: sourceId,
    bank_name: data.bankName ?? null,
    last4: data.last4 ?? null,
    card_type: data.type ?? null,
    brand: data.brand ?? null,
    bin: data.bin ?? null,
    due_date: sanitizeDueDate(data.dueDate),
    limit_enabled: data.limitEnabled == null ? null : Boolean(data.limitEnabled),
    credit_limit: sanitizeCurrency(data.creditLimit),
    alert_threshold_pct: sanitizePercent(data.alertThresholdPct),
    block_on_limit_exceeded:
      data.blockOnLimitExceeded == null ? null : Boolean(data.blockOnLimitExceeded),
    raw: data,
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updated_at: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

function toClientCard(row: Record<string, unknown>): PaymentCard {
  const raw = (row.raw as Record<string, unknown> | null) ?? null;
  return {
    id: String(row.source_id || ""),
    bankName: String(row.bank_name || raw?.bankName || ""),
    last4: String(row.last4 || raw?.last4 || ""),
    type: sanitizeType(row.card_type ?? raw?.type),
    brand: sanitizeBrand(row.brand ?? raw?.brand) || undefined,
    bin: sanitizeBin(row.bin ?? raw?.bin) || undefined,
    dueDate: sanitizeDueDate(row.due_date ?? raw?.dueDate) || undefined,
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

async function getCards(uid: string) {
  return supabaseSelect("payment_cards", {
    select:
      "source_id,bank_name,last4,card_type,brand,bin,due_date,limit_enabled,credit_limit,alert_threshold_pct,block_on_limit_exceeded,created_at,updated_at,raw",
    filters: { uid },
    order: "updated_at.desc.nullslast",
  });
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid } = await resolveActingContext(request);
    const rows = await getCards(actingUid);
    const cards = rows.map(toClientCard);

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
  try {
    const acting = await resolveActingContext(request);
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "payment-cards:create",
      actionLabel: "Cadastrar cartao",
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
    const cardId = crypto.randomUUID();
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
    };

    await supabaseUpsertRows("payment_cards", [toCardRow(acting.actingUid, cardId, payloadData)], {
      onConflict: "id",
    });

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
      actionLabel: "Editar cartao",
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

    const rows = await getCards(acting.actingUid);
    const existing = rows.find((row) => String(row.source_id || "") === body.cardId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "card_not_found" }, { status: 404 });
    }

    const raw = ((existing.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
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

    await supabaseUpsertRows("payment_cards", [toCardRow(acting.actingUid, body.cardId, merged)], {
      onConflict: "id",
    });

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
      actionLabel: "Excluir cartao",
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

    await supabaseDeleteByFilters("payment_cards", { uid: acting.actingUid, source_id: cardId });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

