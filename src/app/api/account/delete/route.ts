import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function archiveUserTransactions(uid: string) {
  const rows = await supabaseSelect("transactions", {
    select: "id,uid,source_id,raw",
    filters: { uid },
  });
  if (rows.length === 0) return;

  const upserts = rows.map((row) => {
    const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    raw.isArchived = true;
    return {
      id: row.id,
      uid,
      source_id: row.source_id,
      raw,
      updated_at: new Date().toISOString(),
    };
  });

  await supabaseUpsertRows("transactions", upserts, { onConflict: "id" });
}

export async function POST(request: NextRequest) {
  try {
    const decoded = await verifyRequestAuth(request);
    const uid = decoded.uid;

    await archiveUserTransactions(uid);

    const profileRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const profileRaw = ((profileRows[0]?.raw as Record<string, unknown> | undefined) ?? {});

    const billing = {
      source: "system",
      lastSyncAt: new Date().toISOString(),
      pendingPreapprovalId: null,
      pendingPlan: null,
      pendingCheckoutAt: null,
      lastError: null,
    };

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          status: "deleted",
          role: "client",
          plan: "free",
          payment_status: "canceled",
          block_reason: "Conta excluida pelo usuario",
          deleted_at: new Date().toISOString(),
          billing,
          raw: {
            ...profileRaw,
            status: "deleted",
            role: "client",
            plan: "free",
            paymentStatus: "canceled",
            blockReason: "Conta excluida pelo usuario",
            deletedAt: new Date().toISOString(),
            billing,
          },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );

    await supabaseUpsertRows(
      "billing_events",
      [
        {
          id: `account_delete_${uid}_${Date.now()}`,
          uid,
          event_type: "account_delete",
          action: "self_delete",
          provider: "system",
          raw: {
            topic: "account_delete",
            action: "self_delete",
            resourceId: uid,
            uid,
            status: "processed",
            processedAt: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("Account delete API error:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "unknown_error" },
      { status: 500 }
    );
  }
}

