import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getCategoriesSettingKey(workspaceId?: string | null) {
  return workspaceId ? `categories:${workspaceId}` : "categories";
}

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:default-visibility",
      actionLabel: "Ocultar ou mostrar categoria padrão",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      categoryName?: string;
      hidden?: boolean;
      workspaceId?: string;
    };
    const workspaceContext = await resolveActiveWorkspaceContext(uid, body.workspaceId);
    const settingKey = getCategoriesSettingKey(workspaceContext.workspaceId);

    const categoryName = body.categoryName?.trim();
    const hidden = body.hidden;
    if (!categoryName || typeof hidden !== "boolean") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    if (categoryName === "Outros") {
      return NextResponse.json({ ok: false, error: "cannot_hide_others" }, { status: 400 });
    }

    const rows = await supabaseSelect("user_settings", {
      select: "id,setting_key,data",
      filters: { uid },
      or: workspaceContext.includeLegacyRows
        ? `setting_key.eq.${settingKey},setting_key.eq.categories`
        : `setting_key.eq.${settingKey}`,
    });

    const activeRow =
      rows.find((row) => String(row.setting_key || "") === settingKey && !isArchivedJsonRecord(row, "data")) ||
      rows.find((row) => !isArchivedJsonRecord(row, "data"));
    const existingData = (activeRow?.data as { hiddenDefaultCategories?: unknown } | undefined) ?? {};
    const currentHidden = Array.isArray(existingData.hiddenDefaultCategories)
      ? existingData.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
      : [];

    const next = hidden
      ? Array.from(new Set([...currentHidden, categoryName]))
      : currentHidden.filter((name) => name !== categoryName);

    const activeRowBelongsToWorkspace = String(activeRow?.setting_key || "") === settingKey;
    const id = String(activeRowBelongsToWorkspace ? activeRow?.id : `${uid}__${settingKey}`);
    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id,
          uid,
          setting_key: settingKey,
          data: { hiddenDefaultCategories: next, isArchived: false },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true, hiddenDefaultCategories: next }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

