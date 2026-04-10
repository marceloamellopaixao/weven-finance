"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CheckCircle2, Home, Loader2, Mail, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { ACCOUNT_DELETION_GRACE_DAYS, computePermanentDeleteAt } from "@/lib/account-deletion/policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getSupabaseClient } from "@/services/supabase/client";

function formatDate(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function GoodbyePage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [isRestarting, setIsRestarting] = useState(false);
  const [error, setError] = useState("");
  const [restoreName, setRestoreName] = useState("");
  const [restoreEmail, setRestoreEmail] = useState("");
  const [restoreMessage, setRestoreMessage] = useState("");
  const [restoreProtocol, setRestoreProtocol] = useState("");
  const [isSubmittingRestore, setIsSubmittingRestore] = useState(false);

  useEffect(() => {
    if (!restoreEmail && user?.email) {
      setRestoreEmail(user.email);
    }
    if (!restoreName) {
      const nextName = userProfile?.completeName || userProfile?.displayName || user?.displayName || "";
      if (nextName) setRestoreName(nextName);
    }
  }, [restoreEmail, restoreName, user, userProfile]);

  const permanentDeleteAt = useMemo(() => {
    return userProfile?.permanentDeleteAt || computePermanentDeleteAt(userProfile?.deletedAt || null);
  }, [userProfile?.deletedAt, userProfile?.permanentDeleteAt]);

  const permanentDeleteLabel = formatDate(permanentDeleteAt || null);
  const deletionWindowExpired = Boolean(
    permanentDeleteAt && new Date(permanentDeleteAt).getTime() <= Date.now()
  );

  async function handleFreshStart() {
    setError("");
    setIsRestarting(true);

    const supabase = getSupabaseClient();

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      if (!token) {
        throw new Error("Entre novamente na conta encerrada para liberar este e-mail e iniciar um novo cadastro.");
      }

      const response = await fetch("/api/account/permanent-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Não foi possível preparar uma nova conta agora.");
      }

      await supabase.auth.signOut();
      router.replace("/register?fresh=1");
    } catch (restartError) {
      setError(restartError instanceof Error ? restartError.message : "Não foi possível iniciar uma nova conta.");
      setIsRestarting(false);
    }
  }

  async function handleRestoreRequest() {
    setError("");
    setRestoreProtocol("");
    setIsSubmittingRestore(true);

    try {
      const response = await fetch("/api/account/restore-request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: restoreEmail,
          name: restoreName,
          wantsData: true,
          message: restoreMessage,
        }),
      });

      const payload = (await response.json()) as { ok?: boolean; error?: string; protocol?: string };
      if (!response.ok || !payload.ok) {
        if (payload.error === "restore_window_expired") {
          throw new Error("O prazo de reativacao desta conta ja terminou.");
        }
        if (payload.error === "account_not_deleted") {
          throw new Error("Esta conta não está mais no estado de exclusão.");
        }
        throw new Error(payload.error || "Não foi possível enviar sua solicitação agora.");
      }

      setRestoreProtocol(payload.protocol || "");
      setRestoreMessage("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar a solicitação.");
    } finally {
      setIsSubmittingRestore(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4 py-16">
      <Card className="w-full rounded-3xl border-zinc-200 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-zinc-100 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            <ShieldCheck className="h-10 w-10 text-emerald-600" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
              Conta encerrada
            </CardTitle>
            <CardDescription className="mx-auto max-w-xl text-base leading-relaxed text-zinc-500">
              Seu acesso foi bloqueado e os dados ficaram indisponiveis. 
              Se a exclusão foi acidental, ainda existe uma oportunidade para revisar esse encerramento.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Encerramento concluído</p>
                <p className="mt-1">
                  Seus dados ficam protegidos e indisponíveis por até {ACCOUNT_DELETION_GRACE_DAYS} dias para evitar perdas acidentais.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">Exclusão permanente automática</p>
                <p className="mt-1">
                  {permanentDeleteLabel
                    ? `Se nada for solicitado, a exclusão permanente será concluída automaticamente em ${permanentDeleteLabel}.`
                    : `Se nada for solicitado, a exclusão permanente será concluída automaticamente após ${ACCOUNT_DELETION_GRACE_DAYS} dias.`}
                </p>
              </div>
            </div>
          </div>

          {!deletionWindowExpired ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="mb-4 flex items-start gap-3 text-sm text-blue-800 dark:text-blue-300">
                <RotateCcw className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Precisa revisar essa exclusão?</p>
                  <p className="mt-1">
                    Envie um pedido de reativação dentro do período de {ACCOUNT_DELETION_GRACE_DAYS} dias e o suporte vai analisar o retorno da conta.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  value={restoreName}
                  onChange={(e) => setRestoreName(e.target.value)}
                  placeholder="Seu nome"
                  className="rounded-xl border-blue-200 bg-white dark:border-blue-900/40 dark:bg-zinc-950"
                />
                <Input
                  type="email"
                  value={restoreEmail}
                  onChange={(e) => setRestoreEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="rounded-xl border-blue-200 bg-white dark:border-blue-900/40 dark:bg-zinc-950"
                />
              </div>

              <textarea
                value={restoreMessage}
                onChange={(e) => setRestoreMessage(e.target.value)}
                placeholder="Conte brevemente por que deseja reativar sua conta."
                className="mt-3 min-h-[110px] w-full rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-0 placeholder:text-zinc-500 focus:border-blue-400 dark:border-blue-900/40 dark:bg-zinc-950 dark:text-zinc-100"
              />

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                  O suporte recebe essa solicitação com prioridade e valida a conta antes de qualquer reativação.
                </p>
                <Button
                  type="button"
                  onClick={handleRestoreRequest}
                  disabled={isSubmittingRestore || !restoreName.trim() || !restoreEmail.trim()}
                  className="rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                >
                  {isSubmittingRestore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                  Solicitar reativação
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              O prazo para reativacao desta conta terminou. A exclusao permanente sera mantida.
            </div>
          )}

          {restoreProtocol ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
              Solicitação enviada com sucesso. Protocolo: <strong>{restoreProtocol}</strong>
            </div>
          ) : null}

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
              {error}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="app-panel-subtle flex flex-col gap-3 border-t border-border/70 p-6 sm:flex-row sm:justify-between">
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full rounded-xl">
              <Home className="mr-2 h-4 w-4" />
              Ir para o inicio
            </Button>
          </Link>

          <Button
            type="button"
            onClick={handleFreshStart}
            disabled={isRestarting}
            className="w-full rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto"
          >
            {isRestarting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Criar nova conta do zero
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
