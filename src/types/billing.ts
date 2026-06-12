import { UserPlan } from "@/types/user";

export type BillingProvider = "mercado_pago" | "stripe" | "paddle" | "manual";
export type BillingCurrency = "BRL" | "USD" | "EUR";

export type PlanPrice = {
  planId: UserPlan;
  currency: BillingCurrency;
  amount: number;
  interval: "monthly" | "yearly";
  provider: BillingProvider;
  providerPriceId?: string;
  active: boolean;
};

export type CheckoutAvailability =
  | { available: true; provider: BillingProvider }
  | { available: false; provider: BillingProvider; reason: "international_provider_not_configured" | "unsupported_currency" };
