import { supabaseUpsertRows } from "@/services/supabase/admin";
import type { PerformanceMetricName } from "@/lib/observability/performance";

type ApiMetricInput = {
  route: string;
  method: string;
  status: number;
  durationMs: number;
  requestId?: string;
  uid?: string | null;
  errorCode?: string | null;
};

export async function writeApiMetric(input: ApiMetricInput) {
  if (process.env.ENABLE_API_METRICS !== "true") return;

  const row = {
    id: crypto.randomUUID(),
    route: input.route,
    method: input.method,
    status: input.status,
    duration_ms: Math.max(0, Math.round(input.durationMs)),
    request_id: input.requestId || null,
    uid: input.uid || null,
    error_code: input.errorCode || null,
    created_at: new Date().toISOString(),
  };

  try {
    await supabaseUpsertRows("api_request_metrics", [row], { onConflict: "id" });
  } catch {
    // best effort
  }
}

export async function writePerformanceMetric(input: {
  name: PerformanceMetricName;
  durationMs: number;
  route?: string;
  correlationId?: string;
  rating?: string;
  errorCode?: string;
}) {
  if (process.env.ENABLE_PERFORMANCE_METRICS !== "true") return;
  try {
    await supabaseUpsertRows("performance_metrics", [{
      id: crypto.randomUUID(),
      metric_name: input.name,
      duration_ms: Math.max(0, Math.round(input.durationMs * 100) / 100),
      route: input.route || null,
      correlation_id: input.correlationId || null,
      rating: input.rating || null,
      error_code: input.errorCode || null,
      created_at: new Date().toISOString(),
    }], { onConflict: "id" });
  } catch {
    // Telemetry is best effort and must never block the user journey.
  }
}
