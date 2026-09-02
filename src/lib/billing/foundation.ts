import type { BillingInfo, UserPlan } from "@/types/user";

export const FOUNDATION_INTERNAL_PLAN_ID: UserPlan = "founder";
export const FOUNDATION_MONTHLY_PRICE = 9.9;
export const FOUNDATION_DURATION_MONTHS = 12;

export function isFoundationPlanEnabled() {
  return process.env.NEXT_PUBLIC_FOUNDATION_PLAN_ACTIVE === "true"
    || process.env.NEXT_PUBLIC_FOUNDER_PLAN_ACTIVE === "true";
}

export function getFoundationUserLimit() {
  const configured = Number(process.env.FOUNDATION_PLAN_MAX_USERS || "30");
  return Number.isFinite(configured) ? Math.min(10_000, Math.max(1, Math.floor(configured))) : 30;
}

export function addFoundationDuration(startedAt: string) {
  const date = new Date(startedAt);
  date.setUTCMonth(date.getUTCMonth() + FOUNDATION_DURATION_MONTHS);
  return date.toISOString();
}

export function getFoundationBillingMetadata(params: {
  currentPlan: UserPlan;
  targetPlan: UserPlan;
  billing: BillingInfo | Record<string, unknown>;
  now: string;
}) {
  if (params.targetPlan === FOUNDATION_INTERNAL_PLAN_ID) {
    const existingStart = typeof params.billing.foundationStartedAt === "string"
      ? params.billing.foundationStartedAt
      : null;
    const existingEnd = typeof params.billing.foundationEndsAt === "string"
      ? params.billing.foundationEndsAt
      : null;
    const startedAt = params.currentPlan === FOUNDATION_INTERNAL_PLAN_ID && existingStart
      ? existingStart
      : params.now;
    return {
      foundationStartedAt: startedAt,
      foundationEndsAt: params.currentPlan === FOUNDATION_INTERNAL_PLAN_ID && existingEnd
        ? existingEnd
        : addFoundationDuration(startedAt),
      foundationCompletedAt: null,
    };
  }
  if (params.currentPlan === FOUNDATION_INTERNAL_PLAN_ID) {
    return { foundationCompletedAt: params.now };
  }
  return {};
}

export function hasFoundationOfferExpired(billing: BillingInfo | Record<string, unknown>, now = Date.now()) {
  if (typeof billing.foundationCompletedAt === "string" && billing.foundationCompletedAt) return true;
  if (typeof billing.foundationEndsAt !== "string") return false;
  const endsAt = Date.parse(billing.foundationEndsAt);
  return Number.isFinite(endsAt) && endsAt <= now;
}
