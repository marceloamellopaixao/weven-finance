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
  const [message, setMessage] = useState("Preparando sua contratacao.");
  const startedRef = useRef("");

  const planFromQuery = useMemo(() => parseUpgradePlan(searchParams.get("plan")), [searchParams]);
  const plan = planFromQuery || readPendingUpgradePlan();

  useEffect(() => {
    if (planFromQuery) {
      rememberPendingUpgradePlan(planFromQuery);
    }
  }, [planFromQuery]);

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

    let cancelled = false;

    const run = async () => {
      setState("redirecting");
      setMessage(`Redirecionando para a contratacao do plano ${plan === "premium" ? "Premium" : "Pro"}.`);

      try {
        const token = await user.getIdToken();
        const session = await getCheckoutLink(plan, token);
        if (cancelled) return;
        clearPendingUpgradePlan();
        window.location.assign(session.checkoutUrl);
      } catch (error) {
        if (cancelled) return;
        console.error("Falha ao iniciar checkout:", error);
        setState("error");
        setMessage("Nao foi possivel abrir o checkout agora. Tente novamente em alguns instantes.");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [loading, plan, router, user, userProfile]);

  const resolvedState: CheckoutState = !loading && !plan ? "error" : state;
  const resolvedMessage =
    !loading && !plan
      ? "Nao foi possivel identificar qual plano voce quer contratar."
      : message;

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        <div className="bg-white/75 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-6 md:p-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-5">
            {resolvedState === "error" ? (
              <AlertTriangle className="h-6 w-6 text-white" />
            ) : (
              <CreditCard className="h-6 w-6 text-white" />
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {resolvedState === "error" ? "Nao foi possivel continuar" : "Continuando sua contratacao"}
          </h1>

          <p className="mt-3 text-sm text-zinc-500 leading-relaxed">{resolvedMessage}</p>

          {resolvedState !== "error" && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-violet-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Abrindo checkout
            </div>
          )}

          {resolvedState === "error" && plan && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.assign(buildUpgradeCheckoutPath(plan))}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium"
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
