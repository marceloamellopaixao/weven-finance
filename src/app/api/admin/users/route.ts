import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseDeleteByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

type UserRole = "admin" | "moderator" | "support" | "client";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const role = String(row.role || raw.role || "client") as UserRole;
  return { uid: decoded.uid, role };
}

function isManager(role: UserRole) {
  return role === "admin" || role === "moderator";
}

async function setArchiveForAllTransactions(uid: string, value: boolean) {
  const rows = await supabaseSelect("transactions", {
    select: "id,uid,source_id,raw",
    filters: { uid },
  });
  if (rows.length === 0) return;

  await supabaseUpsertRows(
    "transactions",
    rows.map((row) => {
      const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
      raw.isArchived = value;
      return {
        id: row.id,
        uid,
        source_id: row.source_id,
        raw,
        updated_at: new Date().toISOString(),
      };
    }),
    { onConflict: "id" }
  );
}

async function deleteAllTransactions(uid: string) {
  const rows = await supabaseSelect("transactions", {
    select: "source_id",
    filters: { uid },
  });
  for (const row of rows) {
    await supabaseDeleteByFilters("transactions", {
      uid,
      source_id: String(row.source_id || ""),
    });
  }
  return rows.length;
}

function mapProfileRowToUser(row: Record<string, unknown>) {
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return {
    uid: String(row.uid || ""),
    email: row.email ?? raw.email ?? "",
    displayName: row.display_name ?? raw.displayName ?? "",
    completeName: row.complete_name ?? raw.completeName ?? "",
    phone: row.phone ?? raw.phone ?? "",
    role: row.role ?? raw.role ?? "client",
    plan: row.plan ?? raw.plan ?? "free",
    status: row.status ?? raw.status ?? "active",
    paymentStatus: row.payment_status ?? raw.paymentStatus ?? "pending",
    transactionCount: row.transaction_count ?? raw.transactionCount ?? 0,
    verifiedEmail: row.verified_email ?? raw.verifiedEmail ?? false,
    blockReason: row.block_reason ?? raw.blockReason ?? "",
    createdAt: row.created_at ?? raw.createdAt ?? "",
    deletedAt: row.deleted_at ?? raw.deletedAt ?? null,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const rows = await supabaseSelect("profiles", { order: "created_at.desc.nullslast" });
    let users = rows.map(mapProfileRowToUser);

    if (scope === "staff") {
      users = users.filter((user) => user.role === "admin" || user.role === "moderator");
    }

    return NextResponse.json({ ok: true, users }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      uid?: string;
      updates?: Record<string, unknown>;
      requiresAdmin?: boolean;
    };
    if (!body.uid || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }
    if (body.requiresAdmin && auth.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const rows = await supabaseSelect("profiles", { filters: { uid: body.uid }, limit: 1 });
    if (rows.length === 0) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }
    const row = rows[0];
    const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const mergedRaw = { ...raw, ...body.updates };

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid: body.uid,
          ...(body.updates.role !== undefined ? { role: body.updates.role } : {}),
          ...(body.updates.plan !== undefined ? { plan: body.updates.plan } : {}),
          ...(body.updates.status !== undefined ? { status: body.updates.status } : {}),
          ...(body.updates.paymentStatus !== undefined ? { payment_status: body.updates.paymentStatus } : {}),
          ...(body.updates.blockReason !== undefined ? { block_reason: body.updates.blockReason } : {}),
          raw: mergedRaw,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      action?: "normalize" | "resetFinancialData" | "softDelete" | "restore" | "recountTransactionCount";
      uid?: string;
      restoreData?: boolean;
    };

    if (body.action === "normalize") {
      if (auth.role !== "admin") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const snapshot = await supabaseSelect("profiles");
      let updateCount = 0;
      const upserts: Array<Record<string, unknown>> = [];

      snapshot.forEach((row) => {
        const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        let needsUpdate = false;

        if (row.phone === undefined && raw.phone === undefined) { raw.phone = ""; needsUpdate = true; }
        if (row.complete_name === undefined && raw.completeName === undefined) { raw.completeName = raw.displayName || ""; needsUpdate = true; }
        if (row.transaction_count === undefined && raw.transactionCount === undefined) { raw.transactionCount = 0; needsUpdate = true; }
        if (row.payment_status === undefined && raw.paymentStatus === undefined) { raw.paymentStatus = "pending"; needsUpdate = true; }
        if (row.verified_email === undefined && raw.verifiedEmail === undefined) { raw.verifiedEmail = false; needsUpdate = true; }
        if (row.block_reason === undefined && raw.blockReason === undefined) { raw.blockReason = ""; needsUpdate = true; }
        if (row.role === undefined && raw.role === undefined) { raw.role = "client"; needsUpdate = true; }
        if (row.plan === undefined && raw.plan === undefined) { raw.plan = "free"; needsUpdate = true; }
        if (row.status === undefined && raw.status === undefined) { raw.status = "active"; needsUpdate = true; }

        if (needsUpdate) {
          upserts.push({ uid: row.uid, raw, updated_at: new Date().toISOString() });
          updateCount += 1;
        }
      });

      if (upserts.length > 0) {
        await supabaseUpsertRows("profiles", upserts, { onConflict: "uid" });
      }
      return NextResponse.json({ ok: true, count: updateCount }, { status: 200 });
    }

    if (!body.uid) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    if (body.action === "resetFinancialData") {
      const deleted = await deleteAllTransactions(body.uid);
      await supabaseUpsertRows("profiles", [{ uid: body.uid, transaction_count: 0, updated_at: new Date().toISOString() }], {
        onConflict: "uid",
      });
      return NextResponse.json({ ok: true, deleted }, { status: 200 });
    }

    if (body.action === "softDelete") {
      if (auth.role !== "admin") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      await setArchiveForAllTransactions(body.uid, true);
      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid: body.uid,
            status: "deleted",
            role: "client",
            payment_status: "canceled",
            block_reason: "Usuario solicitado exclusao",
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "uid" }
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (body.action === "restore") {
      if (body.restoreData !== false) {
        await setArchiveForAllTransactions(body.uid, false);
      }
      await supabaseUpsertRows(
        "profiles",
        [
          {
            uid: body.uid,
            status: "active",
            payment_status: "pending",
            block_reason: "",
            deleted_at: null,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: "uid" }
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    if (body.action === "recountTransactionCount") {
      const rows = await supabaseSelect("transactions", {
        select: "source_id",
        filters: { uid: body.uid },
      });
      const total = rows.length;
      await supabaseUpsertRows(
        "profiles",
        [{ uid: body.uid, transaction_count: total, updated_at: new Date().toISOString() }],
        { onConflict: "uid" }
      );
      return NextResponse.json({ ok: true, count: total }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

