import { supabaseSelect } from "@/services/supabase/admin";
import { normalizeFeatureAccessConfig } from "@/lib/plans/feature-access";
import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig, DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan, UserRole } from "@/types/user";

export function resolveUserPlan(value: unknown): UserPlan {
  if (value === "premium" || value === "pro") return value;
  return "free";
}

export function resolveUserRole(value: unknown): UserRole {
  if (value === "admin" || value === "moderator" || value === "support") return value;
  return "client";
}

export function isBillingExemptRole(role: UserRole) {
  return role === "admin" || role === "moderator";
}

export async function getUserPlanContext(uid: string): Promise<{
  plan: UserPlan;
  plans: PlansConfig;
  featureAccess: FeatureAccessConfig;
  role: UserRole;
  isBillingExempt: boolean;
}> {
  const [profileRows, plansRows, featureAccessRows] = await Promise.all([
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
      filters: { key: "feature_access" },
      limit: 1,
    }),
  ]);

  const raw = (profileRows[0]?.raw as Record<string, unknown> | null) ?? {};
  const rawPlan = profileRows[0]?.plan ?? raw.plan;
  const rawRole = profileRows[0]?.role ?? raw.role;
  const plan = resolveUserPlan(rawPlan);
  const role = resolveUserRole(rawRole);
  const plans = (plansRows[0]?.data as PlansConfig | undefined) ?? DEFAULT_PLANS_CONFIG;
  const featureAccess = featureAccessRows.length > 0
    ? normalizeFeatureAccessConfig(featureAccessRows[0]?.data)
    : DEFAULT_FEATURE_ACCESS_CONFIG;

  return {
    plan,
    plans,
    featureAccess,
    role,
    isBillingExempt: isBillingExemptRole(role),
  };
}
