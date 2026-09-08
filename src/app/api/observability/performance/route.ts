import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { writePerformanceMetric } from "@/lib/observability/metrics";
import { isPerformanceMetricName, sanitizeMetricCategory, sanitizeMetricRoute } from "@/lib/observability/performance";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rate = await checkRateLimit(request, { key: "api:performance:post", max: 120, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 }); }
  if (!isPerformanceMetricName(body.name)) return NextResponse.json({ ok: false, error: "invalid_metric" }, { status: 400 });
  const durationMs = Number(body.durationMs);
  if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 600_000) {
    return NextResponse.json({ ok: false, error: "invalid_duration" }, { status: 400 });
  }
  await writePerformanceMetric({
    name: body.name,
    durationMs,
    route: sanitizeMetricRoute(body.route),
    correlationId: sanitizeMetricCategory(body.correlationId) || sanitizeMetricCategory(request.headers.get("x-request-id")),
    rating: sanitizeMetricCategory(body.rating),
    errorCode: sanitizeMetricCategory(body.errorCode),
  });
  return NextResponse.json({ ok: true }, { status: 202 });
}
