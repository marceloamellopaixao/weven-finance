import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { readSecureSettingData, writeSecureSettingData } from "@/lib/secure-store/user-settings";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import {
  AppearancePreferences,
  DEFAULT_APPEARANCE_PREFERENCES,
} from "@/types/appearance";
import { normalizeAppearancePreferences } from "@/lib/appearance/preferences";
import { resolveApiErrorStatus } from "@/lib/api/error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getActiveRow(rows: Array<Record<string, unknown>>) {
  return rows.find((row) => !isArchivedJsonRecord(row, "data"));
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const rows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "appearance" },
      limit: 1,
    });

    const activeRow = getActiveRow(rows);
    const data = readSecureSettingData<Partial<AppearancePreferences>>(activeRow?.data);
    const appearance = normalizeAppearancePreferences(data);
    return NextResponse.json({ ok: true, appearance }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json(
      { ok: false, error: message, appearance: DEFAULT_APPEARANCE_PREFERENCES },
      { status }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "appearance:update-theme",
      actionLabel: "Atualizar tema e cores do app",
    });
    if (!approval.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "impersonation_write_confirmation_required",
          actionRequestId: approval.actionRequestId,
        },
        { status: 409 }
      );
    }

    const body = (await request.json()) as { appearance?: Partial<AppearancePreferences> | null };
    const appearance = normalizeAppearancePreferences(body.appearance);

    const existingRows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "appearance" },
      limit: 1,
    });
    const existing = getActiveRow(existingRows);

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(existing?.id || `${uid}__appearance`),
          uid,
          setting_key: "appearance",
          data: writeSecureSettingData(appearance, { isArchived: false }),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true, appearance }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
