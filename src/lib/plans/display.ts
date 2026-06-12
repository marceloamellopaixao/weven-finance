import type { PlanDetails, PlansConfig } from "@/types/system";

export type PlanKey = keyof PlansConfig;

export type PlanTone = {
  shell: string;
  border: string;
  header: string;
  headerTitle: string;
  headerDescription: string;
  switchChecked: string;
  medal: string;
  accent: string;
  accentText: string;
  softCard: string;
  topBar: string;
  action: string;
  actionOutline: string;
};

export type LocalizedPlanCopy = {
  name: string;
  tier: string;
  title: string;
  tag: string;
  description: string;
  features: string[];
};

type TranslateFn = (key: string) => string;

const PLAN_FEATURE_KEYS: Record<PlanKey, string[]> = {
  free: [
    "billing.planCatalog.free.features.transactionsLimit",
    "billing.planCatalog.free.features.oneCard",
    "billing.planCatalog.free.features.oneGoal",
    "billing.planCatalog.free.features.monthlyFlow",
  ],
  premium: [
    "billing.planCatalog.premium.features.unlimitedTransactions",
    "billing.planCatalog.premium.features.fiveCards",
    "billing.planCatalog.premium.features.fiveGoals",
    "billing.planCatalog.premium.features.installmentsForecast",
  ],
  pro: [
    "billing.planCatalog.pro.features.allPremium",
    "billing.planCatalog.pro.features.unlimitedCardsGoals",
    "billing.planCatalog.pro.features.smartDailyLimit",
    "billing.planCatalog.pro.features.decisionClarity",
  ],
};

const PLAN_TONES: Record<PlanKey, PlanTone> = {
  free: {
    shell: "bg-linear-to-br from-[#5c3a21] via-[#704924] to-[#2f2118] shadow-[#8a5a2b]/25",
    border: "border-[#b08d57]/45",
    header: "border-b border-[#b08d57]/25 bg-[#5c3a21]/12",
    headerTitle: "text-[#c89553]",
    headerDescription: "text-[#c89553]/75",
    switchChecked: "data-[state=checked]:bg-[#b87333]",
    medal: "text-[#c89553]",
    accent: "bg-[#b87333]",
    accentText: "text-[#b87333]",
    softCard: "border-[#b08d57]/35 bg-[#6d4c2f]/10",
    topBar: "bg-[#b87333]",
    action: "bg-[#8a5a2b] text-white hover:bg-[#70451f] shadow-[#8a5a2b]/20",
    actionOutline: "border-[#b87333] text-[#b87333] hover:bg-[#b87333]/10",
  },
  premium: {
    shell: "bg-linear-to-br from-slate-700 via-zinc-700 to-slate-950 shadow-slate-500/20",
    border: "border-slate-400/45",
    header: "border-b border-slate-300/30 bg-slate-200/10",
    headerTitle: "text-slate-300",
    headerDescription: "text-slate-300/75",
    switchChecked: "data-[state=checked]:bg-slate-600",
    medal: "text-slate-200",
    accent: "bg-slate-500",
    accentText: "text-slate-500",
    softCard: "border-slate-300/40 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/25",
    topBar: "bg-slate-400",
    action: "bg-slate-700 text-white hover:bg-slate-800 shadow-slate-500/20",
    actionOutline: "border-slate-500 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900/30",
  },
  pro: {
    shell: "bg-linear-to-br from-[#6f4e05] via-[#8a640b] to-[#342505] shadow-[#d4af37]/20",
    border: "border-[#d4af37]/45",
    header: "border-b border-[#d4af37]/25 bg-[#d4af37]/12",
    headerTitle: "text-[#d4af37]",
    headerDescription: "text-[#d4af37]/75",
    switchChecked: "data-[state=checked]:bg-[#b88a12]",
    medal: "text-[#f5d66b]",
    accent: "bg-[#d4af37]",
    accentText: "text-[#b8860b]",
    softCard: "border-[#d4af37]/40 bg-[#d4af37]/10",
    topBar: "bg-[#d4af37]",
    action: "bg-[#8a640b] text-white hover:bg-[#6f4e05] shadow-[#d4af37]/20",
    actionOutline: "border-[#b8860b] text-[#b8860b] hover:bg-[#d4af37]/10 dark:text-[#f5d66b] dark:hover:bg-[#d4af37]/10",
  },
};

export function getPlanTone(plan: PlanKey): PlanTone {
  return PLAN_TONES[plan];
}

export function getLocalizedPlanCopy(t: TranslateFn, plan: PlanKey, fallback?: Partial<PlanDetails>): LocalizedPlanCopy {
  const baseKey = `billing.planCatalog.${plan}`;
  const translatedFeatures = PLAN_FEATURE_KEYS[plan].map((key) => t(key));
  const hasMissingFeature = translatedFeatures.some((feature) => feature.startsWith("billing.planCatalog."));

  return {
    name: t(`${baseKey}.name`) || fallback?.name || plan,
    tier: t(`${baseKey}.tier`),
    title: t(`${baseKey}.title`) || fallback?.name || plan,
    tag: t(`${baseKey}.tag`),
    description: t(`${baseKey}.description`) || fallback?.description || "",
    features: hasMissingFeature ? fallback?.features ?? [] : translatedFeatures,
  };
}
