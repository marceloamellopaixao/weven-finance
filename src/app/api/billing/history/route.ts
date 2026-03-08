import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { supabaseSelect } from "@/services/supabase/admin";

type BillingHistoryItem = {
  id: string;
  createdAt: string | null;
  provider: string;
  eventType: string;
  action: string;
  plan: string | null;
  paymentStatus: string | null;
  amount: number | null;
  currency: string | null;
};

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function mapBillingHistoryItem(row: Record<string, unknown>): BillingHistoryItem {
  const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const transaction = ((raw.transaction as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;
  const planContext = ((raw.planContext as Record<string, unknown> | undefined) ?? {}) as Record<
    string,
    unknown
  >;

  return {
    id: String(row.id || ""),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    provider: String(row.provider || "mercadopago"),
    eventType: String(row.event_type || ""),
    action: String(row.action || ""),
    plan:
      (typeof raw.plan === "string" && raw.plan) ||
      (typeof planContext.plan === "string" && planContext.plan) ||
      null,
    paymentStatus:
      (typeof raw.paymentStatus === "string" && raw.paymentStatus) ||
      (typeof transaction.status === "string" && transaction.status) ||
      null,
    amount: toNumber(transaction.amount) ?? toNumber(raw.amount),
    currency:
      (typeof transaction.currency_id === "string" && transaction.currency_id) ||
      (typeof raw.currency === "string" && raw.currency) ||
      null,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const meta = getRequestMeta(request);
  let uid: string | null = null;

  try {
    const rate = await checkRateLimit(request, { key: "api:billing-history:get", max: 60, windowMs: 60_000 });
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

    const decoded = await verifyRequestAuth(request);
    uid = decoded.uid;

    const rows = await supabaseSelect("billing_events", {
      select: "id,provider,event_type,action,raw,created_at",
      filters: { uid: decoded.uid },
      order: "created_at.desc.nullslast",
      limit: 50,
    });

    const history = rows.map(mapBillingHistoryItem);

    await writeApiMetric({
      route: meta.route,
      method: meta.method,
      status: 200,
      durationMs: Date.now() - startedAt,
      requestId: meta.requestId,
      uid,
    });

    return NextResponse.json({ ok: true, history }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;

    apiLogger.error({
      message: "billing_history_get_failed",
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
