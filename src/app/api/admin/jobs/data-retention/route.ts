import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { runDeletedAccountGraceCleanup } from "@/lib/account-archive/server";
import { supabaseRpc, supabaseSelect } from "@/services/supabase/admin";

type StaffRole = "admin" | "moderator" | "support" | "client";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const role = String(row.role || raw.role || "client") as StaffRole;
  return { uid: decoded.uid, role };
}

function isAdmin(role: StaffRole) {
  return role === "admin";
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-data-retention:post", max: 4, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({
        route: meta.route,
        method: meta.method,
        status: 429,
        durationMs: Date.now() - startedAt,
        requestId: meta.requestId,
        errorCode: "rate_limited",
      });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    uid = auth.uid;
    if (!isAdmin(auth.role)) {
      await writeApiMetric({
        route: meta.route,
        method: meta.method,
        status: 403,
        durationMs: Date.now() - startedAt,
        requestId: meta.requestId,
        uid,
        errorCode: "forbidden",
      });
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const [result, deletedAccounts] = await Promise.all([
      supabaseRpc("run_data_retention_tasks"),
      runDeletedAccountGraceCleanup(),
    ]);
    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
      uid,
    });
    return NextResponse.json({ ok: true, result, deletedAccounts }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;

    apiLogger.error({
      message: "admin_data_retention_post_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
      uid,
      errorCode: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

