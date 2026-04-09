import { UserPlan } from "@/types/user";

const CHECKOUT_SIGNAL_WINDOW_MS = 6 * 60 * 60 * 1000;

export function canMatchWebhookByEmail(
  details: { plan?: UserPlan; preapprovalId?: string },
  billingValue: unknown,
  nowMs = Date.now()
) {
  const billing = ((billingValue as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
  const preapprovalId = typeof details.preapprovalId === "string" ? details.preapprovalId.trim() : "";
  const billingPreapprovalId = typeof billing.preapprovalId === "string" ? billing.preapprovalId.trim() : "";
  const pendingPreapprovalId = typeof billing.pendingPreapprovalId === "string" ? billing.pendingPreapprovalId.trim() : "";

  if (preapprovalId && (billingPreapprovalId === preapprovalId || pendingPreapprovalId === preapprovalId)) {
    return true;
  }

  const pendingPlan =
    billing.pendingPlan === "free" || billing.pendingPlan === "premium" || billing.pendingPlan === "pro"
      ? (billing.pendingPlan as UserPlan)
      : undefined;
  const pendingCheckoutAt = typeof billing.pendingCheckoutAt === "string" ? billing.pendingCheckoutAt : "";
  const pendingCheckoutAttemptId =
    typeof billing.pendingCheckoutAttemptId === "string" ? billing.pendingCheckoutAttemptId.trim() : "";

  if (!details.plan || pendingPlan !== details.plan || !pendingCheckoutAt || !pendingCheckoutAttemptId) {
    return false;
  }

  const pendingAtMs = new Date(pendingCheckoutAt).getTime();
  if (!pendingAtMs) return false;

  return Math.abs(nowMs - pendingAtMs) <= CHECKOUT_SIGNAL_WINDOW_MS;
}
