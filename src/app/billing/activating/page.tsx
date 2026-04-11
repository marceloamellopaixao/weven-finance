"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, CreditCard, Loader2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { confirmPreapproval } from "@/services/billingService";

type ActivationState = "preparing" | "confirming" | "success" | "error" | "login_required";

const RETRY_DELAYS_MS = [0, 2000, 5000];

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function BillingActivatingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const [state, setState] = useState<ActivationState>("preparing");
  const [message, setMessage] = useState("Estamos validando sua assinatura com o Mercado Pago.");
  const startedKeyRef = useRef("");

  const expectedPlanFromQuery = useMemo(() => {
    const value = searchParams.get("plan");
    return value === "premium" || value === "pro" ? value : undefined;
  }, [searchParams]);

  const pendingPlan = userProfile?.billing?.pendingPlan;
  const expectedPlan = expectedPlanFromQuery || (pendingPlan === "premium" || pendingPlan === "pro" ? pendingPlan : undefined);
  const checkoutAttemptIdFromQuery = useMemo(() => searchParams.get("attempt") || undefined, [searchParams]);
  const checkoutAttemptId = checkoutAttemptIdFromQuery || userProfile?.billing?.pendingCheckoutAttemptId;

  useEffect(() => {
    if (loading) return;
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
      setMessage("Confirmando sua assinatura. Isso pode levar alguns segundos.");

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
            setMessage(`Plano ${result.targetPlan} ativado com sucesso. Redirecionando para o painel...`);
            window.setTimeout(() => {
              window.location.assign("/dashboard");
            }, 1200);
            return;
          } catch (error) {
            lastError = error;
          }
        }

        console.error("Falha ao ativar assinatura:", lastError);
        setState("error");
        setMessage("Ainda não conseguimos confirmar seu pagamento automaticamente. Tente verificar novamente.");
      } catch (error) {
        console.error("Falha ao preparar confirmação da assinatura:", error);
        setState("error");
        setMessage("Não foi possível validar sua assinatura agora.");
      }
    };

    void run();

  }, [checkoutAttemptId, expectedPlan, loading, refreshProfile, router, user]);

  const resolvedState: ActivationState =
    !loading && !user
      ? "login_required"
      : !loading && !expectedPlan
        ? "error"
        : state;

  const resolvedMessage =
    !loading && !user
      ? "Faça login para concluir a ativação do seu plano."
      : !loading && !expectedPlan
        ? "Não foi possível identificar qual plano deve ser ativado."
        : message;

  const isLoadingState = resolvedState === "preparing" || resolvedState === "confirming";

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
            {resolvedState === "success"
              ? "Plano ativado"
              : resolvedState === "error"
                ? "Ainda estamos validando"
                : resolvedState === "login_required"
                  ? "Entre para continuar"
                  : "Ativando seu plano"}
          </h1>

          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{resolvedMessage}</p>

          {isLoadingState && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando assinatura
            </div>
          )}

          {resolvedState === "error" && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.reload()}
                className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90"
              >
                Verificar novamente
              </Button>
              <Link href="/settings?tab=billing" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  Ir para assinatura
                </Button>
              </Link>
            </div>
          )}

          {resolvedState === "login_required" && (
            <div className="mt-6 space-y-3">
              <Link href="/login" className="block">
                <Button className="h-11 w-full rounded-xl bg-primary font-medium text-primary-foreground hover:bg-primary/90">
                  Entrar na conta
                </Button>
              </Link>
              <Link href="/" className="block">
                <Button variant="outline" className="w-full h-11 rounded-xl">
                  Voltar ao início
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
