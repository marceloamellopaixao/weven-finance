import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { readSecureSettingData, writeSecureSettingData } from "@/lib/secure-store/user-settings";
import { normalizeNavigationPreferences } from "@/lib/navigation/apps";
import { DEFAULT_NAVIGATION_PREFERENCES, NavigationPreferences } from "@/types/navigation";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
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
      filters: { uid, setting_key: "navigation" },
      limit: 1,
    });

    const activeRow = getActiveRow(rows);
    const data = readSecureSettingData<Partial<NavigationPreferences>>(activeRow?.data);
    const navigation = normalizeNavigationPreferences(data);
    return NextResponse.json({ ok: true, navigation }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json(
      { ok: false, error: message, navigation: DEFAULT_NAVIGATION_PREFERENCES },
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
      actionType: "navigation:update-dock",
      actionLabel: "Atualizar atalhos e dock",
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

    const body = (await request.json()) as { navigation?: Partial<NavigationPreferences> | null };
    const navigation = normalizeNavigationPreferences(body.navigation);

    const existingRows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "navigation" },
      limit: 1,
    });
    const existing = getActiveRow(existingRows);

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(existing?.id || `${uid}__navigation`),
          uid,
          setting_key: "navigation",
          data: writeSecureSettingData(navigation, {
            isArchived: false,
          }),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true, navigation }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
