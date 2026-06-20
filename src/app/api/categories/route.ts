import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { filterActiveJsonRows, isArchivedJsonRecord } from "@/lib/account-archive/server";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseUpsertRows,
} from "@/services/supabase/admin";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";

type CategoryType = "income" | "expense" | "both";
type WorkspaceType = "personal" | "professional" | "church" | "family" | "business";

function parseCategoryType(value: unknown): CategoryType | null {
  if (value === "income" || value === "expense" || value === "both") return value;
  return null;
}

const CATEGORY_SELECT_WITH_WORKSPACE = "source_id,workspace_id,name,parent_name,category_type,color,raw";
const CATEGORY_SELECT_LEGACY = "source_id,name,parent_name,category_type,color,raw";
const TX_SELECT_WITH_WORKSPACE =
  "source_id,workspace_id,created_by_uid,description,amount,amount_text,amount_for_limit,tx_type,category,tx_status,payment_method,card_id,card_label,card_type,tx_date,due_date,group_id,installment_current,installment_total,created_at,raw";
const TX_SELECT_LEGACY =
  "source_id,description,amount,amount_text,amount_for_limit,tx_type,category,tx_status,payment_method,card_id,card_label,card_type,tx_date,due_date,group_id,installment_current,installment_total,created_at,raw";

function isMissingWorkspaceColumn(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("workspace_id") || message.includes("created_by_uid") || message.includes("PGRST204");
}

function withoutWorkspaceColumns(row: Record<string, unknown>) {
  const { workspace_id: _workspaceId, created_by_uid: _createdByUid, ...legacyRow } = row;
  void _workspaceId;
  void _createdByUid;
  return legacyRow;
}

async function upsertRowsWithWorkspaceFallback(table: string, rows: Array<Record<string, unknown>>) {
  try {
    await supabaseUpsertRows(table, rows, { onConflict: "id" });
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    await supabaseUpsertRows(table, rows.map(withoutWorkspaceColumns), { onConflict: "id" });
  }
}

function getRowWorkspaceId(row: Record<string, unknown>) {
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return String(row.workspace_id || raw.workspaceId || "");
}

function isWorkspacePreset(value: unknown): value is WorkspaceType {
  return value === "personal" || value === "professional" || value === "church" || value === "family" || value === "business";
}

function belongsToActiveWorkspace(row: Record<string, unknown>, workspaceId?: string | null, includeLegacyRows = true, workspaceType?: WorkspaceType) {
  if (!workspaceId) return true;
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const rowWorkspaceId = getRowWorkspaceId(row);
  if (rowWorkspaceId) return rowWorkspaceId === workspaceId;
  if (!includeLegacyRows) return false;
  const presetType = raw.workspacePreset;
  return !isWorkspacePreset(presetType) || presetType === workspaceType;
}

function getCategoriesSettingKey(workspaceId?: string | null) {
  return workspaceId ? `categories:${workspaceId}` : "categories";
}

function toCategoryRow(uid: string, sourceId: string, data: Record<string, unknown>, workspaceId?: string | null) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    workspace_id: workspaceId || null,
    source_id: sourceId,
    name: data.name ?? "",
    parent_name: data.parentName ?? null,
    category_type: data.type ?? null,
    color: data.color ?? null,
    is_default: data.isDefault == null ? null : Boolean(data.isDefault),
    is_custom: data.isCustom == null ? null : Boolean(data.isCustom),
    raw: { ...data, workspaceId: workspaceId || null },
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

function toTxRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  const workspaceId = typeof data.workspaceId === "string" ? data.workspaceId : null;
  const createdByUid = typeof data.createdByUid === "string" ? data.createdByUid : uid;
  return {
    id: `${uid}__${sourceId}`,
    uid,
    workspace_id: workspaceId,
    created_by_uid: createdByUid,
    source_id: sourceId,
    description: data.description ?? null,
    amount: typeof data.amount === "number" ? data.amount : Number(data.amount) || null,
    amount_text: data.amount == null ? null : String(data.amount),
    amount_for_limit:
      typeof data.amountForLimit === "number" ? data.amountForLimit : Number(data.amountForLimit) || null,
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
    raw: { ...data, workspaceId, createdByUid },
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserCategories(uid: string, workspaceId?: string | null, includeLegacyRows = true, workspaceType?: WorkspaceType) {
  let rows: Record<string, unknown>[];
  try {
    rows = await supabaseSelect("categories", {
      select: CATEGORY_SELECT_WITH_WORKSPACE,
      filters: { uid },
    });
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    rows = await supabaseSelect("categories", {
      select: CATEGORY_SELECT_LEGACY,
      filters: { uid },
    });
  }
  const activeRows = filterActiveJsonRows(rows);
  if (!workspaceId) return activeRows;
  return activeRows.filter((row) => belongsToActiveWorkspace(row, workspaceId, includeLegacyRows, workspaceType));
}

async function getUserTransactions(uid: string, workspaceId?: string | null, includeLegacyRows = true) {
  let rows: Record<string, unknown>[];
  try {
    rows = await supabaseSelect("transactions", {
      select: TX_SELECT_WITH_WORKSPACE,
      filters: { uid },
    });
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    rows = await supabaseSelect("transactions", {
      select: TX_SELECT_LEGACY,
      filters: { uid },
    });
  }
  const activeRows = filterActiveJsonRows(rows);
  if (!workspaceId) return activeRows;
  return activeRows.filter((row) => {
    const rowWorkspaceId = getRowWorkspaceId(row);
    return rowWorkspaceId === workspaceId || (!rowWorkspaceId && includeLegacyRows);
  });
}

async function deleteCategory(uid: string, sourceId: string, workspaceId?: string | null) {
  try {
    await supabaseDeleteByFilters(
      "categories",
      workspaceId ? { uid, source_id: sourceId, workspace_id: workspaceId } : { uid, source_id: sourceId }
    );
  } catch (error) {
    if (!isMissingWorkspaceColumn(error)) throw error;
    await supabaseDeleteByFilters("categories", { uid, source_id: sourceId });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const workspaceContext = await resolveActiveWorkspaceContext(uid, request.nextUrl.searchParams.get("workspaceId"));
    const settingKey = getCategoriesSettingKey(workspaceContext.workspaceId);

    const [categoryRows, settingsRows] = await Promise.all([
      getUserCategories(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType),
      supabaseSelect("user_settings", {
        select: "setting_key,data",
        filters: { uid },
        or: workspaceContext.includeLegacyRows
          ? `setting_key.eq.${settingKey},setting_key.eq.categories`
          : `setting_key.eq.${settingKey}`,
      }),
    ]);

    const customCategories = categoryRows.map((row) => {
      const raw = (row.raw as Record<string, unknown> | null) ?? null;
      return {
        id: String(row.source_id || ""),
        name: String(row.name || raw?.name || ""),
        type: parseCategoryType(row.category_type ?? raw?.type) || "both",
        color: String(
          row.color ||
            raw?.color ||
            "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50"
        ),
        userId: uid,
      };
    });

    const activeSettingsRow =
      settingsRows.find((row) => String(row.setting_key || "") === settingKey && !isArchivedJsonRecord(row, "data")) ||
      settingsRows.find((row) => !isArchivedJsonRecord(row, "data"));
    const settingsData = (activeSettingsRow?.data as { hiddenDefaultCategories?: unknown } | undefined) ?? {};
    const hiddenDefaultCategories = Array.isArray(settingsData.hiddenDefaultCategories)
      ? settingsData.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
      : [];

    return NextResponse.json({ ok: true, customCategories, hiddenDefaultCategories }, { status: 200 });
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
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:create",
      actionLabel: "Criar categoria personalizada",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      name?: string;
      type?: CategoryType;
      color?: string;
      workspaceId?: string;
    };
    const workspaceContext = await resolveActiveWorkspaceContext(uid, body.workspaceId);

    const name = body.name?.trim();
    const type = parseCategoryType(body.type);
    if (!name || !type) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const existing = await getUserCategories(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType);
    const hasDuplicate = existing.some((row) => String(row.name || "") === name);
    if (hasDuplicate) {
      return NextResponse.json({ ok: false, error: "duplicate_category_name" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    await upsertRowsWithWorkspaceFallback(
      "categories",
      [
        toCategoryRow(uid, id, {
          name,
          type,
          color:
            body.color ||
            "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
          userId: uid,
          isCustom: true,
        }, workspaceContext.workspaceId),
      ]
    );

    return NextResponse.json({ ok: true, id }, { status: 200 });
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
      actionType: "categories:rename",
      actionLabel: "Renomear categorias personalizadas",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      oldName?: string;
      newName?: string;
      workspaceId?: string;
    };
    const workspaceContext = await resolveActiveWorkspaceContext(uid, body.workspaceId);

    const oldName = body.oldName?.trim();
    const newName = body.newName?.trim();
    if (!oldName || !newName) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const [allCategories, allTransactions] = await Promise.all([
      getUserCategories(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType),
      getUserTransactions(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows),
    ]);
    const scopedCategories = allCategories.filter((row) => {
      return belongsToActiveWorkspace(row, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType);
    });

    const affected = scopedCategories
      .map((row) => ({ id: String(row.source_id || ""), name: String(row.name || "") }))
      .filter((item) => item.name === oldName || item.name.startsWith(`${oldName}::`));

    if (affected.length === 0) {
      return NextResponse.json({ ok: true, updated: 0 }, { status: 200 });
    }

    const renameMap = new Map<string, string>();
    affected.forEach((item) => {
      const suffix = item.name.slice(oldName.length);
      renameMap.set(item.name, `${newName}${suffix}`);
    });

    const existingNames = new Set(
      scopedCategories
        .map((row) => String(row.name || ""))
        .filter((name) => !renameMap.has(name))
    );

    for (const targetName of renameMap.values()) {
      if (existingNames.has(targetName)) {
        return NextResponse.json({ ok: false, error: "duplicate_category_name" }, { status: 409 });
      }
    }

    const categoryUpserts: Array<Record<string, unknown>> = [];
    for (const item of affected) {
      const target = renameMap.get(item.name);
      if (!target) continue;
      const original = scopedCategories.find((row) => String(row.source_id || "") === item.id);
      const raw = ((original?.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      categoryUpserts.push(toCategoryRow(uid, item.id, { ...raw, name: target }, workspaceContext.workspaceId));
    }

    if (categoryUpserts.length > 0) {
      await upsertRowsWithWorkspaceFallback("categories", categoryUpserts);
    }

    const txUpserts: Array<Record<string, unknown>> = [];
    for (const tx of allTransactions) {
      const currentName = String(tx.category || ((tx.raw as Record<string, unknown> | null) ?? {}).category || "");
      if (!renameMap.has(currentName)) continue;
      const raw = ((tx.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      txUpserts.push(
        toTxRow(uid, String(tx.source_id || ""), {
          ...raw,
          workspaceId: String(tx.workspace_id || raw.workspaceId || workspaceContext.workspaceId || ""),
          createdByUid: String(tx.created_by_uid || raw.createdByUid || uid),
          category: renameMap.get(currentName),
        })
      );
    }

    if (txUpserts.length > 0) {
      await upsertRowsWithWorkspaceFallback("transactions", txUpserts);
    }

    return NextResponse.json({ ok: true, updated: categoryUpserts.length + txUpserts.length }, { status: 200 });
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
      actionType: "categories:delete",
      actionLabel: "Excluir categoria personalizada",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const categoryName = request.nextUrl.searchParams.get("name")?.trim();
    const fallbackCategory = request.nextUrl.searchParams.get("fallbackCategory")?.trim() || "Outros";
    const workspaceContext = await resolveActiveWorkspaceContext(uid, request.nextUrl.searchParams.get("workspaceId"));
    if (!categoryName) {
      return NextResponse.json({ ok: false, error: "missing_category_name" }, { status: 400 });
    }

    const [allCategories, allTransactions] = await Promise.all([
      getUserCategories(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType),
      getUserTransactions(uid, workspaceContext.workspaceId, workspaceContext.includeLegacyRows),
    ]);
    const scopedCategories = allCategories.filter((row) => {
      return belongsToActiveWorkspace(row, workspaceContext.workspaceId, workspaceContext.includeLegacyRows, workspaceContext.workspaceType);
    });

    const affected = scopedCategories
      .map((row) => ({ id: String(row.source_id || ""), name: String(row.name || "") }))
      .filter((item) => item.name === categoryName || item.name.startsWith(`${categoryName}::`));

    for (const item of affected) {
      await deleteCategory(uid, item.id, workspaceContext.workspaceId);
    }

    const txUpserts: Array<Record<string, unknown>> = [];
    for (const tx of allTransactions) {
      const currentName = String(tx.category || ((tx.raw as Record<string, unknown> | null) ?? {}).category || "");
      if (!affected.some((item) => item.name === currentName)) continue;
      const raw = ((tx.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      txUpserts.push(
        toTxRow(uid, String(tx.source_id || ""), {
          ...raw,
          workspaceId: String(tx.workspace_id || raw.workspaceId || workspaceContext.workspaceId || ""),
          createdByUid: String(tx.created_by_uid || raw.createdByUid || uid),
          category: fallbackCategory,
        })
      );
    }

    if (txUpserts.length > 0) {
      await upsertRowsWithWorkspaceFallback("transactions", txUpserts);
    }

    return NextResponse.json({ ok: true, updated: affected.length + txUpserts.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

