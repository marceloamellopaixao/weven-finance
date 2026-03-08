import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { actingUid: uid } = await resolveActingContext(request);
    const rows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, profile: null }, { status: 200 });
    }
    const row = rows[0];
    const raw = (row.raw as Record<string, unknown> | null) ?? {};
    return NextResponse.json(
      {
        ok: true,
        profile: {
          uid,
          email: row.email ?? raw.email ?? "",
          displayName: row.display_name ?? raw.displayName ?? raw.completeName ?? "Usuario",
          completeName: row.complete_name ?? raw.completeName ?? "",
          phone: row.phone ?? raw.phone ?? "",
          photoURL: row.photo_url ?? raw.photoURL ?? "",
          role: row.role ?? raw.role ?? "client",
          plan: row.plan ?? raw.plan ?? "free",
          status: row.status ?? raw.status ?? "active",
          blockReason: row.block_reason ?? raw.blockReason ?? "",
          paymentStatus: row.payment_status ?? raw.paymentStatus ?? "pending",
          transactionCount: row.transaction_count ?? raw.transactionCount ?? 0,
          billing: row.billing ?? raw.billing ?? {},
          verifiedEmail: row.verified_email ?? raw.verifiedEmail ?? false,
          deletedAt: row.deleted_at ?? raw.deletedAt ?? undefined,
          createdAt: row.created_at ?? raw.createdAt ?? new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
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
      actionType: "profile:update",
      actionLabel: "Editar perfil do usuário",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      displayName?: string;
      completeName?: string;
      phone?: string;
    };
    const existing = await supabaseSelect("profiles", { filters: { uid }, limit: 1 });
    const raw = ((existing[0]?.raw as Record<string, unknown> | undefined) || {});
    raw.displayName = body.displayName ?? "";
    raw.completeName = body.completeName ?? "";
    raw.phone = body.phone ?? "";

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          display_name: body.displayName ?? "",
          complete_name: body.completeName ?? "",
          phone: body.phone ?? "",
          raw,
        },
      ],
      { onConflict: "uid" }
    );
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

