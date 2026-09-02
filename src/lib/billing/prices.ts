import { CheckoutAvailability, PlanPrice, BillingCurrency, BillingProvider } from "@/types/billing";
import { UserPlan } from "@/types/user";
import { PLAN_CATALOG } from "@/lib/plans/catalog";

export const PLAN_PRICES: PlanPrice[] = [
  { planId: "free", currency: "BRL", amount: 0, interval: "monthly", provider: "manual", active: true },
  { planId: "free", currency: "BRL", amount: 0, interval: "yearly", provider: "manual", active: true },
  { planId: "free", currency: "USD", amount: 0, interval: "monthly", provider: "manual", active: true },
  { planId: "free", currency: "EUR", amount: 0, interval: "monthly", provider: "manual", active: true },
  { planId: "founder", currency: "BRL", amount: PLAN_CATALOG.founder.monthlyPrice, interval: "monthly", provider: "mercado_pago", active: PLAN_CATALOG.founder.active },
  { planId: "premium", currency: "BRL", amount: PLAN_CATALOG.premium.monthlyPrice, interval: "monthly", provider: "mercado_pago", active: true },
  { planId: "premium", currency: "BRL", amount: PLAN_CATALOG.premium.yearlyPrice || 0, interval: "yearly", provider: "mercado_pago", active: true },
  { planId: "premium", currency: "USD", amount: 4.99, interval: "monthly", provider: "stripe", active: true },
  { planId: "premium", currency: "EUR", amount: 4.99, interval: "monthly", provider: "stripe", active: true },
  { planId: "pro", currency: "BRL", amount: PLAN_CATALOG.pro.monthlyPrice, interval: "monthly", provider: "mercado_pago", active: true },
  { planId: "pro", currency: "BRL", amount: PLAN_CATALOG.pro.yearlyPrice || 0, interval: "yearly", provider: "mercado_pago", active: true },
  { planId: "pro", currency: "USD", amount: 9.99, interval: "monthly", provider: "stripe", active: true },
  { planId: "pro", currency: "EUR", amount: 9.99, interval: "monthly", provider: "stripe", active: true },
  { planId: "family", currency: "BRL", amount: PLAN_CATALOG.family.monthlyPrice, interval: "monthly", provider: "mercado_pago", active: true },
  { planId: "family", currency: "BRL", amount: PLAN_CATALOG.family.yearlyPrice || 0, interval: "yearly", provider: "mercado_pago", active: true },
  { planId: "business", currency: "BRL", amount: PLAN_CATALOG.business.monthlyPrice, interval: "monthly", provider: "mercado_pago", active: true },
  { planId: "business", currency: "BRL", amount: PLAN_CATALOG.business.yearlyPrice || 0, interval: "yearly", provider: "mercado_pago", active: true },
];

export function getPlanPrice(planId: UserPlan, currency: BillingCurrency, interval: "monthly" | "yearly" = "monthly") {
  return PLAN_PRICES.find((price) => price.planId === planId && price.currency === currency && price.interval === interval);
}

export function resolveBillingCurrency(value: unknown): BillingCurrency {
  return value === "USD" || value === "EUR" ?value : "BRL";
}

function getInternationalProvider(): BillingProvider {
  const configured = process.env.BILLING_INTERNATIONAL_PROVIDER;
  if (configured === "stripe" || configured === "paddle" || configured === "manual") return configured;
  return "stripe";
}

export function isInternationalBillingEnabled() {
  return process.env.NEXT_PUBLIC_BILLING_INTERNATIONAL_ENABLED === "true";
}

export function resolveBillingProvider(currency: BillingCurrency): BillingProvider {
  if (currency === "BRL") return "mercado_pago";
  return getInternationalProvider();
}

export function resolveCheckoutAvailability(currency: BillingCurrency): CheckoutAvailability {
  if (currency === "BRL") {
    return { available: true, provider: "mercado_pago" };
  }

  const provider = getInternationalProvider();
  if (!isInternationalBillingEnabled()) {
    return { available: false, provider, reason: "international_provider_not_configured" };
  }

  return { available: true, provider };
}
