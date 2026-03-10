import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { enforceCreditCardPolicy } from "@/lib/credit-card/limit";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseSelectPaged,
  supabaseUpsertRows,
} from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function escapeIlike(value: string) {
  return String(value || "")
    .replaceAll("%", "")
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .trim();
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
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:transactions:get", max: 180, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const { actingUid: uid } = await resolveActingContext(request);
    const groupId = request.nextUrl.searchParams.get("groupId")?.trim();
    const month = request.nextUrl.searchParams.get("month")?.trim();
    const typeFilter = request.nextUrl.searchParams.get("type")?.trim();
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim();
    const categoryFilter = request.nextUrl.searchParams.get("category")?.trim();
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
    const pageParam = request.nextUrl.searchParams.get("page");
    const limitParam = request.nextUrl.searchParams.get("limit");
    const page = Math.max(1, Number(pageParam || "1"));
    const limit = Math.max(1, Math.min(200, Number(limitParam || "50")));

    const usePaged = Boolean(pageParam || limitParam) && !groupId;
    const baseFilters: Record<string, string | undefined> = {
      uid,
      ...(typeFilter && typeFilter !== "all" ? { tx_type: typeFilter } : {}),
      ...(statusFilter && statusFilter !== "all" ? { tx_status: statusFilter } : {}),
      ...(categoryFilter && categoryFilter !== "all" ? { category: categoryFilter } : {}),
    };
    const conditions: Record<string, string | string[]> = {};
    if (month && month.length === 7) {
      const [y, m] = month.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        const monthStart = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-01`;
        const nextDate = new Date(Date.UTC(y, m, 1));
        const nextMonthStart = `${String(nextDate.getUTCFullYear()).padStart(4, "0")}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}-01`;
        conditions.due_date = [`gte.${monthStart}`, `lt.${nextMonthStart}`];
      }
    }
    const safeQ = escapeIlike(q);
    const or = safeQ ? `description.ilike.*${safeQ}*,amount_text.ilike.*${safeQ}*` : undefined;
    const paged = usePaged
      ? await supabaseSelectPaged("transactions", {
          select:
            "source_id,description,amount,amount_text,amount_for_limit,tx_type,category,tx_status,payment_method,card_id,card_label,card_type,tx_date,due_date,group_id,installment_current,installment_total,created_at,raw",
          filters: baseFilters,
          conditions,
          or,
          order: "due_date.desc.nullslast",
          page,
          limit,
        })
      : null;
    const rows = paged ? paged.data : await fetchUserTransactions(uid);
    const filtered = rows.filter((row) => {
      if (groupId && String(row.group_id || "") !== groupId) return false;
      if (typeFilter && typeFilter !== "all" && String(row.tx_type || "") !== typeFilter) return false;
      if (statusFilter && statusFilter !== "all" && String(row.tx_status || "") !== statusFilter) return false;
      if (categoryFilter && categoryFilter !== "all" && String(row.category || "") !== categoryFilter) return false;
      if (!paged && month && month.length === 7) {
        const due = String(row.due_date || "");
        if (!due.startsWith(month)) return false;
      }
      if (!paged && q) {
        const desc = String(row.description || "").toLowerCase();
        const amountTxt = String(row.amount_text || row.amount || "").toLowerCase();
        if (!desc.includes(q) && !amountTxt.includes(q)) return false;
      }
      return true;
    });
    const transactions = filtered.map((row) => toClientTx(uid, row));
    const total = paged ? paged.total : transactions.length;
    const result = paged ? transactions : transactions;

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, transactions: result, total, page, limit }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "transactions_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = resolveApiErrorStatus(message);
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:transactions:post", max: 90, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

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
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
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
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
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

      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
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
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
      return NextResponse.json({ ok: true, deleted: toDelete.length }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "transactions_post_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = resolveApiErrorStatus(message);
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:transactions:patch", max: 90, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

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

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "transactions_patch_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = resolveApiErrorStatus(message);
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:transactions:delete", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

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
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
      return NextResponse.json({ ok: true, deleted: toDelete.length }, { status: 200 });
    }

    await supabaseDeleteByFilters("transactions", { uid, source_id: transactionId as string });
    await enforceCreditCardPolicy(uid);
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, deleted: 1 }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "transactions_delete_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = resolveApiErrorStatus(message);
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

