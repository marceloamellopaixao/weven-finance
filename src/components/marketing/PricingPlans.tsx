"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Medal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { formatMoney } from "@/lib/money/formatMoney";
import {
  getConfiguredPublicPlans,
  getPublicPlans,
  type BillingInterval,
  type PlanCatalogItem,
} from "@/lib/plans/catalog";
import type { PlansConfig } from "@/types/system";
import { trackProductEvent } from "@/lib/analytics/client";
import { buildUpgradeCheckoutPath, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";

function formatPrice(value: number) {
  return formatMoney(value, "BRL", "pt-BR");
}

function getPlanPrice(plan: PlanCatalogItem, interval: BillingInterval) {
  if (interval === "yearly" && plan.yearlyPrice !== null) return plan.yearlyPrice;
  return plan.monthlyPrice;
}

export function PricingPlans() {
  const { user, userProfile } = useAuth();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [openingPlan, setOpeningPlan] = useState<string | null>(null);
  const fallbackPlans = useMemo(() => getPublicPlans(), []);
  const [plans, setPlans] = useState(fallbackPlans);
  const hasSession = Boolean(user || userProfile);

  useEffect(() => {
    trackProductEvent("landing_viewed");
    trackProductEvent("pricing_viewed");
    let cancelled = false;
    void fetch("/api/system/plans")
      .then(async (response) => {
        if (!response.ok) return;
        const payload = (await response.json()) as { plans?: PlansConfig };
        if (!cancelled && payload.plans) setPlans(getConfiguredPublicPlans(payload.plans));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const handlePlanClick = (plan: PlanCatalogItem) => {
    const selectedInterval = interval === "yearly" && plan.yearlyPrice === null ? "monthly" : interval;
    trackProductEvent("plan_selected", { plan: plan.id, interval: selectedInterval, authenticated: hasSession });
    if (plan.id === "free") {
      window.location.assign(hasSession ? "/dashboard" : "/register");
      return;
    }

    setOpeningPlan(plan.id);
    rememberPendingUpgradePlan(plan.id, selectedInterval);
    window.location.assign(user ? buildUpgradeCheckoutPath(plan.id, selectedInterval) : `/register?upgrade_plan=${plan.id}&interval=${selectedInterval}`);
  };

  return (
    <div className="space-y-8">
      <div className="mx-auto flex w-full max-w-sm rounded-2xl border border-border/80 bg-card/80 p-1 shadow-sm">
        {(["monthly", "yearly"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setInterval(item);
              trackProductEvent("billing_interval_selected", { interval: item });
            }}
            className={`flex-1 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
              interval === item ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item === "monthly" ? "Mensal" : "Anual"}
          </button>
        ))}
      </div>

      {interval === "yearly" ? (
        <p className="text-center text-sm font-semibold text-primary">Melhor custo-benefício. Economize até 2 meses.</p>
      ) : null}

      <div className="flex flex-wrap items-stretch justify-center gap-5">
        {plans.map((plan) => {
          const featured = plan.id === "premium";
          const price = getPlanPrice(plan, interval);
          const equivalent = interval === "yearly" && plan.yearlyPrice !== null ? plan.yearlyPrice / 12 : null;
          const hasYearlyPrice = plan.yearlyPrice !== null;
          const priceLabel = plan.id === "free" ? "R$ 0" : formatPrice(price);
          const periodLabel = plan.id === "free" ? "" : interval === "yearly" && hasYearlyPrice ? "por ano" : "por mês";

          return (
            <Card
              key={plan.id}
              className={`relative flex w-full max-w-[390px] flex-col overflow-hidden rounded-2xl border bg-card/90 shadow-sm transition-all sm:w-[calc(50%-0.625rem)] lg:w-[calc(33.333%-0.875rem)] ${
                featured ? "border-primary/55 shadow-xl shadow-primary/10" : "border-border/80 hover:border-primary/35"
              }`}
            >
              {plan.badge ? (
                <Badge className="absolute right-5 top-5 max-w-[calc(100%-2.5rem)] rounded-full bg-primary/10 text-[10px] text-primary hover:bg-primary/15">
                  {plan.badge}
                </Badge>
              ) : null}
              <CardHeader className="space-y-3 p-4">
                <div className="space-y-3">
                  <CardTitle className="flex min-h-12 items-start gap-2 text-xl leading-tight">
                    <span>{plan.publicName}</span>
                    {featured ? <Medal className="mt-0.5 h-5 w-5 shrink-0 text-primary" /> : null}
                  </CardTitle>
                  <CardDescription className="text-sm leading-6">{plan.description}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col space-y-5 p-5 pt-0">
                <div>
                  <p className="text-3xl font-black leading-none tracking-tight text-foreground">{priceLabel}</p>
                  {periodLabel ? (
                    <p className="mt-1 text-xl font-black leading-tight text-foreground">{periodLabel}</p>
                  ) : null}
                  {equivalent !== null && hasYearlyPrice ? (
                    <p className="mt-1 text-sm font-medium text-muted-foreground">
                      Equivale a {formatPrice(equivalent)} por mês.
                    </p>
                  ) : null}
                </div>
                <ul className="flex-1 space-y-2 text-sm leading-5 text-muted-foreground">
                  {plan.benefits.slice(0, 6).map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="mt-auto p-5 pt-0">
                <Button
                  className="h-11 w-full rounded-xl font-bold"
                  variant={featured ? "default" : "outline"}
                  onClick={() => handlePlanClick(plan)}
                  disabled={openingPlan !== null}
                >
                  {openingPlan === plan.id ? "Abrindo checkout..." : plan.cta}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
