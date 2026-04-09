import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig, DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";
import { UserPlan } from "@/types/user";
import { hasManagedFeatureAccess } from "@/lib/plans/feature-access";

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

  return {
    plan,
    ...base,
    hasInstallments: base.hasInstallments || hasManagedFeatureAccess("installments", plan, featureAccess),
    hasMonthlyForecast: base.hasMonthlyForecast || hasManagedFeatureAccess("monthlyForecast", plan, featureAccess),
    hasSmartDailyLimit: base.hasSmartDailyLimit || hasManagedFeatureAccess("smartDailyLimit", plan, featureAccess),
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
  const nextPlanName = nextPlan ? formatPlanName(nextPlan) : "plano superior";
  const quantityLabel = params.max === 1 ? `1 ${params.resourceLabel}` : `${params.max} ${params.resourcePluralLabel}`;

  return `Seu plano ${currentPlanName} permite até ${quantityLabel}. Faça upgrade para o ${nextPlanName} para liberar mais ${params.resourcePluralLabel}.`;
}

export function buildMonthlyTransactionLimitMessage(params: {
  plan: UserPlan;
  max: number;
}) {
  const currentPlanName = formatPlanName(params.plan);
  const nextPlan = getNextUpgradePlan(params.plan);
  const nextPlanName = nextPlan ? formatPlanName(nextPlan) : "plano superior";

  return `Seu plano ${currentPlanName} permite até ${params.max} lançamentos por mês. Faça upgrade para o ${nextPlanName} para continuar registrando sem esse limite.`;
}
