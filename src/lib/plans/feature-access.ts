import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig, ManagedFeatureGrant, ManagedFeatureKey } from "@/types/system";
import { UserPlan } from "@/types/user";

function isValidDate(value: string | null | undefined) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isGrantActiveNow(grant: ManagedFeatureGrant, now = new Date()) {
  if (!grant.active) return false;

  const nowMs = now.getTime();
  if (isValidDate(grant.startsAt) && new Date(grant.startsAt as string).getTime() > nowMs) {
    return false;
  }
  if (isValidDate(grant.endsAt) && new Date(grant.endsAt as string).getTime() < nowMs) {
    return false;
  }

  return true;
}

export function normalizeFeatureAccessConfig(value: unknown): FeatureAccessConfig {
  if (!value || typeof value !== "object") return DEFAULT_FEATURE_ACCESS_CONFIG;
  const raw = value as { grants?: unknown };
  const grants: ManagedFeatureGrant[] = Array.isArray(raw.grants)
    ? raw.grants.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const grant = entry as Record<string, unknown>;
        const feature = grant.feature;
        const scope = grant.scope;
        if (
          feature !== "installments" &&
          feature !== "monthlyForecast" &&
          feature !== "smartDailyLimit"
        ) {
          return [];
        }
        if (scope !== "all" && scope !== "free" && scope !== "premium" && scope !== "pro") {
          return [];
        }

        const id = String(grant.id || "").trim();
        if (!id) return [];

        return [
          {
            id,
            feature,
            scope,
            label: typeof grant.label === "string" ? grant.label : "",
            active: grant.active !== false,
            startsAt: typeof grant.startsAt === "string" ? grant.startsAt : null,
            endsAt: typeof grant.endsAt === "string" ? grant.endsAt : null,
          },
        ];
      })
    : [];

  return { grants };
}

export function hasManagedFeatureAccess(
  feature: ManagedFeatureKey,
  plan: UserPlan,
  config: FeatureAccessConfig = DEFAULT_FEATURE_ACCESS_CONFIG,
  now = new Date()
) {
  return config.grants.some(
    (grant) =>
      grant.feature === feature &&
      (grant.scope === "all" || grant.scope === plan) &&
      isGrantActiveNow(grant, now)
  );
}
