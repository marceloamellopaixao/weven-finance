import { supabaseUpsertRows } from "@/services/supabase/admin";

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
