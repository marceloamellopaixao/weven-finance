import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { readSecureSettingData, writeSecureSettingData } from "@/lib/secure-store/user-settings";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const rows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "finance" },
      limit: 1,
    });

    const activeRow = rows.find((row) => !isArchivedJsonRecord(row, "data"));
    const data = readSecureSettingData<{
      currentBalance?: unknown;
      locale?: unknown;
      currency?: unknown;
      country?: unknown;
      region?: unknown;
      regionConfigured?: unknown;
    }>(activeRow?.data);
    const currentBalance = typeof data.currentBalance === "number" ? data.currentBalance : 0;
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
    };
    if (body.currentBalance !== undefined && (typeof body.currentBalance !== "number" || Number.isNaN(body.currentBalance))) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const existingRows = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "finance" },
      limit: 1,
    });
    const existing = existingRows.find((row) => !isArchivedJsonRecord(row, "data"));

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
          id: String(existing?.id || `${uid}__finance`),
          uid,
          setting_key: "finance",
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

