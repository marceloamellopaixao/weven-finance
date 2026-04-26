import { supabaseSelect } from "@/services/supabase/admin";
import { buildEffectiveFeatureAccessConfig, hasBillingExemption, normalizeAccessControlConfig } from "@/lib/access-control/config";
import {
  AccessControlConfig,
  DEFAULT_ACCESS_CONTROL_CONFIG,
  FeatureAccessConfig,
  DEFAULT_PLANS_CONFIG,
  PlansConfig,
} from "@/types/system";
import { UserPlan, UserRole } from "@/types/user";

export function resolveUserPlan(value: unknown): UserPlan {
  if (value === "premium" || value === "pro") return value;
  return "free";
}

export function resolveUserRole(value: unknown): UserRole {
  if (typeof value === "string") {
    const role = value.trim().toLowerCase();
    if (/^[a-z0-9_-]{2,40}$/.test(role)) return role as UserRole;
  }
  return "client";
}

export function isBillingExemptRole(role: UserRole) {
  return role === "admin" || role === "moderator";
}

export async function getUserPlanContext(uid: string): Promise<{
  plan: UserPlan;
  plans: PlansConfig;
  featureAccess: FeatureAccessConfig;
  accessControl: AccessControlConfig;
  role: UserRole;
  isBillingExempt: boolean;
}> {
  const [profileRows, plansRows, accessControlRows] = await Promise.all([
    supabaseSelect("profiles", {
      select: "plan,role,raw",
      filters: { uid },
      limit: 1,
    }),
    supabaseSelect("system_configs", {
      select: "data",
      filters: { key: "plans" },
      limit: 1,
    }),
    supabaseSelect("system_configs", {
      select: "data",
      filters: { key: "access_control" },
      limit: 1,
    }),
  ]);

  const raw = (profileRows[0]?.raw as Record<string, unknown> | null) ?? {};
  const rawPlan = profileRows[0]?.plan ?? raw.plan;
  const rawRole = profileRows[0]?.role ?? raw.role;
  const plan = resolveUserPlan(rawPlan);
  const role = resolveUserRole(rawRole);
  const plans = (plansRows[0]?.data as PlansConfig | undefined) ?? DEFAULT_PLANS_CONFIG;
  const accessControl = accessControlRows.length > 0
    ? normalizeAccessControlConfig(accessControlRows[0]?.data)
    : DEFAULT_ACCESS_CONTROL_CONFIG;
  const effectiveFeatureAccess = buildEffectiveFeatureAccessConfig(accessControl, { uid, plan, role });

  return {
    plan,
    plans,
    featureAccess: effectiveFeatureAccess,
    accessControl,
    role,
    isBillingExempt: hasBillingExemption(accessControl, { uid, role }),
  };
}
