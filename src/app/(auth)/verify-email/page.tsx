"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Mail, ShieldCheck, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { getSupabaseClient } from "@/services/supabase/client";
import {
  buildEmailVerificationRedirectUrl,
  clearPendingVerificationEmail,
  readPendingVerificationEmail,
} from "@/services/auth/emailVerification";
import { resolvePendingUpgradePath } from "@/services/billing/checkoutIntent";
import { AuthPageShell, authIconClassName } from "@/components/auth/AuthPageShell";

export default function VerifyEmailPage() {
  const { logout, user, userProfile } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    setPendingEmail(readPendingVerificationEmail());
  }, []);

  const displayEmail = useMemo(() => user?.email || pendingEmail || "", [pendingEmail, user?.email]);

  const syncVerifiedEmail = useCallback(async (token: string) => {
    const response = await fetch("/api/profile/verify-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const payload = (await response.json()) as { ok: boolean };
    if (!response.ok || !payload.ok) {
      throw new Error("Erro ao atualizar verificação de e-mail no perfil.");
    }
    clearPendingVerificationEmail();
    router.refresh();
    router.replace(resolvePendingUpgradePath() || "/dashboard");
  }, [router]);

  useEffect(() => {
    if (!user || !user.emailVerified || userProfile?.verifiedEmail) return;

    let cancelled = false;
    const autoSync = async () => {
      try {
        const token = await user.getIdToken(true);
        if (!cancelled) {
          await syncVerifiedEmail(token);
        }
      } catch {
        // fallback to manual verification button
      }
    };

    void autoSync();
    return () => {
      cancelled = true;
    };
  }, [syncVerifiedEmail, user, user?.emailVerified, userProfile?.verifiedEmail]);

  const handleSendEmailVerification = async () => {
    try {
      const targetEmail = user?.email || pendingEmail;
      if (!targetEmail) {
        toast.error("Nao encontramos um e-mail para reenviar.");
        return;
      }
      setIsResending(true);
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: targetEmail,
        options: {
          emailRedirectTo: buildEmailVerificationRedirectUrl(),
        },
      });
      if (error) throw new Error(error.message || "Erro ao reenviar e-mail.");
      setPendingEmail(targetEmail);
      toast.success("E-mail enviado! Verifique sua caixa de entrada.");
    } catch {
      toast.error("Erro ao enviar e-mail.");
    } finally {
      setIsResending(false);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setIsChecking(true);
    try {
      const refreshed = await user.reload();
      if (refreshed.emailVerified) {
        const token = await refreshed.getIdToken(true);
        await syncVerifiedEmail(token);
      } else {
        toast.error("Ainda não detectamos a verificação. Tente novamente em alguns segundos.");
      }
    } catch {
      toast.error("Ocorreu um erro ao verificar. Tente novamente.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AuthPageShell maxWidthClassName="max-w-lg">
        <Card className="app-panel-soft overflow-hidden rounded-3xl border border-[color:var(--app-panel-border)] shadow-2xl shadow-primary/10 backdrop-blur-xl">
          <div className="h-2 w-full bg-primary" />
          <CardHeader className="pb-2 pt-8 text-center">
            <div className={`${authIconClassName} mx-auto mb-4`}>
              <Mail className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Verifique seu e-mail</CardTitle>
            <CardDescription className="mt-2 text-base text-muted-foreground">
              Enviamos um link de confirmação para <strong>{displayEmail || "seu e-mail"}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-start gap-4 rounded-2xl border border-primary/20 bg-primary/10 p-5">
              <div className="shrink-0 rounded-lg bg-primary/10 p-2 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <p className="text-xs leading-relaxed text-foreground">
                Após verificar o e-mail, você terá acesso imediato ao painel.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-8 pt-2">
            <Button
              onClick={checkVerification}
              disabled={isChecking}
              className="h-12 w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Já verifiquei meu e-mail
            </Button>
            <Button variant="ghost" onClick={handleSendEmailVerification} disabled={isResending} className="h-12 w-full rounded-xl">
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar e-mail"}
            </Button>
            {user ? (
              <Button onClick={logout} variant="outline" className="h-12 w-full rounded-xl">
                Voltar para login <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={() => router.push("/login")} variant="outline" className="h-12 w-full rounded-xl">
                Ir para login <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </CardFooter>
        </Card>
    </AuthPageShell>
  );
}
