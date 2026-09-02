import { UserPlan } from "@/types/user";
import { BillingInterval, isPaidPlan } from "@/lib/plans/catalog";

export type UpgradePlan = Exclude<UserPlan, "free">;

const STORAGE_KEY = "wevenfinance:pending-upgrade-plan:v1";
const INTERVAL_STORAGE_KEY = "wevenfinance:pending-upgrade-interval:v1";

export function parseUpgradePlan(value: unknown): UpgradePlan | null {
  return isPaidPlan(value) ? value : null;
}

export function parseBillingInterval(value: unknown): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

export function buildUpgradeCheckoutPath(plan: UpgradePlan, interval: BillingInterval = "monthly") {
  const params = new URLSearchParams({ plan, interval });
  return `/billing/checkout?${params.toString()}`;
}

export function rememberPendingUpgradePlan(plan: UpgradePlan, interval: BillingInterval = "monthly") {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, plan);
  window.localStorage.setItem(INTERVAL_STORAGE_KEY, interval);
}

export function readPendingUpgradePlan(): UpgradePlan | null {
  if (typeof window === "undefined") return null;
  return parseUpgradePlan(window.localStorage.getItem(STORAGE_KEY));
}

export function readPendingUpgradeInterval(): BillingInterval {
  if (typeof window === "undefined") return "monthly";
  return parseBillingInterval(window.localStorage.getItem(INTERVAL_STORAGE_KEY));
}

export function clearPendingUpgradePlan() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem(INTERVAL_STORAGE_KEY);
}

export function resolvePendingUpgradePath() {
  const plan = readPendingUpgradePlan();
  return plan ? buildUpgradeCheckoutPath(plan, readPendingUpgradeInterval()) : null;
}
