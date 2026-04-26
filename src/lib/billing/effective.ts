import { BillingInfo, UserPaymentStatus, UserPlan, UserRole, UserStatus } from "@/types/user";

const BILLING_EXEMPT_ROLES = new Set<UserRole>(["admin", "moderator"]);
const TRUSTED_PAID_SOURCES = new Set<BillingInfo["source"]>(["mercadopago_webhook", "mercadopago_confirm"]);
const PAID_GATEWAY_STATUSES = new Set(["approved", "authorized"]);
const IRREGULAR_GATEWAY_STATUSES = new Set(["cancelled", "cancelled_by_user", "charged_back", "rejected", "refunded", "paused"]);
const OVERSTRICT_ENFORCEMENT_REASONS = new Set([
  "manual_paid_without_gateway_confirmation",
  "paid_plan_without_confirmed_payment",
]);

export type BillingStateInput = {
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  paymentStatus: UserPaymentStatus;
  blockReason?: string;
  billing?: BillingInfo;
  billingExempt?: boolean;
};

export type EffectiveBillingState = BillingStateInput & {
  shouldEnforce: boolean;
  enforcementReason?: string;
};

export function isBillingExemptRole(role: UserRole) {
  return BILLING_EXEMPT_ROLES.has(role);
}

export function hasTrustedPaidBilling(paymentStatus: UserPaymentStatus, billing?: BillingInfo) {
  if (paymentStatus !== "paid") return false;
  if (!billing || !TRUSTED_PAID_SOURCES.has(billing.source)) return false;

  const gatewayStatus = String(billing.gatewayStatus || "").trim().toLowerCase();
  if (gatewayStatus && !PAID_GATEWAY_STATUSES.has(gatewayStatus)) return false;

  return true;
}

export function hasIrregularGatewayBilling(billing?: BillingInfo) {
  if (!billing) return false;
  const hasMercadoPagoSignal =
    billing.provider === "mercadopago" ||
    billing.source === "mercadopago_webhook" ||
    billing.source === "mercadopago_confirm" ||
    billing.source === "mercadopago_cancel";
  if (!hasMercadoPagoSignal) return false;

  const gatewayStatus = String(billing.gatewayStatus || "").trim().toLowerCase();
  return IRREGULAR_GATEWAY_STATUSES.has(gatewayStatus);
}

export function resolveEffectiveBillingState(input: BillingStateInput): EffectiveBillingState {
  if (input.billingExempt || input.status === "deleted") {
    return { ...input, shouldEnforce: false };
  }

  if (hasTrustedPaidBilling(input.paymentStatus, input.billing)) {
    return { ...input, shouldEnforce: false };
  }

  if (
    input.billing?.source === "system" &&
    typeof input.billing.lastError === "string" &&
    OVERSTRICT_ENFORCEMENT_REASONS.has(input.billing.lastError) &&
    !hasIrregularGatewayBilling(input.billing)
  ) {
    const restoredPlan = input.billing.gatewayPlan === "premium" || input.billing.gatewayPlan === "pro"
      ? input.billing.gatewayPlan
      : input.plan;

    return {
      ...input,
      plan: restoredPlan,
      status: "active",
      paymentStatus: "pending",
      blockReason: "",
      billing: {
        ...input.billing,
        source: "system",
        lastSyncAt: new Date().toISOString(),
        lastError: "overstrict_billing_block_reverted",
      },
      shouldEnforce: true,
      enforcementReason: "overstrict_billing_block_reverted",
    };
  }

  if (input.plan === "free" || !hasIrregularGatewayBilling(input.billing)) {
    return { ...input, shouldEnforce: false };
  }

  const paymentStatus: UserPaymentStatus =
    String(input.billing?.gatewayStatus || "").toLowerCase() === "paused"
      ? "overdue"
      : input.paymentStatus === "canceled"
        ? "canceled"
        : "not_paid";

  return {
    ...input,
    plan: "free",
    status: "blocked",
    paymentStatus,
    blockReason: "Falta de Pagamento",
    billing: {
      ...(input.billing || {}),
      source: "system",
      provider: input.billing?.provider,
      gatewayPlan: input.plan,
      lastSyncAt: new Date().toISOString(),
      lastError:
        input.paymentStatus === "paid"
          ? "manual_paid_without_gateway_confirmation"
          : "paid_plan_without_confirmed_payment",
    },
    shouldEnforce: true,
    enforcementReason:
      input.paymentStatus === "paid"
        ? "manual_paid_without_gateway_confirmation"
        : "paid_plan_without_confirmed_payment",
  };
}
