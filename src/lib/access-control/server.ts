import { NextRequest } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { hasAccess, normalizeAccessControlConfig } from "@/lib/access-control/config";
import {
  AccessControlConfig,
  AccessPermissionLevel,
  AccessResourceKey,
  DEFAULT_ACCESS_CONTROL_CONFIG,
} from "@/types/system";
import { supabaseSelect } from "@/services/supabase/admin";

export const CREATOR_SUPREME_UID = "Z3ciyXudWuZZywhojA6iWJTurH52";

export type ServerAccessProfile = {
  uid: string;
  role: string;
  plan: "free" | "premium" | "pro";
  isSupremeAdmin: boolean;
};

export async function getAccessProfile(uid: string): Promise<ServerAccessProfile> {
  const rows = await supabaseSelect("profiles", {
    select: "role,plan,raw",
    filters: { uid },
    limit: 1,
  });
  const raw = (rows[0]?.raw as Record<string, unknown> | null) ?? {};
  const role = String(rows[0]?.role || raw.role || "client");
  const rawPlan = rows[0]?.plan ?? raw.plan;
  const plan = rawPlan === "premium" || rawPlan === "pro" ? rawPlan : "free";
  return {
    uid,
    role,
    plan,
    isSupremeAdmin: uid === CREATOR_SUPREME_UID,
  };
}

export async function getServerAccessControlConfig(): Promise<AccessControlConfig> {
  const rows = await supabaseSelect("system_configs", {
    select: "data",
    filters: { key: "access_control" },
    limit: 1,
  });
  return rows.length > 0
    ? normalizeAccessControlConfig(rows[0]?.data)
    : DEFAULT_ACCESS_CONTROL_CONFIG;
}

export async function canAccessResource(
  uid: string,
  resource: AccessResourceKey,
  minimum: AccessPermissionLevel = "read",
  accessControl?: AccessControlConfig
) {
  const [profile, config] = await Promise.all([
    getAccessProfile(uid),
    accessControl ? Promise.resolve(accessControl) : getServerAccessControlConfig(),
  ]);
  if (profile.isSupremeAdmin) return true;
  return hasAccess(config, { uid, plan: profile.plan, role: profile.role }, resource, minimum);
}

export function isAccessAllowed(
  profile: ServerAccessProfile,
  accessControl: AccessControlConfig,
  resource: AccessResourceKey,
  minimum: AccessPermissionLevel = "read"
) {
  if (profile.isSupremeAdmin) return true;
  return hasAccess(accessControl, { uid: profile.uid, plan: profile.plan, role: profile.role }, resource, minimum);
}

export async function requireAccessResource(
  request: NextRequest,
  resource: AccessResourceKey,
  minimum: AccessPermissionLevel = "read"
) {
  const auth = await verifyRequestAuth(request);
  const [profile, accessControl] = await Promise.all([
    getAccessProfile(auth.uid),
    getServerAccessControlConfig(),
  ]);
  const allowed =
    profile.isSupremeAdmin ||
    isAccessAllowed(profile, accessControl, resource, minimum);
  if (!allowed) throw new Error("forbidden");
  return { auth, profile, accessControl };
}
