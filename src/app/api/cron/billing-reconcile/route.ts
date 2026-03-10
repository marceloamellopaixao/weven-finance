import { NextRequest, NextResponse } from "next/server";
import { syncFromWebhook } from "@/lib/billing/mercadopago";
import { isValidCronRequest } from "@/lib/cron/auth";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { sendExternalAlert } from "@/lib/observability/alerts";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

type ReconcileCandidate = {
  id: string;
  topic: "payment" | "merchant_order" | "preapproval";
  resourceId: string;
  action: string | null;
  eventId: string | null;
  status: string;
  raw: Record<string, unknown>;
};

function parseTopic(value: unknown): ReconcileCandidate["topic"] | null {
  if (value === "payment" || value === "merchant_order" || value === "preapproval") return value;
  return null;
}

function toCandidate(row: Record<string, unknown>): ReconcileCandidate | null {
  const id = typeof row.id === "string" ? row.id : null;
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const topic = parseTopic(raw.topic ?? row.event_type);
  const resourceId = typeof raw.resourceId === "string" ? raw.resourceId : null;
  const status = typeof raw.status === "string" ? raw.status : "";

  if (!id || !topic || !resourceId) return null;

  return {
    id,
    topic,
    resourceId,
    action: typeof raw.action === "string" ? raw.action : null,
    eventId: typeof raw.eventId === "string" ? raw.eventId : null,
    status,
    raw,
  };
}

function isEligibleStatus(status: string, onlyFailed: boolean) {
  if (onlyFailed) return status === "error" || status === "retry_failed";
  if (!status) return true;
  return status !== "processed" && status !== "processed_retry" && status !== "simulated_ignored";
}

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

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || process.env.BILLING_RECONCILE_CRON_LIMIT || "50"), 1), 200);
    const onlyFailed = request.nextUrl.searchParams.get("onlyFailed") !== "false";

    const rows = await supabaseSelect("billing_events", {
      select: "id,event_type,raw,created_at",
      filters: { provider: "mercadopago" },
      order: "created_at.desc.nullslast",
      limit: 1000,
    });

    const candidates = rows
      .map((row) => toCandidate(row))
      .filter((item): item is ReconcileCandidate => Boolean(item))
      .filter((item) => isEligibleStatus(item.status, onlyFailed))
      .slice(0, limit);

    const processed: Array<{ id: string; status: "ok" | "error"; error?: string }> = [];

    for (const item of candidates) {
      try {
        const result = await syncFromWebhook({
          topic: item.topic,
          resourceId: item.resourceId,
          action: item.action,
          eventId: item.eventId,
          signatureHeader: null,
          requestIdHeader: null,
          rawBody: "",
        });

        await supabaseUpsertRows(
          "billing_events",
          [
            {
              id: item.id,
              raw: {
                ...item.raw,
                status: "processed_retry",
                retryAt: new Date().toISOString(),
                retryBy: "cron",
                retryResult: result,
              },
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "id" }
        );
        processed.push({ id: item.id, status: "ok" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        await supabaseUpsertRows(
          "billing_events",
          [
            {
              id: item.id,
              raw: {
                ...item.raw,
                status: "retry_failed",
                retryAt: new Date().toISOString(),
                retryBy: "cron",
                retryError: message,
              },
              updated_at: new Date().toISOString(),
            },
          ],
          { onConflict: "id" }
        );
        processed.push({ id: item.id, status: "error", error: message });
      }
    }

    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
    });

    return NextResponse.json(
      {
        ok: true,
        limit,
        onlyFailed,
        found: candidates.length,
        success: processed.filter((item) => item.status === "ok").length,
        failed: processed.filter((item) => item.status === "error").length,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await sendExternalAlert({
      source: "cron_billing_reconcile",
      title: "Falha na reconciliação automática de billing",
      message,
      level: "critical",
      meta: { requestId: meta.requestId, route: meta.route, method: meta.method },
    });
    apiLogger.error({
      message: "cron_billing_reconcile_failed",
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
