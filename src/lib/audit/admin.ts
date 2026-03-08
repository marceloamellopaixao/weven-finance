import { supabaseUpsertRows } from "@/services/supabase/admin";

type AdminAuditInput = {
  actorUid: string;
  action: string;
  targetUid?: string | null;
  requestId?: string | null;
  route?: string | null;
  method?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
};

export async function writeAdminAuditLog(input: AdminAuditInput) {
  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();

  const row = {
    id,
    actor_uid: input.actorUid,
    action: input.action,
    target_uid: input.targetUid || null,
    request_id: input.requestId || null,
    route: input.route || null,
    method: input.method || null,
    ip: input.ip || null,
    user_agent: input.userAgent || null,
    details: input.details || {},
    created_at: nowIso,
    updated_at: nowIso,
  };

  try {
    await supabaseUpsertRows("admin_audit_logs", [row], { onConflict: "id" });
  } catch (error) {
    console.warn(
      JSON.stringify({
        ts: new Date().toISOString(),
        level: "warn",
        message: "admin_audit_log_write_failed",
        error: error instanceof Error ? error.message : "unknown_error",
      })
    );
  }
}
