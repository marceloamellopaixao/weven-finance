import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import {
  supabaseDeleteByFilters,
  supabaseSelect,
  supabaseUpsertRows,
} from "@/services/supabase/admin";

type CategoryType = "income" | "expense" | "both";

function parseCategoryType(value: unknown): CategoryType | null {
  if (value === "income" || value === "expense" || value === "both") return value;
  return null;
}

function toCategoryRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
    source_id: sourceId,
    name: data.name ?? "",
    parent_name: data.parentName ?? null,
    category_type: data.type ?? null,
    color: data.color ?? null,
    is_default: data.isDefault == null ? null : Boolean(data.isDefault),
    is_custom: data.isCustom == null ? null : Boolean(data.isCustom),
    raw: data,
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

function toTxRow(uid: string, sourceId: string, data: Record<string, unknown>) {
  return {
    id: `${uid}__${sourceId}`,
    uid,
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
    raw: data,
    created_at: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getUserCategories(uid: string) {
  return supabaseSelect("categories", {
    select: "source_id,name,parent_name,category_type,color,raw",
    filters: { uid },
  });
}

async function getUserTransactions(uid: string) {
  return supabaseSelect("transactions", {
    select:
      "source_id,description,amount,amount_text,amount_for_limit,tx_type,category,tx_status,payment_method,card_id,card_label,card_type,tx_date,due_date,group_id,installment_current,installment_total,created_at,raw",
    filters: { uid },
  });
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);

    const [categoryRows, settingsRows] = await Promise.all([
      getUserCategories(uid),
      supabaseSelect("user_settings", {
        select: "data",
        filters: { uid, setting_key: "categories" },
        limit: 1,
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

    const settingsData = (settingsRows[0]?.data as { hiddenDefaultCategories?: unknown } | undefined) ?? {};
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
    };

    const name = body.name?.trim();
    const type = parseCategoryType(body.type);
    if (!name || !type) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const existing = await getUserCategories(uid);
    const hasDuplicate = existing.some((row) => String(row.name || "") === name);
    if (hasDuplicate) {
      return NextResponse.json({ ok: false, error: "duplicate_category_name" }, { status: 409 });
    }

    const id = crypto.randomUUID();
    await supabaseUpsertRows(
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
        }),
      ],
      { onConflict: "id" }
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
    };

    const oldName = body.oldName?.trim();
    const newName = body.newName?.trim();
    if (!oldName || !newName) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const [allCategories, allTransactions] = await Promise.all([
      getUserCategories(uid),
      getUserTransactions(uid),
    ]);

    const affected = allCategories
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
      allCategories
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
      const original = allCategories.find((row) => String(row.source_id || "") === item.id);
      const raw = ((original?.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      categoryUpserts.push(toCategoryRow(uid, item.id, { ...raw, name: target }));
    }

    if (categoryUpserts.length > 0) {
      await supabaseUpsertRows("categories", categoryUpserts, { onConflict: "id" });
    }

    const txUpserts: Array<Record<string, unknown>> = [];
    for (const tx of allTransactions) {
      const currentName = String(tx.category || ((tx.raw as Record<string, unknown> | null) ?? {}).category || "");
      if (!renameMap.has(currentName)) continue;
      const raw = ((tx.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      txUpserts.push(
        toTxRow(uid, String(tx.source_id || ""), {
          ...raw,
          category: renameMap.get(currentName),
        })
      );
    }

    if (txUpserts.length > 0) {
      await supabaseUpsertRows("transactions", txUpserts, { onConflict: "id" });
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
    if (!categoryName) {
      return NextResponse.json({ ok: false, error: "missing_category_name" }, { status: 400 });
    }

    const [allCategories, allTransactions] = await Promise.all([
      getUserCategories(uid),
      getUserTransactions(uid),
    ]);

    const affected = allCategories
      .map((row) => ({ id: String(row.source_id || ""), name: String(row.name || "") }))
      .filter((item) => item.name === categoryName || item.name.startsWith(`${categoryName}::`));

    for (const item of affected) {
      await supabaseDeleteByFilters("categories", { uid, source_id: item.id });
    }

    const txUpserts: Array<Record<string, unknown>> = [];
    for (const tx of allTransactions) {
      const currentName = String(tx.category || ((tx.raw as Record<string, unknown> | null) ?? {}).category || "");
      if (!affected.some((item) => item.name === currentName)) continue;
      const raw = ((tx.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      txUpserts.push(
        toTxRow(uid, String(tx.source_id || ""), {
          ...raw,
          category: fallbackCategory,
        })
      );
    }

    if (txUpserts.length > 0) {
      await supabaseUpsertRows("transactions", txUpserts, { onConflict: "id" });
    }

    return NextResponse.json({ ok: true, updated: affected.length + txUpserts.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

