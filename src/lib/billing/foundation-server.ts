import "server-only";

import { getFoundationUserLimit } from "@/lib/billing/foundation";
import { supabaseRpc, supabaseUpsertRows } from "@/services/supabase/admin";

export async function claimFoundationPlanSlot(uid: string) {
  try {
    const result = await supabaseRpc("claim_foundation_plan_slot", {
      p_uid: uid,
      p_max_users: getFoundationUserLimit(),
    });
    if (result !== true) throw new Error("foundation_plan_limit_reached");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error || "");
    if (message === "foundation_plan_limit_reached") throw error;
    if (message.includes("claim_foundation_plan_slot") || message.includes("foundation_plan_claims")) {
      throw new Error("foundation_plan_database_not_configured");
    }
    throw error;
  }
}

export async function activateFoundationPlanClaim(uid: string, activatedAt = new Date().toISOString()) {
  await supabaseUpsertRows("foundation_plan_claims", [{
    uid,
    claim_status: "active",
    activated_at: activatedAt,
    expires_at: null,
    updated_at: activatedAt,
  }], { onConflict: "uid" });
}
