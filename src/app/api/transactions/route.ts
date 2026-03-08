import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { enforceCreditCardPolicy } from "@/lib/credit-card/limit";
import { resolveApiErrorStatus } from "@/lib/api/error";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseUpsertRows,
} from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toTxRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    source_id: sourceId,
    description: data.description ?? null,
    amount: asNumber(data.amount),
    amount_text: data.amount == null ? null : String(data.amount),
    amount_for_limit: asNumber(data.amountForLimit),
    tx_type: data.type ?? null,
    category: data.category ?? null,
    tx_status: data.status ?? null,
    payment_method: data.paymentMethod ?? null,
    card_id: data.cardId ?? null,
    card_label: data.cardLabel ?? null,
    card_type: data.cardType ?? null,
    tx_date: typeof data.date === "string" ? data.date : null,
    due_date: typeof data.dueDate === "string" ? data.dueDate : null,
    group_id: data.groupId ?? null,
    installment_current:
      typeof data.installmentCurrent === "number" ? data.installmentCurrent : null,
    installment_total:
      typeof data.installmentTotal === "number" ? data.installmentTotal : null,
    raw: data,
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

function toClientTx(uid: string, row: Record<string, unknown>) {
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return {
    id: String(row.source_id || ""),
    description: row.description ?? raw.description ?? "",
    amount: row.amount_text ?? row.amount ?? raw.amount ?? 0,
    amountForLimit: row.amount_for_limit ?? raw.amountForLimit ?? null,
    type: row.tx_type ?? raw.type ?? "expense",
    category: row.category ?? raw.category ?? "",
    status: row.tx_status ?? raw.status ?? "pending",
    paymentMethod: row.payment_method ?? raw.paymentMethod ?? "cash",
    cardId: row.card_id ?? raw.cardId ?? undefined,
    cardLabel: row.card_label ?? raw.cardLabel ?? undefined,
    cardType: row.card_type ?? raw.cardType ?? undefined,
    date: row.tx_date ?? raw.date ?? null,
    dueDate: row.due_date ?? raw.dueDate ?? undefined,
    groupId: row.group_id ?? raw.groupId ?? undefined,
    installmentCurrent: row.installment_current ?? raw.installmentCurrent ?? undefined,
    installmentTotal: row.installment_total ?? raw.installmentTotal ?? undefined,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    isEncrypted: typeof raw.isEncrypted === "boolean" ? raw.isEncrypted : false,
    isArchived: typeof raw.isArchived === "boolean" ? raw.isArchived : false,
    userId: uid,
  };
}

async function fetchUserTransactions(uid: string) {
  return supabaseSelect("transactions", {
    select:
      "source_id,description,amount,amount_text,amount_for_limit,tx_type,category,tx_status,payment_method,card_id,card_label,card_type,tx_date,due_date,group_id,installment_current,installment_total,created_at,raw",
    filters: { uid },
    order: "due_date.desc.nullslast",
  });
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const groupId = request.nextUrl.searchParams.get("groupId")?.trim();

    const rows = await fetchUserTransactions(uid);
    const filtered = groupId ? rows.filter((row) => String(row.group_id || "") === groupId) : rows;
    const transactions = filtered.map((row) => toClientTx(uid, row));

    return NextResponse.json({ ok: true, transactions }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
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

      const nowIso = new Date().toISOString();
      const rows = txs.map((tx) => {
        const id = crypto.randomUUID();
        return toTxRow(uid, id, { ...tx, userId: uid, createdAt: nowIso });
      });

      await supabaseUpsertRows("transactions", rows, { onConflict: "id" });
      await enforceCreditCardPolicy(uid);
      return NextResponse.json({ ok: true, created: rows.length }, { status: 200 });
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

      const current = await fetchUserTransactions(uid);
      const byId = new Map(current.map((row) => [String(row.source_id || ""), row]));
      const nextRows: Array<Record<string, unknown>> = [];

      for (const entry of updates) {
        if (!entry?.id) continue;
        const existing = byId.get(entry.id);
        if (!existing) continue;
        const raw = ((existing.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const merged = { ...raw, ...entry.updates };
        nextRows.push(toTxRow(uid, entry.id, merged));
      }

      if (nextRows.length > 0) {
        await supabaseUpsertRows("transactions", nextRows, { onConflict: "id" });
      }
      await enforceCreditCardPolicy(uid);
      return NextResponse.json({ ok: true, updated: nextRows.length }, { status: 200 });
    }

    if (body.action === "toggleStatus") {
      const approval = await ensureImpersonationWriteApproval({
        request,
        acting,
        actionType: "transactions:toggleStatus",
        actionLabel: "Alterar status de pagamento",
      });
      if (!approval.allowed) {
        return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
      }

      if (!body.transactionId || !body.currentStatus) {
        return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
      }

      const current = await fetchUserTransactions(uid);
      const existing = current.find((row) => String(row.source_id || "") === body.transactionId);
      if (!existing) {
        return NextResponse.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
      }

      const nextStatus = body.currentStatus === "paid" ? "pending" : "paid";
      const raw = ((existing.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      const merged = { ...raw, status: nextStatus };
      await supabaseUpsertRows("transactions", [toTxRow(uid, body.transactionId, merged)], {
        onConflict: "id",
      });
      await enforceCreditCardPolicy(uid);

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

      const current = await fetchUserTransactions(uid);
      const toDelete = current.filter(
        (row) =>
          String(row.group_id || "") === body.groupId &&
          typeof row.due_date === "string" &&
          row.due_date > body.lastInstallmentDate
      );

      for (const row of toDelete) {
        await supabaseDeleteByFilters("transactions", {
          uid,
          source_id: String(row.source_id || ""),
        });
      }

      await enforceCreditCardPolicy(uid);
      return NextResponse.json({ ok: true, deleted: toDelete.length }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
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

    const current = await fetchUserTransactions(uid);
    const existing = current.find((row) => String(row.source_id || "") === body.transactionId);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "transaction_not_found" }, { status: 404 });
    }

    const raw = ((existing.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const merged = { ...raw, ...body.updates };
    await supabaseUpsertRows("transactions", [toTxRow(uid, body.transactionId, merged)], {
      onConflict: "id",
    });
    await enforceCreditCardPolicy(uid);

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
      const current = await fetchUserTransactions(uid);
      const toDelete = current.filter((row) => String(row.group_id || "") === groupId);
      for (const row of toDelete) {
        await supabaseDeleteByFilters("transactions", {
          uid,
          source_id: String(row.source_id || ""),
        });
      }
      await enforceCreditCardPolicy(uid);
      return NextResponse.json({ ok: true, deleted: toDelete.length }, { status: 200 });
    }

    await supabaseDeleteByFilters("transactions", { uid, source_id: transactionId as string });
    await enforceCreditCardPolicy(uid);
    return NextResponse.json({ ok: true, deleted: 1 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

