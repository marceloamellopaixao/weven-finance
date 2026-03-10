"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { Mail, ShieldCheck, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { getSupabaseClient } from "@/services/supabase/client";

export default function VerifyEmailPage() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const handleSendEmailVerification = async () => {
    try {
      if (!user?.email) return;
      setIsResending(true);
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: user.email,
      });
      if (error) throw new Error(error.message || "Erro ao reenviar e-mail.");
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
      const token = await refreshed.getIdToken(true);
      if (refreshed.emailVerified) {
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
        router.refresh();
        router.replace("/");
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 font-sans">
      <div className="relative z-10 w-full max-w-lg">
        <Card className="overflow-hidden rounded-3xl border-zinc-200 bg-white/80 shadow-lg backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="h-2 w-full bg-linear-to-r from-violet-500 to-emerald-500" />
          <CardHeader className="pb-2 pt-8 text-center">
            <div className="mx-auto mb-4 w-fit rounded-full bg-violet-100 p-4 dark:bg-violet-900/30">
              <Mail className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Verifique seu e-mail</CardTitle>
            <CardDescription className="mt-2 text-base text-zinc-600 dark:text-zinc-400">
              Enviamos um link de confirmação para <strong>{user?.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-start gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-5 dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <div className="shrink-0 rounded-lg bg-emerald-100 p-2 dark:bg-emerald-900/50">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
                Após verificar o e-mail, você terá acesso imediato ao painel.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pb-8 pt-2">
            <Button
              onClick={checkVerification}
              disabled={isChecking}
              className="h-12 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Já verifiquei meu e-mail
            </Button>
            <Button variant="ghost" onClick={handleSendEmailVerification} disabled={isResending} className="h-12 w-full rounded-xl">
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar e-mail"}
            </Button>
            <Button onClick={logout} variant="outline" className="h-12 w-full rounded-xl">
              Voltar para login <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
