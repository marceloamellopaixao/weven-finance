import { NextRequest, NextResponse } from "next/server";
import { supabaseRpc } from "@/services/supabase/admin";
import { isValidCronRequest } from "@/lib/cron/auth";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { sendExternalAlert } from "@/lib/observability/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    if (!isValidCronRequest(request)) {
      await writeApiMetric({
        route: meta.route,
        method: meta.method,
        status: 401,
        durationMs: Date.now() - startedAt,
        requestId: meta.requestId,
        errorCode: "cron_unauthorized",
      });
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const result = await supabaseRpc("run_data_retention_tasks");
    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
    });
    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await sendExternalAlert({
      source: "cron_data_retention",
      title: "Falha na retenção/anonymização automática",
      message,
      level: "error",
      meta: { requestId: meta.requestId, route: meta.route, method: meta.method },
    });
    apiLogger.error({
      message: "cron_data_retention_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status: 500,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
      errorCode: message,
    });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
