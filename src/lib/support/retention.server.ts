import "server-only";

import { getSupabaseServiceClient } from "@/services/supabase/service-client";

const SUPPORT_EVIDENCE_BUCKET = "support-evidence";

export async function runExpiredSupportEvidenceCleanup(limit = 200) {
  const client = getSupabaseServiceClient();
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const { data, error } = await client
    .from("support_request_attachments")
    .select("id,storage_path")
    .not("retention_until", "is", null)
    .lte("retention_until", new Date().toISOString())
    .order("retention_until", { ascending: true })
    .limit(safeLimit);
  if (error) throw new Error("support_retention_lookup_failed");
  if (!data?.length) return { removed: 0 };

  const paths = data.map((row) => String(row.storage_path || "")).filter(Boolean);
  if (paths.length > 0) {
    const { error: storageError } = await client.storage.from(SUPPORT_EVIDENCE_BUCKET).remove(paths);
    if (storageError) throw new Error("support_retention_storage_failed");
  }
  const ids = data.map((row) => String(row.id || "")).filter(Boolean);
  const { error: deleteError } = await client.from("support_request_attachments").delete().in("id", ids);
  if (deleteError) throw new Error("support_retention_delete_failed");
  return { removed: ids.length };
}
