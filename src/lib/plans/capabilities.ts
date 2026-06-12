import type { Locale } from "@/i18n/config";
import { DEFAULT_LOCALE, normalizeLocale } from "@/i18n/config";
import { translate } from "@/i18n/getDictionary";
import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig, DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan } from "@/types/user";

export type PlanCapabilities = {
  plan: UserPlan;
  maxTransactionsPerMonth: number | null;
  maxCards: number | null;
  maxGoals: number | null;
  hasInstallments: boolean;
  hasMonthlyForecast: boolean;
  hasSmartDailyLimit: boolean;
};

const PLAN_NAMES: Record<UserPlan, string> = {
  free: "Free",
  premium: "Premium",
  pro: "Pro",
};

const STATIC_CAPABILITIES: Record<UserPlan, Omit<PlanCapabilities, "plan" | "maxTransactionsPerMonth">> = {
  free: {
    maxCards: 1,
    maxGoals: 1,
    hasInstallments: false,
    hasMonthlyForecast: false,
    hasSmartDailyLimit: false,
  },
  premium: {
    maxCards: 5,
    maxGoals: 5,
    hasInstallments: true,
    hasMonthlyForecast: true,
    hasSmartDailyLimit: false,
  },
  pro: {
    maxCards: null,
    maxGoals: null,
    hasInstallments: true,
    hasMonthlyForecast: true,
    hasSmartDailyLimit: true,
  },
};

export function formatPlanName(plan: UserPlan) {
  return PLAN_NAMES[plan] ?? "Free";
}

export function formatLocalizedPlanName(plan: UserPlan, locale: Locale = DEFAULT_LOCALE) {
  return translate(locale, `billing.planCatalog.${plan}.name`);
}

export function getNextUpgradePlan(plan: UserPlan): Exclude<UserPlan, "free"> | null {
  if (plan === "free") return "premium";
  if (plan === "premium") return "pro";
  return null;
}

export function getPlanCapabilities(
  plan: UserPlan,
  plans: PlansConfig = DEFAULT_PLANS_CONFIG,
  featureAccess: FeatureAccessConfig = DEFAULT_FEATURE_ACCESS_CONFIG
): PlanCapabilities {
  const freeLimitRaw = Number(plans.free.limit ?? DEFAULT_PLANS_CONFIG.free.limit ?? 20);
  const freeLimit = Number.isFinite(freeLimitRaw) && freeLimitRaw > 0 ? freeLimitRaw : 20;
  const base = STATIC_CAPABILITIES[plan] ?? STATIC_CAPABILITIES.free;
  const installmentsOverride = featureAccess.effective?.installments;
  const monthlyForecastOverride = featureAccess.effective?.monthlyForecast;
  const smartDailyLimitOverride = featureAccess.effective?.smartDailyLimit;

  return {
    plan,
    ...base,
    hasInstallments: typeof installmentsOverride === "boolean"
      ? installmentsOverride
      : base.hasInstallments,
    hasMonthlyForecast: typeof monthlyForecastOverride === "boolean"
      ? monthlyForecastOverride
      : base.hasMonthlyForecast,
    hasSmartDailyLimit: typeof smartDailyLimitOverride === "boolean"
      ? smartDailyLimitOverride
      : base.hasSmartDailyLimit,
    maxTransactionsPerMonth: plan === "free" ? freeLimit : null,
  };
}

export function buildPlanLimitMessage(params: {
  plan: UserPlan;
  resourceLabel: string;
  resourcePluralLabel: string;
  max: number;
  locale?: Locale | string;
  resourceKey?: "cards" | "goals";
}) {
  const locale = normalizeLocale(params.locale || DEFAULT_LOCALE);
  const currentPlanName = formatLocalizedPlanName(params.plan, locale);
  const nextPlan = getNextUpgradePlan(params.plan);
  const nextPlanName = nextPlan ? formatLocalizedPlanName(nextPlan, locale) : translate(locale, "billing.planLimits.higherPlan");
  const resourceLabel = params.resourceKey
    ? translate(locale, `billing.planLimits.resources.${params.resourceKey}.${params.max === 1 ? "one" : "many"}`)
    : params.max === 1 ? params.resourceLabel : params.resourcePluralLabel;
  const resourcePlural = params.resourceKey
    ? translate(locale, `billing.planLimits.resources.${params.resourceKey}.many`)
    : params.resourcePluralLabel;
  const quantityLabel = `${params.max} ${resourceLabel}`;

  return translate(locale, "billing.planLimits.generic", {
    currentPlan: currentPlanName,
    quantity: quantityLabel,
    nextPlan: nextPlanName,
    resourcePlural,
  });
}

export function buildMonthlyTransactionLimitMessage(params: {
  plan: UserPlan;
  max: number;
  locale?: Locale | string;
}) {
  const locale = normalizeLocale(params.locale || DEFAULT_LOCALE);
  const currentPlanName = formatLocalizedPlanName(params.plan, locale);
  const nextPlan = getNextUpgradePlan(params.plan);
  const nextPlanName = nextPlan ? formatLocalizedPlanName(nextPlan, locale) : translate(locale, "billing.planLimits.higherPlan");

  return translate(locale, "billing.planLimits.monthlyTransactions", {
    currentPlan: currentPlanName,
    max: params.max,
    nextPlan: nextPlanName,
  });
}
