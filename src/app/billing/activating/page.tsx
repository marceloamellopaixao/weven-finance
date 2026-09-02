"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "@/i18n/T";
import { Button } from "@/components/ui/button";
import { confirmPreapproval } from "@/services/billingService";
import { parseUpgradePlan } from "@/services/billing/checkoutIntent";
import { trackProductEvent } from "@/lib/analytics/client";

type ActivationState = "preparing" | "confirming" | "success" | "error" | "login_required";

const RETRY_DELAYS_MS = [0, 2000, 5000];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function BillingActivatingPage() {
  const t = useTranslations("billing");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading, refreshProfile, canPreviewRestrictedPages } = useAuth();
  const [state, setState] = useState<ActivationState>("preparing");
  const [message, setMessage] = useState(t("activating.initialMessage"));
  const startedKeyRef = useRef("");

  const expectedPlanFromQuery = useMemo(() => {
    return parseUpgradePlan(searchParams.get("plan")) ?? undefined;
  }, [searchParams]);

  const pendingPlan = userProfile?.billing?.pendingPlan;
  const expectedPlan = expectedPlanFromQuery || parseUpgradePlan(pendingPlan) || undefined;
  const checkoutAttemptIdFromQuery = useMemo(() => searchParams.get("attempt") || undefined, [searchParams]);
  const checkoutAttemptId = checkoutAttemptIdFromQuery || userProfile?.billing?.pendingCheckoutAttemptId;
  const adminTestMode = searchParams.get("mode") === "admin-test";
  const isPreviewOnly = canPreviewRestrictedPages && !adminTestMode;

  useEffect(() => {
    if (loading || isPreviewOnly) return;
    if (user && !expectedPlan) {
      router.replace("/settings?tab=billing");
      return;
    }
    if (!user || !expectedPlan) {
      return;
    }

    const attemptKey = `${user.uid}:${expectedPlan}:${checkoutAttemptId || "no-attempt"}`;
    if (startedKeyRef.current === attemptKey) return;
    startedKeyRef.current = attemptKey;

    const run = async () => {
      setState("confirming");
      setMessage(t("activating.confirmingMessage"));

      try {
        const token = await user.getIdToken();
        let lastError: unknown = null;

        for (const delayMs of RETRY_DELAYS_MS) {
          if (delayMs > 0) {
            await sleep(delayMs);
          }
          try {
            const result = await confirmPreapproval(undefined, token, expectedPlan, checkoutAttemptId);

            await refreshProfile();
            setState("success");
            trackProductEvent("checkout_completed", { plan: result.targetPlan });
            setMessage(t("activating.successMessage", { plan: result.targetPlan }));
            window.setTimeout(() => {
              window.location.assign("/dashboard");
            }, 1200);
            return;
          } catch (error) {
            lastError = error;
          }
        }

        console.error("Falha ao ativar assinatura:", lastError);
        trackProductEvent("checkout_failed", { plan: expectedPlan, stage: "activation" });
        setState("error");
        setMessage(t("activating.autoConfirmErrorMessage"));
      } catch (error) {
        console.error("Falha ao preparar confirmação da assinatura:", error);
        setState("error");
        setMessage(t("activating.validationErrorMessage"));
      }
    };

    void run();

  }, [checkoutAttemptId, expectedPlan, isPreviewOnly, loading, refreshProfile, router, t, user]);

  const resolvedState: ActivationState =
    isPreviewOnly
      ? "preparing"
      : !loading && !user
      ? "login_required"
      : !loading && !expectedPlan
        ? "error"
        : state;

  const resolvedMessage =
    isPreviewOnly
      ? t("activating.previewMessage")
      : !loading && !user
      ? t("activating.loginRequiredMessage")
      : !loading && !expectedPlan
        ? t("activating.missingPlanMessage")
        : message;

  const isLoadingState = !isPreviewOnly && (resolvedState === "preparing" || resolvedState === "confirming");

  return (
    <div className="relative flex min-h-[calc(100svh-4rem)] items-center justify-center overflow-hidden px-4 py-10 font-sans sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-12%] top-[-12%] h-[420px] w-[420px] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute bottom-[-14%] right-[-14%] h-[420px] w-[420px] rounded-full bg-primary/6 blur-[110px]" />
      </div>

      <div className="relative z-10 w-full max-w-[460px]">
        <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-5 text-center shadow-2xl shadow-primary/10 backdrop-blur-xl sm:p-6 md:p-8">
          <div className="mb-5 inline-flex items-center justify-center rounded-2xl bg-primary p-3 text-primary-foreground shadow-lg shadow-primary/20">
            {resolvedState === "success" ? (
              <CheckCircle2 className="h-6 w-6" />
            ) : resolvedState === "error" ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <CreditCard className="h-6 w-6" />
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {isPreviewOnly
              ? t("activating.previewTitle")
              : resolvedState === "success"
              ? t("activating.successTitle")
              : resolvedState === "error"
                ? t("activating.validatingTitle")
                : resolvedState === "login_required"
                  ? t("activating.loginRequiredTitle")
                  : t("activating.activatingTitle")}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{resolvedMessage}</p>

          {isLoadingState && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("activating.processing")}
            </div>
          )}

          {resolvedState === "error" && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.reload()}
                className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                {t("activating.checkAgain")}
              </Button>
              <Link href="/settings?tab=billing" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  {t("activating.goToSubscription")}
                </Button>
              </Link>
            </div>
          )}

          {resolvedState === "login_required" && (
            <div className="mt-6 space-y-3">
              <Link href="/login" className="block">
                <Button className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90">
                  {t("activating.login")}
                </Button>
              </Link>
              <Link href="/" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  {t("activating.backHome")}
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
