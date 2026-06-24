import type { PlanDetails, PlansConfig } from "@/types/system";
import { PLAN_CATALOG } from "@/lib/plans/catalog";

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
  cta: string;
};

const PLAN_TONES: Record<PlanKey, PlanTone> = {
  free: {
    shell: "bg-linear-to-br from-zinc-700 via-zinc-800 to-zinc-950 shadow-zinc-500/20",
    border: "border-zinc-300/45",
    header: "border-b border-zinc-300/25 bg-zinc-200/10",
    headerTitle: "text-zinc-200",
    headerDescription: "text-zinc-300/75",
    switchChecked: "data-[state=checked]:bg-zinc-600",
    medal: "text-zinc-200",
    accent: "bg-zinc-600",
    accentText: "text-zinc-600 dark:text-zinc-300",
    softCard: "border-zinc-300/40 bg-zinc-100/80 dark:border-zinc-700 dark:bg-zinc-900/25",
    topBar: "bg-zinc-500",
    action: "bg-zinc-800 text-white hover:bg-zinc-950 shadow-zinc-500/20",
    actionOutline: "border-zinc-500 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900/30",
  },
  founder: {
    shell: "bg-linear-to-br from-amber-700 via-yellow-700 to-zinc-950 shadow-amber-500/20",
    border: "border-amber-400/55",
    header: "border-b border-amber-300/30 bg-amber-300/10",
    headerTitle: "text-amber-300",
    headerDescription: "text-amber-200/75",
    switchChecked: "data-[state=checked]:bg-amber-600",
    medal: "text-amber-200",
    accent: "bg-amber-500",
    accentText: "text-amber-700 dark:text-amber-300",
    softCard: "border-amber-300/45 bg-amber-100/75 dark:bg-amber-950/20",
    topBar: "bg-amber-500",
    action: "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-500/20",
    actionOutline: "border-amber-500 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-950/30",
  },
  premium: {
    shell: "bg-linear-to-br from-emerald-700 via-teal-800 to-zinc-950 shadow-emerald-500/20",
    border: "border-emerald-400/45",
    header: "border-b border-emerald-300/30 bg-emerald-200/10",
    headerTitle: "text-emerald-300",
    headerDescription: "text-emerald-200/75",
    switchChecked: "data-[state=checked]:bg-emerald-600",
    medal: "text-emerald-200",
    accent: "bg-emerald-600",
    accentText: "text-emerald-700 dark:text-emerald-300",
    softCard: "border-emerald-300/40 bg-emerald-50/85 dark:border-emerald-800 dark:bg-emerald-950/20",
    topBar: "bg-emerald-600",
    action: "bg-emerald-700 text-white hover:bg-emerald-800 shadow-emerald-500/20",
    actionOutline: "border-emerald-500 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30",
  },
  pro: {
    shell: "bg-linear-to-br from-blue-700 via-indigo-800 to-zinc-950 shadow-blue-500/20",
    border: "border-blue-400/45",
    header: "border-b border-blue-300/25 bg-blue-300/10",
    headerTitle: "text-blue-300",
    headerDescription: "text-blue-200/75",
    switchChecked: "data-[state=checked]:bg-blue-600",
    medal: "text-blue-200",
    accent: "bg-blue-600",
    accentText: "text-blue-700 dark:text-blue-300",
    softCard: "border-blue-300/40 bg-blue-50/85 dark:bg-blue-950/20",
    topBar: "bg-blue-600",
    action: "bg-blue-700 text-white hover:bg-blue-800 shadow-blue-500/20",
    actionOutline: "border-blue-500 text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/30",
  },
  family: {
    shell: "bg-linear-to-br from-rose-700 via-pink-800 to-zinc-950 shadow-rose-500/20",
    border: "border-rose-400/45",
    header: "border-b border-rose-300/25 bg-rose-300/10",
    headerTitle: "text-rose-300",
    headerDescription: "text-rose-200/75",
    switchChecked: "data-[state=checked]:bg-rose-600",
    medal: "text-rose-200",
    accent: "bg-rose-600",
    accentText: "text-rose-700 dark:text-rose-300",
    softCard: "border-rose-300/40 bg-rose-50/85 dark:bg-rose-950/20",
    topBar: "bg-rose-600",
    action: "bg-rose-700 text-white hover:bg-rose-800 shadow-rose-500/20",
    actionOutline: "border-rose-500 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30",
  },
  business: {
    shell: "bg-linear-to-br from-cyan-800 via-slate-800 to-zinc-950 shadow-cyan-500/20",
    border: "border-cyan-400/45",
    header: "border-b border-cyan-300/25 bg-cyan-300/10",
    headerTitle: "text-cyan-300",
    headerDescription: "text-cyan-200/75",
    switchChecked: "data-[state=checked]:bg-cyan-600",
    medal: "text-cyan-200",
    accent: "bg-cyan-600",
    accentText: "text-cyan-700 dark:text-cyan-300",
    softCard: "border-cyan-300/40 bg-cyan-50/85 dark:bg-cyan-950/20",
    topBar: "bg-cyan-600",
    action: "bg-cyan-700 text-white hover:bg-cyan-800 shadow-cyan-500/20",
    actionOutline: "border-cyan-500 text-cyan-700 hover:bg-cyan-50 dark:text-cyan-300 dark:hover:bg-cyan-950/30",
  },
};

export function getPlanTone(plan: PlanKey): PlanTone {
  return PLAN_TONES[plan] ?? PLAN_TONES.free;
}

export function getLocalizedPlanCopy(_t: (key: string) => string, plan: PlanKey, fallback?: Partial<PlanDetails>): LocalizedPlanCopy {
  const catalog = PLAN_CATALOG[plan];
  return {
    name: fallback?.name || catalog.publicName,
    tier: catalog.badge || "",
    title: fallback?.name || catalog.publicName,
    tag: fallback?.badge || catalog.badge || "",
    description: fallback?.description || catalog.description,
    features: fallback?.features?.length ? fallback.features : catalog.benefits,
    cta: fallback?.cta || catalog.cta,
  };
}
