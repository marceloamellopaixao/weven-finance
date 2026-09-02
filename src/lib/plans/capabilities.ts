import { DEFAULT_FEATURE_ACCESS_CONFIG, DEFAULT_PLANS_CONFIG, FeatureAccessConfig, PlansConfig } from "@/types/system";
import { UserPlan } from "@/types/user";
import { PLAN_CATALOG } from "@/lib/plans/catalog";

export type PlanCapabilities = {
  plan: UserPlan;
  maxTransactionsPerMonth: number | null;
  maxCards: number | null;
  maxGoals: number | null;
  maxFamilyMembers: number | null;
  hasInstallments: boolean;
  hasMonthlyForecast: boolean;
  hasSmartDailyLimit: boolean;
  hasFamilyWorkspace: boolean;
  hasBusinessWorkspace: boolean;
  hasCnpj: boolean;
  hasBusinessCategories: boolean;
  hasExports: boolean;
};

const PLAN_NAMES: Record<UserPlan, string> = {
  free: "Free",
  founder: "Fundador",
  premium: "Premium Individual",
  pro: "Pro",
  family: "Família",
  business: "Business/PJ",
};

export function formatPlanName(plan: UserPlan) {
  return PLAN_NAMES[plan] ?? "Free";
}

export function getNextUpgradePlan(plan: UserPlan): Exclude<UserPlan, "free"> | null {
  if (plan === "free" || plan === "founder") return "premium";
  if (plan === "premium") return "pro";
  return null;
}

function getCatalogCapabilities(plan: UserPlan): Omit<PlanCapabilities, "plan" | "maxTransactionsPerMonth"> {
  const catalog = PLAN_CATALOG[plan] ?? PLAN_CATALOG.free;
  return {
    maxCards: catalog.limits.cards,
    maxGoals: catalog.limits.goals,
    maxFamilyMembers: catalog.limits.familyMembers,
    hasInstallments: catalog.features.installments,
    hasMonthlyForecast: catalog.features.monthlyForecast,
    hasSmartDailyLimit: catalog.features.smartDailyLimit,
    hasFamilyWorkspace: catalog.features.familyProfile,
    hasBusinessWorkspace: catalog.features.businessProfile,
    hasCnpj: catalog.features.cnpj,
    hasBusinessCategories: catalog.features.businessCategories,
    hasExports: catalog.features.exports,
  };
}

export function getPlanCapabilities(
  plan: UserPlan,
  plans: PlansConfig = DEFAULT_PLANS_CONFIG,
  featureAccess: FeatureAccessConfig = DEFAULT_FEATURE_ACCESS_CONFIG
): PlanCapabilities {
  const freeLimitRaw = Number(plans.free.limit ?? DEFAULT_PLANS_CONFIG.free.limit ?? 20);
  const freeLimit = Number.isFinite(freeLimitRaw) && freeLimitRaw > 0 ? freeLimitRaw : 20;
  const base = getCatalogCapabilities(plan);
  const installmentsOverride = featureAccess.effective?.installments;
  const monthlyForecastOverride = featureAccess.effective?.monthlyForecast;
  const smartDailyLimitOverride = featureAccess.effective?.smartDailyLimit;

  return {
    plan,
    ...base,
    hasInstallments: typeof installmentsOverride === "boolean" ? installmentsOverride : base.hasInstallments,
    hasMonthlyForecast: typeof monthlyForecastOverride === "boolean" ? monthlyForecastOverride : base.hasMonthlyForecast,
    hasSmartDailyLimit: typeof smartDailyLimitOverride === "boolean" ? smartDailyLimitOverride : base.hasSmartDailyLimit,
    maxTransactionsPerMonth: plan === "free" ? freeLimit : null,
  };
}

export function buildPlanLimitMessage(params: {
  plan: UserPlan;
  resourceLabel: string;
  resourcePluralLabel: string;
  max: number;
}) {
  const currentPlanName = formatPlanName(params.plan);
  const nextPlan = getNextUpgradePlan(params.plan);
  const nextPlanName = nextPlan ? formatPlanName(nextPlan) : "um plano superior";

  return `Você atingiu o limite do plano ${currentPlanName}. Para liberar mais ${params.resourcePluralLabel}, escolha ${nextPlanName}.`;
}

export function buildMonthlyTransactionLimitMessage(params: {
  plan: UserPlan;
  max: number;
}) {
  const nextPlan = getNextUpgradePlan(params.plan);
  const nextPlanName = nextPlan ? formatPlanName(nextPlan) : "Premium Individual";
  return `Você atingiu o limite do plano grátis. Para continuar registrando transações sem limite, escolha ${nextPlanName}.`;
}

export function buildFamilyUpgradeMessage() {
  return {
    title: "Esse recurso faz parte do plano Família.",
    description: "Com ele, você pode organizar as finanças da casa com outras pessoas.",
    action: "Conhecer plano Família",
  };
}

export function buildBusinessUpgradeMessage() {
  return {
    title: "Esse recurso faz parte do plano Business/PJ.",
    description: "Use esse plano para controlar MEI, CNPJ, igreja, projeto profissional ou pequeno negócio.",
    action: "Conhecer Business/PJ",
  };
}
