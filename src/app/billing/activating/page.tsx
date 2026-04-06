"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  const searchParams = useSearchParams();
  const { user, loading, refreshProfile } = useAuth();
  const [state, setState] = useState<ActivationState>("preparing");
  const [message, setMessage] = useState("Estamos validando sua assinatura com o Mercado Pago.");
  const startedKeyRef = useRef("");

  const expectedPlan = useMemo(() => {
    const value = searchParams.get("plan");
    return value === "premium" || value === "pro" ? value : undefined;
  }, [searchParams]);

  const checkoutAttemptId = useMemo(() => searchParams.get("attempt") || undefined, [searchParams]);

  useEffect(() => {
    if (loading) return;
    if (!user || !expectedPlan) {
      return;
    }

    const attemptKey = `${user.uid}:${expectedPlan}:${checkoutAttemptId || "no-attempt"}`;
    if (startedKeyRef.current === attemptKey) return;
    startedKeyRef.current = attemptKey;

    let cancelled = false;

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
          if (cancelled) return;

          try {
            const result = await confirmPreapproval(undefined, token, expectedPlan, checkoutAttemptId);
            if (cancelled) return;

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

        if (cancelled) return;

        console.error("Falha ao ativar assinatura:", lastError);
        setState("error");
        setMessage("Ainda não conseguimos confirmar seu pagamento automaticamente. Tente verificar novamente.");
      } catch (error) {
        if (cancelled) return;

        console.error("Falha ao preparar confirmação da assinatura:", error);
        setState("error");
        setMessage("Não foi possível validar sua assinatura agora.");
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [checkoutAttemptId, expectedPlan, loading, refreshProfile, user]);

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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[460px] relative z-10">
        <div className="bg-white/75 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl p-6 md:p-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-5">
            {resolvedState === "success" ? (
              <CheckCircle2 className="h-6 w-6 text-white" />
            ) : resolvedState === "error" ? (
              <AlertTriangle className="h-6 w-6 text-white" />
            ) : (
              <CreditCard className="h-6 w-6 text-white" />
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            {resolvedState === "success"
              ? "Plano ativado"
              : resolvedState === "error"
                ? "Ainda estamos validando"
                : resolvedState === "login_required"
                  ? "Entre para continuar"
                  : "Ativando seu plano"}
          </h1>

          <p className="mt-3 text-sm text-zinc-500 leading-relaxed">{resolvedMessage}</p>

          {isLoadingState && (
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-violet-600 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              Processando assinatura
            </div>
          )}

          {resolvedState === "error" && (
            <div className="mt-6 space-y-3">
              <Button
                onClick={() => window.location.reload()}
                className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium"
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
                <Button className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium">
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
