import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { supabaseDeleteByFilters, supabaseSelect, supabaseSelectPaged, supabaseUpsertRows } from "@/services/supabase/admin";

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
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-users:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    if (!isManager(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const scope = request.nextUrl.searchParams.get("scope");
    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || "20")));
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";
    const role = request.nextUrl.searchParams.get("role")?.trim();
    const plan = request.nextUrl.searchParams.get("plan")?.trim();
    const status = request.nextUrl.searchParams.get("status")?.trim();
    const paymentStatus = request.nextUrl.searchParams.get("paymentStatus")?.trim();

    let users: ReturnType<typeof mapProfileRowToUser>[] = [];
    let total = 0;

    const unpaidGroup = paymentStatus === "unpaid_group";

    if (scope === "staff") {
      const rows = await supabaseSelect("profiles", { order: "created_at.desc.nullslast" });
      users = rows.map(mapProfileRowToUser).filter((user) => user.role === "admin" || user.role === "moderator");
      total = users.length;
    } else if (q || unpaidGroup) {
      // Busca textual exige fallback por enquanto (filtro composto em displayName/email)
      const rows = await supabaseSelect("profiles", { order: "created_at.desc.nullslast" });
      const filtered = rows
        .map(mapProfileRowToUser)
        .filter((user) => {
          const matchesQ =
            String(user.displayName || "").toLowerCase().includes(q) ||
            String(user.email || "").toLowerCase().includes(q);
          const matchesRole = !role || role === "all" || String(user.role) === role;
          const matchesPlan = !plan || plan === "all" || String(user.plan) === plan;
          const matchesStatus = !status || status === "all" || String(user.status) === status;
          const safePayment = String(user.paymentStatus || "");
          const matchesPayment =
            !paymentStatus ||
            paymentStatus === "all" ||
            (paymentStatus === "unpaid_group"
              ? safePayment !== "paid" && safePayment !== "free"
              : safePayment === paymentStatus);
          return matchesQ && matchesRole && matchesPlan && matchesStatus && matchesPayment;
        });
      total = filtered.length;
      users = filtered.slice((page - 1) * limit, page * limit);
    } else {
      const filters: Record<string, string | undefined> = {};
      if (role && role !== "all") filters.role = role;
      if (plan && plan !== "all") filters.plan = plan;
      if (status && status !== "all") filters.status = status;
      if (paymentStatus && paymentStatus !== "all" && paymentStatus !== "unpaid_group") {
        filters.payment_status = paymentStatus;
      }

      const paged = await supabaseSelectPaged("profiles", {
        select:
          "uid,email,display_name,complete_name,phone,role,plan,status,payment_status,transaction_count,verified_email,block_reason,created_at,deleted_at,raw",
        order: "created_at.desc.nullslast",
        page,
        limit,
        filters,
      });
      users = paged.data.map(mapProfileRowToUser);
      total = paged.total;
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, users, page, limit, total }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_users_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-users:patch", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

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

    await writeAdminAuditLog({
      actorUid: auth.uid,
      action: "admin.users.patch",
      targetUid: body.uid,
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: { updates: body.updates },
    });

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_users_patch_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-users:post", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

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
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "admin.users.normalize",
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
        details: { affected: updateCount },
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
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
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "admin.users.reset_financial_data",
        targetUid: body.uid,
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
        details: { deletedTransactions: deleted },
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
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
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "admin.users.soft_delete",
        targetUid: body.uid,
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
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
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "admin.users.restore",
        targetUid: body.uid,
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
        details: { restoreData: body.restoreData !== false },
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
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
      await writeAdminAuditLog({
        actorUid: auth.uid,
        action: "admin.users.recount_transaction_count",
        targetUid: body.uid,
        requestId: meta.requestId,
        route: meta.route,
        method: meta.method,
        ip: meta.ip,
        userAgent: meta.userAgent,
        details: { count: total },
      });
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return NextResponse.json({ ok: true, count: total }, { status: 200 });
    }

    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_users_post_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

