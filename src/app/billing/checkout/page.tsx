"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CreditCard, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getCheckoutLink } from "@/services/billingService";
import {
  buildUpgradeCheckoutPath,
  clearPendingUpgradePlan,
  parseUpgradePlan,
  readPendingUpgradePlan,
  rememberPendingUpgradePlan,
} from "@/services/billing/checkoutIntent";

type CheckoutState = "preparing" | "redirecting" | "error";

const PLAN_RANK: Record<"free" | "premium" | "pro", number> = {
  free: 0,
  premium: 1,
  pro: 2,
};

export default function BillingCheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading } = useAuth();
  const [state, setState] = useState<CheckoutState>("preparing");
  const [message, setMessage] = useState("Preparando sua contratação.");
  const startedRef = useRef("");

  const planFromQuery = useMemo(() => parseUpgradePlan(searchParams.get("plan")), [searchParams]);
  const plan = planFromQuery || readPendingUpgradePlan();

  useEffect(() => {
    if (planFromQuery) {
      rememberPendingUpgradePlan(planFromQuery);
    }
  }, [planFromQuery]);

  useEffect(() => {
    if (loading || plan) return;
    router.replace(user ? "/settings?tab=billing" : "/login");
  }, [loading, plan, router, user]);

  useEffect(() => {
    if (loading || !plan) return;

    rememberPendingUpgradePlan(plan);

    if (!user) {
      router.replace(`/login?upgrade_plan=${plan}`);
      return;
    }

    if (!userProfile) return;

    const currentPlan = userProfile.plan || "free";
    const currentRank = PLAN_RANK[currentPlan];
    const targetRank = PLAN_RANK[plan];

    if (currentRank >= targetRank && userProfile.paymentStatus === "paid") {
      clearPendingUpgradePlan();
      router.replace("/dashboard");
      return;
    }

    const requestKey = `${user.uid}:${plan}`;
    if (startedRef.current === requestKey) return;
    startedRef.current = requestKey;

    const run = async () => {
      setState("redirecting");
      setMessage(`Redirecionando para a contratação do plano ${plan === "premium" ? "Premium" : "Pro"}.`);

      try {
        const token = await user.getIdToken();
        const session = await getCheckoutLink(plan, token);
        clearPendingUpgradePlan();
        window.location.assign(session.checkoutUrl);
      } catch (error) {
        console.error("Falha ao iniciar checkout:", error);
        setState("error");
        setMessage("Não foi possível abrir o checkout agora. Tente novamente em alguns instantes.");
      }
    };

    void run();

  }, [loading, plan, router, user, userProfile]);

  const resolvedState: CheckoutState = !loading && !plan ? "error" : state;
  const resolvedMessage =
    !loading && !plan
      ? "Não foi possível identificar qual plano você quer contratar."
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
            {resolvedState === "error" ? "Não foi possível continuar" : "Continuando sua contratação"}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{resolvedMessage}</p>

          {resolvedState !== "error" && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Abrindo checkout
            </div>
          )}

          {resolvedState === "error" && plan && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.assign(buildUpgradeCheckoutPath(plan))}
                className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                Tentar novamente
              </Button>
              <Link href="/settings?tab=billing" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  Ir para assinatura
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
