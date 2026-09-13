import "server-only";

import { supabaseDeleteByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export async function resetUserFinancialData(uid: string) {
  const rows = await supabaseSelect("transactions", {
    select: "source_id",
    filters: { uid },
  });

  for (const row of rows) {
    const sourceId = String(row.source_id || "");
    if (!sourceId) continue;
    await supabaseDeleteByFilters("transactions", { uid, source_id: sourceId });
  }

  await supabaseUpsertRows(
    "profiles",
    [{ uid, transaction_count: 0, updated_at: new Date().toISOString() }],
    { onConflict: "uid" },
  );

  return rows.length;
}
