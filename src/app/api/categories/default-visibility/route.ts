import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "categories:default-visibility",
      actionLabel: "Ocultar ou mostrar categoria padrao",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      categoryName?: string;
      hidden?: boolean;
    };

    const categoryName = body.categoryName?.trim();
    const hidden = body.hidden;
    if (!categoryName || typeof hidden !== "boolean") {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    if (categoryName === "Outros") {
      return NextResponse.json({ ok: false, error: "cannot_hide_others" }, { status: 400 });
    }

    const rows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "categories" },
      limit: 1,
    });

    const activeRow = rows.find((row) => !isArchivedJsonRecord(row, "data"));
    const existingData = (activeRow?.data as { hiddenDefaultCategories?: unknown } | undefined) ?? {};
    const currentHidden = Array.isArray(existingData.hiddenDefaultCategories)
      ? existingData.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
      : [];

    const next = hidden
      ? Array.from(new Set([...currentHidden, categoryName]))
      : currentHidden.filter((name) => name !== categoryName);

    const id = String(activeRow?.id || rows[0]?.id || `${uid}__categories`);
    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id,
          uid,
          setting_key: "categories",
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

