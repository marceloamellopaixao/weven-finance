"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, Mail, ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseClient } from "@/services/supabase/client";
import {
  clearPasswordAccessContext,
  readPasswordAccessIntent,
  sendPasswordAccessEmail,
  updateCurrentUserPassword,
  type PasswordAccessIntent,
} from "@/services/auth/passwordAccess";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { extractAuthProviders } from "@/lib/auth/providers";
import { resolvePendingUpgradePath } from "@/services/billing/checkoutIntent";

type PageIntent = PasswordAccessIntent;

function resolveIntent(value: string | null): PageIntent {
  if (value === "change-password" || value === "recovery" || value === "first-access") {
    return value;
  }
  return "first-access";
}

export default function FirstAccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile, loading, refreshProfile } = useAuth();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [emailSent, setEmailSent] = useState(searchParams.get("requested") === "1");
  const [isComplete, setIsComplete] = useState(false);
  const [storedIntent, setStoredIntent] = useState<PageIntent | null>(null);

  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  const searchIntent = useMemo(() => resolveIntent(searchParams.get("intent")), [searchParams]);
  const searchType = useMemo(() => searchParams.get("type"), [searchParams]);
  const searchCode = useMemo(() => searchParams.get("code"), [searchParams]);
  const requiresPasswordSetup = Boolean(userProfile?.needsPasswordSetup);
  const intent = useMemo<PageIntent>(() => {
    if (requiresPasswordSetup) {
      return "first-access";
    }
    if (searchIntent !== "first-access") {
      return searchIntent;
    }
    if (storedIntent) {
      return storedIntent;
    }
    if (isRecoveryMode) {
      return storedIntent === "change-password" ? "change-password" : "recovery";
    }
    return searchIntent;
  }, [isRecoveryMode, requiresPasswordSetup, searchIntent, storedIntent]);
  const canSetPasswordNow = Boolean(user && requiresPasswordSetup);
  const canManagePasswordInSession = Boolean(user && !requiresPasswordSetup && (intent === "change-password" || intent === "recovery"));
  const showPasswordForm = isRecoveryMode || canSetPasswordNow || canManagePasswordInSession;
  const canRequestEmailLink = Boolean(!requiresPasswordSetup && user?.email);

  const pageTitle =
    intent === "change-password"
      ? "Alterar Senha"
      : intent === "recovery"
        ? "Redefinir Senha"
        : "Primeiro Acesso";

  const pageDescription =
    intent === "change-password"
      ? "Enviamos um link seguro para você definir sua nova senha."
      : intent === "recovery"
        ? "Use o link recebido por e-mail para criar uma nova senha."
        : "Defina uma senha para também entrar com e-mail e senha, além do Google.";

  const successTitle = intent === "change-password" ? "Senha atualizada" : "Senha definida";
  const successDescription =
    intent === "change-password"
      ? "Sua nova senha já está ativa. Você pode voltar ao painel."
      : "Tudo certo. Seu acesso por e-mail e senha já está disponível.";

  const nextPath = resolvePendingUpgradePath() || "/dashboard";

  const handleSendEmail = useCallback(async () => {
    if (!user?.email) {
      setError("Não encontramos um e-mail válido para enviar o link.");
      return;
    }

    setError("");
    setIsSendingEmail(true);
    try {
      const emailIntent = intent === "change-password" ? "change-password" : intent === "recovery" ? "recovery" : "first-access";
      await sendPasswordAccessEmail(user.email, emailIntent);
      setStoredIntent(emailIntent);
      setEmailSent(true);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Erro ao enviar e-mail.";
      setError(message);
    } finally {
      setIsSendingEmail(false);
    }
  }, [intent, user?.email]);

  useEffect(() => {
    setStoredIntent(readPasswordAccessIntent());
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const hasRecoveryHash = () =>
      typeof window !== "undefined" &&
      (window.location.hash.includes("type=recovery") || window.location.hash.includes("access_token="));
    const hasRecoveryQuery = () => searchType === "recovery";
    const isRecoveryCallback = () => hasRecoveryHash() || hasRecoveryQuery() || Boolean(searchCode);

    if (isRecoveryCallback()) {
      setIsRecoveryMode(true);
      setEmailSent(true);
    }

    const exchangeCode = async () => {
      if (!searchCode) return;
      try {
        await supabase.auth.exchangeCodeForSession(searchCode);
        setIsRecoveryMode(true);
        setEmailSent(true);
        router.replace("/first-access");
      } catch {
        setError("Nao foi possivel validar o link de recuperacao. Solicite um novo envio.");
      }
    };

    void exchangeCode();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || isRecoveryCallback()) {
        setIsRecoveryMode(true);
        setEmailSent(true);
      }
    });

    return () => subscription.unsubscribe();
  }, [router, searchCode, searchType]);

  useEffect(() => {
    if (loading || isComplete) return;
    if (showPasswordForm) return;

    if (!user && intent === "first-access" && !isRecoveryMode) {
      router.replace("/login");
    }
  }, [intent, isComplete, isRecoveryMode, loading, router, showPasswordForm, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!password.trim()) {
      setError("Por favor, informe a nova senha.");
      return;
    }

    if (!confirmPassword.trim()) {
      setError("Por favor, confirme a nova senha.");
      return;
    }

    if (password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedUser = await updateCurrentUserPassword(password);
      const refreshedProviders = extractAuthProviders({
        app_metadata: updatedUser?.app_metadata as Record<string, unknown> | undefined,
        identities: (updatedUser?.identities as Array<{ provider?: string | null }> | undefined) || [],
      });
      const nextProviders = Array.from(new Set([...(refreshedProviders || []), "email"])).sort((a, b) => a.localeCompare(b));
      const token = await getAccessTokenOrThrow();

      await fetch("/api/profile/bootstrap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profile: {
            email: updatedUser?.email || user?.email || "",
            photoURL: user?.photoURL || "",
            verifiedEmail: true,
            authProviders: nextProviders,
            needsPasswordSetup: false,
          },
        }),
      });

      await refreshProfile();

      clearPasswordAccessContext();
      setIsComplete(true);
      window.setTimeout(() => {
        window.location.assign(nextPath);
      }, 900);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Não foi possível atualizar a senha.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10">
        <div className={`${zoomIn} bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 md:p-8`}>
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-4 text-zinc-500">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">Preparando seu acesso...</p>
            </div>
          ) : isComplete ? (
            <div className={`${fadeInUp} text-center space-y-6 py-4`}>
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full w-fit">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{successTitle}</h1>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {successDescription}
                </p>
              </div>
              <Button
                onClick={() => window.location.assign(nextPath)}
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10"
              >
                {nextPath === "/dashboard" ? "Ir para o painel" : "Continuar contratacao"}
              </Button>
            </div>
          ) : showPasswordForm ? (
            <>
              <div className="text-center mb-6 space-y-2">
                <div className={`${zoomIn} inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4`}>
                  <KeyRound className="h-6 w-6 text-white" />
                </div>
                <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100`}>
                  {pageTitle}
                </h1>
                <p className={`${fadeInUp} delay-200 text-sm text-zinc-500 dark:text-zinc-400`}>
                  {requiresPasswordSetup
                    ? "Defina sua senha agora para liberar acesso por Google e também por e-mail e senha."
                    : "Crie sua nova senha com segurança e volte ao painel."}
                </p>
              </div>

              {requiresPasswordSetup && emailSent && (
                <div className="mb-5 flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                  Também enviamos um link de segurança para <strong>{user?.email}</strong>, caso você prefira concluir por e-mail.
                </div>
              )}

              <form onSubmit={handleSubmit} className={`${fadeInUp} delay-300 space-y-5`}>
                <div className="space-y-2">
                  <Label htmlFor="password">Nova senha</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo de 6 caracteres"
                    className="bg-white/50 dark:bg-zinc-800/50"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirmar senha</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Repita a nova senha"
                    className="bg-white/50 dark:bg-zinc-800/50"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
                >
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Salvar nova senha"}
                </Button>

                {canRequestEmailLink && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                    className="w-full h-11 rounded-xl border-zinc-200 hover:bg-zinc-50"
                  >
                    {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Receber link por e-mail"}
                  </Button>
                )}
              </form>
            </>
          ) : (
            <>
              <div className="text-center mb-6 space-y-2">
                <div className={`${zoomIn} inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4`}>
                  <Mail className="h-6 w-6 text-white" />
                </div>
                <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100`}>
                  {pageTitle}
                </h1>
                <p className={`${fadeInUp} delay-200 text-sm text-zinc-500 dark:text-zinc-400`}>
                  {pageDescription}
                </p>
              </div>

              <div className={`${fadeInUp} delay-300 space-y-4`}>
                <div className="app-panel-subtle rounded-2xl border p-4 text-sm text-zinc-600 dark:text-zinc-300">
                  {emailSent ? (
                    <>
                      Enviamos um link seguro para <strong>{user?.email || "seu e-mail"}</strong>. Abra a mensagem para definir sua nova senha aqui no WevenFinance.
                    </>
                  ) : (
                    <>Abra o link recebido no seu e-mail para continuar. Se precisar, você pode solicitar um novo envio.</>
                  )}
                </div>

                {error && (
                  <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                {canRequestEmailLink && (
                  <Button
                    onClick={handleSendEmail}
                    disabled={isSendingEmail}
                  className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-medium shadow-lg shadow-black/10 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
                  >
                    {isSendingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar link novamente"}
                  </Button>
                )}
              </div>
            </>
          )}

          <div className={`${fadeInUp} delay-500 mt-8 text-center`}>
            <Link
              href={user ? "/dashboard" : "/login"}
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center justify-center gap-1 hover:cursor-pointer transition-all duration-200"
            >
              <ArrowLeft className="w-3 h-3" /> {user ? "Voltar ao painel" : "Voltar para login"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
