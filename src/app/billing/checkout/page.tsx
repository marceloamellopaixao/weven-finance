"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/i18n/T";
import { formatMoney } from "@/lib/money/formatMoney";
import { getEquivalentMonthlyPrice, PLAN_CATALOG, type BillingInterval } from "@/lib/plans/catalog";
import { getCheckoutLink } from "@/services/billingService";
import {
  buildUpgradeCheckoutPath,
  clearPendingUpgradePlan,
  parseBillingInterval,
  parseUpgradePlan,
  readPendingUpgradeInterval,
  readPendingUpgradePlan,
  rememberPendingUpgradePlan,
} from "@/services/billing/checkoutIntent";

type CheckoutState = "preparing" | "redirecting" | "error" | "exempt";

function getChargeLabel(interval: BillingInterval) {
  return interval === "yearly" ? "Anual" : "Mensal";
}

export default function BillingCheckoutPage() {
  const t = useTranslations("billing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading, canPreviewRestrictedPages } = useAuth();
  const [state, setState] = useState<CheckoutState>("preparing");
  const [message, setMessage] = useState(t("checkout.preparing"));
  const startedRef = useRef("");

  const planFromQuery = useMemo(() => parseUpgradePlan(searchParams.get("plan")), [searchParams]);
  const plan = planFromQuery || readPendingUpgradePlan();
  const intervalFromQuery = useMemo(() => parseBillingInterval(searchParams.get("interval")), [searchParams]);
  const interval = planFromQuery ? intervalFromQuery : readPendingUpgradeInterval();
  const selectedPlan = plan ? PLAN_CATALOG[plan] : null;
  const selectedPrice =
    selectedPlan && interval === "yearly" && selectedPlan.yearlyPrice !== null
      ? selectedPlan.yearlyPrice
      : selectedPlan?.monthlyPrice ?? 0;
  const equivalentMonthly = plan && interval === "yearly" ? getEquivalentMonthlyPrice(plan) : null;

  useEffect(() => {
    if (planFromQuery) {
      rememberPendingUpgradePlan(planFromQuery, intervalFromQuery);
    }
  }, [intervalFromQuery, planFromQuery]);

  useEffect(() => {
    if (loading || canPreviewRestrictedPages || plan) return;
    router.replace(user ? "/settings?tab=billing" : "/login");
  }, [canPreviewRestrictedPages, loading, plan, router, user]);

  useEffect(() => {
    if (loading || canPreviewRestrictedPages || !plan) return;

    rememberPendingUpgradePlan(plan, interval);

    if (!user) {
      router.replace(`/login?upgrade_plan=${plan}&interval=${interval}`);
      return;
    }

    if (!userProfile) return;

    const currentPlan = userProfile.plan || "free";

    if (currentPlan === plan && userProfile.paymentStatus === "paid") {
      clearPendingUpgradePlan();
      router.replace("/dashboard");
      return;
    }

    const requestKey = `${user.uid}:${plan}:${interval}`;
    if (startedRef.current === requestKey) return;
    startedRef.current = requestKey;

    const run = async () => {
      setState("redirecting");
      setMessage(t("checkout.redirecting", { plan: selectedPlan?.publicName ?? plan }));

      try {
        const token = await user.getIdToken();
        const session = await getCheckoutLink(plan, token, interval);
        clearPendingUpgradePlan();
        window.location.assign(session.checkoutUrl);
      } catch (error) {
        console.error("Falha ao iniciar checkout:", error);
        const errorCode = error instanceof Error ? error.message : "";
        if (errorCode === "role_billing_exempt") {
          clearPendingUpgradePlan();
          setState("exempt");
          setMessage(t("checkout.exemptMessage"));
          return;
        }
        setState("error");
        setMessage(t("checkout.errorMessage"));
      }
    };

    void run();

  }, [canPreviewRestrictedPages, interval, loading, plan, router, selectedPlan?.publicName, t, user, userProfile]);

  const resolvedState: CheckoutState = !loading && !plan ? "error" : state;
  const resolvedMessage =
    canPreviewRestrictedPages
      ? t("checkout.previewMessage")
      : !loading && !plan
      ? t("checkout.missingPlanMessage")
      : message;

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-10 font-sans sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-12%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-14%] right-[-14%] h-[420px] w-[420px] rounded-full bg-primary/6 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-5 text-center shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-6 md:p-8">
          <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20">
            {resolvedState === "error" ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <CreditCard className="h-6 w-6" />
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {canPreviewRestrictedPages
              ? t("checkout.previewTitle")
              : resolvedState === "error"
              ? t("checkout.errorTitle")
              : resolvedState === "exempt"
                ? t("checkout.exemptTitle")
                : t("checkout.continuingTitle")}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{resolvedMessage}</p>

          {plan && selectedPlan && (
            <div className="mt-6 rounded-2xl border border-border/70 bg-background/55 p-4 text-left">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Resumo da assinatura</p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Plano escolhido</dt>
                  <dd className="text-right font-semibold text-foreground">{selectedPlan.publicName}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Cobrança</dt>
                  <dd className="text-right font-semibold text-foreground">{getChargeLabel(interval)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Valor hoje</dt>
                  <dd className="text-right font-semibold text-foreground">{formatMoney(selectedPrice, "BRL", "pt-BR")}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Renovação</dt>
                  <dd className="text-right font-semibold text-foreground">
                    {interval === "yearly" ? "A cada 12 meses" : "A cada mês"}
                  </dd>
                </div>
              </dl>
              {equivalentMonthly !== null && (
                <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
                  Equivale a {formatMoney(equivalentMonthly, "BRL", "pt-BR")} por mês.
                </p>
              )}
            </div>
          )}

          {!canPreviewRestrictedPages && resolvedState !== "error" && resolvedState !== "exempt" && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("checkout.opening")}
            </div>
          )}

          {resolvedState === "error" && plan && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.assign(buildUpgradeCheckoutPath(plan, interval))}
                className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("checkout.retry")}
              </Button>
              <Link href="/settings?tab=billing" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  {t("checkout.goToSubscription")}
                </Button>
              </Link>
            </div>
          )}

          {resolvedState === "exempt" && (
            <div className="mt-6 space-y-3">
              <Link href="/dashboard" className="block">
                <Button className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90">
                  {t("checkout.goToDashboard")}
                </Button>
              </Link>
              <Link href="/settings?tab=billing" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  {t("checkout.goToSubscription")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
