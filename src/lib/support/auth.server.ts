import "server-only";

import type { NextRequest } from "next/server";

import { CREATOR_SUPREME_UID, getServerAccessControlConfig, isAccessAllowed, type ServerAccessProfile } from "@/lib/access-control/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { parseUserPlan } from "@/lib/plans/catalog";
import { readSecureProfilePayload } from "@/lib/secure-store/profile";
import { supabaseSelect } from "@/services/supabase/admin";
import { getSupportCenterDecision } from "@/lib/features/support-center.server";

export type SupportAuthContext = ServerAccessProfile & {
  email: string;
  name: string;
  requesterUid: string;
  requesterRole: string;
  isImpersonating: boolean;
  aal: "aal1" | "aal2";
};

export function requireSupportStaffMfa(auth: Pick<SupportAuthContext, "aal">) {
  if (auth.aal !== "aal2") throw new Error("mfa_required");
}

export async function getSupportAuthContext(
  request: NextRequest,
  options: { skipFeatureGate?: boolean } = {},
): Promise<SupportAuthContext> {
  const decoded = await verifyRequestAuth(request);
  const acting = await resolveActingContext(request);
  const [requesterRows, actingRows] = await Promise.all([
    supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 }),
    supabaseSelect("profiles", { filters: { uid: acting.actingUid }, limit: 1 }),
  ]);
  if (actingRows.length === 0) throw new Error("user_not_found");

  const row = actingRows[0];
  const raw = readSecureProfilePayload(row.raw);
  const requesterRaw = ((requesterRows[0]?.raw as Record<string, unknown> | null) ?? {});
  const requesterRole = String(requesterRows[0]?.role || requesterRaw.role || "client");
  const effectiveRole = acting.isImpersonating ? "client" : requesterRole;

  const context: SupportAuthContext = {
    uid: acting.actingUid,
    email: String(row.email || raw.email || acting.actingEmail || ""),
    name: String(row.display_name || raw.displayName || raw.completeName || acting.actingDisplayName || "Usuário"),
    role: effectiveRole,
    plan: parseUserPlan(row.plan ?? raw.plan),
    isSupremeAdmin: !acting.isImpersonating && decoded.uid === CREATOR_SUPREME_UID,
    requesterUid: acting.requesterUid,
    requesterRole,
    isImpersonating: acting.isImpersonating,
    aal: decoded.aal,
  };
  if (!options.skipFeatureGate) {
    const requesterProfile: ServerAccessProfile = {
      uid: decoded.uid,
      role: requesterRole,
      plan: parseUserPlan(requesterRows[0]?.plan ?? requesterRaw.plan),
      isSupremeAdmin: decoded.uid === CREATOR_SUPREME_UID,
    };
    const accessControl = await getServerAccessControlConfig();
    const canReadSupportInbox = isAccessAllowed(requesterProfile, accessControl, "admin.support.read", "read");
    if (!canReadSupportInbox) {
      const rollout = await getSupportCenterDecision();
      if (!rollout.enabled) throw new Error("forbidden");
    }
  }
  return context;
}
