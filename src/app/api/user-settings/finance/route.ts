import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { readSecureSettingData, writeSecureSettingData } from "@/lib/secure-store/user-settings";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";
import { canManageFamilyWorkspaceSettings, canViewFamilyDashboardSummary } from "@/lib/workspaces/family";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getFinanceSettingKey(workspaceId?: string | null) {
  return workspaceId ? `finance:${workspaceId}` : "finance";
}

export async function GET(request: NextRequest) {
  try {
    const { actingUid: requesterUid } = await resolveActingContext(request);
    const workspaceContext = await resolveActiveWorkspaceContext(requesterUid, request.nextUrl.searchParams.get("workspaceId"));
    const uid = workspaceContext.ownerUid;
    const settingKey = getFinanceSettingKey(workspaceContext.workspaceId);
    const rows = await supabaseSelect("user_settings", {
      select: "id,setting_key,data",
      filters: { uid },
      or: workspaceContext.includeLegacyRows
        ? `setting_key.eq.${settingKey},setting_key.eq.finance`
        : `setting_key.eq.${settingKey}`,
    });

    const activeRow =
      rows.find((row) => String(row.setting_key || "") === settingKey && !isArchivedJsonRecord(row, "data")) ||
      rows.find((row) => !isArchivedJsonRecord(row, "data"));
    const data = readSecureSettingData<{
      currentBalance?: unknown;
      locale?: unknown;
      currency?: unknown;
      country?: unknown;
      region?: unknown;
      regionConfigured?: unknown;
    }>(activeRow?.data);
    const canViewBalance = canViewFamilyDashboardSummary(workspaceContext.member);
    const currentBalance = canViewBalance && typeof data.currentBalance === "number" ? data.currentBalance : 0;
    return NextResponse.json(
      {
        ok: true,
        currentBalance,
        locale: typeof data.locale === "string" ? data.locale : undefined,
        currency: typeof data.currency === "string" ? data.currency : undefined,
        country: typeof data.country === "string" ? data.country : undefined,
        region: typeof data.region === "string" ? data.region : undefined,
        regionConfigured: typeof data.regionConfigured === "boolean" ? data.regionConfigured : false,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const acting = await resolveActingContext(request);
    const uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "finance:update-balance",
      actionLabel: "Atualizar saldo financeiro",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      currentBalance?: number;
      locale?: string;
      currency?: string;
      country?: string;
      region?: string;
      regionConfigured?: boolean;
      workspaceId?: string;
    };
    if (body.currentBalance !== undefined && (typeof body.currentBalance !== "number" || Number.isNaN(body.currentBalance))) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const workspaceContext = await resolveActiveWorkspaceContext(uid, body.workspaceId);
    const ownerUid = workspaceContext.ownerUid;
    if (!canManageFamilyWorkspaceSettings(workspaceContext.member)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const settingKey = getFinanceSettingKey(workspaceContext.workspaceId);
    const existingRows = await supabaseSelect("user_settings", {
      select: "id,setting_key,data",
      filters: { uid: ownerUid },
      or: workspaceContext.includeLegacyRows
        ? `setting_key.eq.${settingKey},setting_key.eq.finance`
        : `setting_key.eq.${settingKey}`,
    });
    const existing =
      existingRows.find((row) => String(row.setting_key || "") === settingKey && !isArchivedJsonRecord(row, "data")) ||
      existingRows.find((row) => !isArchivedJsonRecord(row, "data"));

    const currentData = readSecureSettingData<Record<string, unknown>>(existing?.data);
    const nextData = {
      ...currentData,
      ...(body.currentBalance !== undefined ? { currentBalance: body.currentBalance } : {}),
      ...(body.locale ? { locale: body.locale } : {}),
      ...(body.currency ? { currency: body.currency } : {}),
      ...(body.country ? { country: body.country } : {}),
      ...(body.region !== undefined ? { region: body.region } : {}),
      ...(body.regionConfigured !== undefined ? { regionConfigured: body.regionConfigured } : {}),
    };

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(existing?.id && String(existing.setting_key || "") === settingKey ? existing.id : `${ownerUid}__${settingKey}`),
          uid: ownerUid,
          setting_key: settingKey,
          data: writeSecureSettingData(nextData, { isArchived: false }),
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status =
      message === "missing_auth_token" ? 401
        : message.startsWith("impersonation_") ? 403
          : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

