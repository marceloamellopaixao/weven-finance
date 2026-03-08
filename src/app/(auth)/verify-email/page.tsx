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
          throw new Error("Erro ao atualizar verificacao de e-mail no perfil.");
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">
      <div className="w-full max-w-lg relative z-10">
        <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-lg rounded-3xl overflow-hidden">
          <div className="h-2 w-full bg-linear-to-r from-violet-500 to-emerald-500" />
          <CardHeader className="text-center pb-2 pt-8">
            <div className="mx-auto mb-4 bg-violet-100 dark:bg-violet-900/30 p-4 rounded-full w-fit">
              <Mail className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Verifique seu E-mail</CardTitle>
            <CardDescription className="text-base mt-2 text-zinc-600 dark:text-zinc-400">
              Enviamos um link de confirmação para <strong>{user?.email}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-5 flex gap-4 items-start">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg shrink-0">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                Após verificar o e-mail, você terá acesso imediato ao painel.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3 pt-2 pb-8">
            <Button
              onClick={checkVerification}
              disabled={isChecking}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
            >
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Já verifiquei meu e-mail
            </Button>
            <Button variant="ghost" onClick={handleSendEmailVerification} disabled={isResending} className="w-full h-12 rounded-xl">
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar E-mail"}
            </Button>
            <Button onClick={logout} variant="outline" className="w-full h-12 rounded-xl">
              Voltar para Login <ArrowRight className=" h-4 w-4 ml-1" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

