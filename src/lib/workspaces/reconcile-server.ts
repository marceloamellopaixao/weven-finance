import "server-only";

import { reconcileWorkspaceRowsForPlan, type WorkspacePlanRow } from "@/lib/workspaces/plan-policy";
import { supabasePatchByFilters, supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import type { UserPlan } from "@/types/user";

export async function reconcileOwnedWorkspacesForPlan(uid: string, plan: UserPlan) {
  const rows = await supabaseSelect("workspaces", {
    select: "id,uid,source_id,name,workspace_type,is_default,settings,raw,created_at,updated_at",
    filters: { uid },
    order: "is_default.desc,created_at.asc",
    limit: 100,
  }) as WorkspacePlanRow[];
  const result = reconcileWorkspaceRowsForPlan(rows, plan);
  if (!result.changed) return result.rows;

  await supabaseUpsertRows("workspaces", result.rows, { onConflict: "id" });
  const now = new Date().toISOString();
  for (const workspaceId of result.closedSharedWorkspaceIds) {
    await supabasePatchByFilters(
      "workspace_members",
      { workspace_uid: uid, workspace_id: workspaceId },
      { member_status: "disabled", updated_at: now },
    );
    await supabasePatchByFilters(
      "workspace_invitations",
      { workspace_uid: uid, workspace_id: workspaceId },
      { invitation_status: "revoked", updated_at: now },
    );
  }
  return result.rows;
}
