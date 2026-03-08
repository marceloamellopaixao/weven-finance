import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
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

    const data = (rows[0]?.data as { currentBalance?: unknown } | undefined) ?? {};
    const currentBalance = typeof data.currentBalance === "number" ? data.currentBalance : 0;
    return NextResponse.json({ ok: true, currentBalance }, { status: 200 });
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

    const body = (await request.json()) as { currentBalance?: number };
    if (typeof body.currentBalance !== "number" || Number.isNaN(body.currentBalance)) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const existing = await supabaseSelect("user_settings", {
      select: "id,data",
      filters: { uid, setting_key: "finance" },
      limit: 1,
    });

    await supabaseUpsertRows(
      "user_settings",
      [
        {
          id: String(existing[0]?.id || `${uid}__finance`),
          uid,
          setting_key: "finance",
          data: { ...(existing[0]?.data as Record<string, unknown> | undefined), currentBalance: body.currentBalance },
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

