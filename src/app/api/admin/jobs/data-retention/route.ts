import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { runDeletedAccountGraceCleanup } from "@/lib/account-archive/server";
import { requireAccessResource } from "@/lib/access-control/server";
import { supabaseRpc } from "@/services/supabase/admin";

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

    const { auth } = await requireAccessResource(request, "admin.retention_jobs", "write");
    uid = auth.uid;

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

