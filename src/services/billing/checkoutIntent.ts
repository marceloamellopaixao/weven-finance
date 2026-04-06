import { UserPlan } from "@/types/user";

export type UpgradePlan = Exclude<UserPlan, "free">;

const STORAGE_KEY = "wevenfinance:pending-upgrade-plan:v1";

export function parseUpgradePlan(value: unknown): UpgradePlan | null {
  return value === "premium" || value === "pro" ? value : null;
}

export function buildUpgradeCheckoutPath(plan: UpgradePlan) {
  return `/billing/checkout?plan=${plan}`;
}

export function rememberPendingUpgradePlan(plan: UpgradePlan) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, plan);
}

export function readPendingUpgradePlan(): UpgradePlan | null {
  if (typeof window === "undefined") return null;
  return parseUpgradePlan(window.localStorage.getItem(STORAGE_KEY));
}

export function clearPendingUpgradePlan() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function resolvePendingUpgradePath() {
  const plan = readPendingUpgradePlan();
  return plan ? buildUpgradeCheckoutPath(plan) : null;
}
