"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { buildUpgradeCheckoutPath, rememberPendingUpgradePlan } from "@/services/billing/checkoutIntent";

type MarketingCtasProps = {
  variant: "hero" | "free" | "premium" | "pro";
};

export function MarketingCtas({ variant }: MarketingCtasProps) {
  const { user, userProfile } = useAuth();
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);
  const hasSession = Boolean(user || userProfile);
  const primaryHref = hasSession ? "/dashboard" : "/register";
  const primaryLabel = hasSession ? "Abrir meu painel" : "Começar grátis";

  const handlePlanCheckout = async (plan: "premium" | "pro") => {
    if (!user) {
      rememberPendingUpgradePlan(plan);
      window.location.assign(`/register?upgrade_plan=${plan}`);
      return;
    }

    setIsOpeningCheckout(plan);
    try {
      rememberPendingUpgradePlan(plan);
      window.location.assign(buildUpgradeCheckoutPath(plan));
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  if (variant === "hero") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
        <Link href={primaryHref} className="w-full sm:w-auto">
          <Button size="lg" className="h-12 w-full rounded-full bg-primary px-8 text-base text-primary-foreground shadow-xl shadow-primary/20 transition-transform duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-primary/90 hover:cursor-pointer sm:h-14 sm:w-auto sm:text-lg">
            {primaryLabel} <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </Link>
        <Button size="lg" variant="outline" className="h-12 w-full rounded-full border-color:var(--app-panel-border) px-8 text-base text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground hover:cursor-pointer sm:h-14 sm:w-auto sm:text-lg" asChild>
          <a href="#pricing">Ver planos</a>
        </Button>
      </div>
    );
  }

  if (variant === "free") {
    return (
      <Link href={primaryHref} className="w-full">
        <Button className="h-12 w-full rounded-2xl border border-color:var(--app-panel-border) bg-card text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:bg-accent active:scale-95">
          {hasSession ? "Abrir painel" : "Começar no Free"}
        </Button>
      </Link>
    );
  }

  const plan = variant;
  return (
    <Button
      className={plan === "premium"
        ? "h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 hover:scale-105 hover:bg-primary/90 active:scale-95"
        : "h-12 w-full rounded-2xl border border-color:var(--app-panel-border) bg-card text-foreground shadow-sm transition-all duration-200 hover:scale-105 hover:bg-accent active:scale-95"}
      variant={plan === "pro" ? "outline" : "default"}
      disabled={isOpeningCheckout !== null}
      onClick={() => void handlePlanCheckout(plan)}
    >
      {isOpeningCheckout === plan ? "Abrindo checkout..." : plan === "premium" ? "Ir para o Premium" : "Ir para o Pro"}
    </Button>
  );
}
