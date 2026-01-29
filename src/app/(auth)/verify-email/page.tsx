"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { sendEmailVerification } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/services/firebase/client";
import { Mail, ShieldCheck, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import { FirebaseError } from "firebase/app";

export default function VerifyEmailPage() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  const handleSendEmailVerification = async () => {
    try {
      if (!user) return;
      setIsResending(true);

      await sendEmailVerification(user);
      toast.success("E-mail enviado! Verifique sua caixa de entrada.");
    } catch (error) {
      if (error instanceof FirebaseError && error.code === 'auth/too-many-requests') {
        toast.error("Muitas tentativas. Aguarde um pouco.");
      } else {
        toast.error("Erro ao enviar e-mail.");
      }
    } finally {
      setIsResending(false);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setIsChecking(true);

    try {
      // 1. Recarrega os dados do usuário no Auth
      await user.reload();

      // 2. IMPORTANTE: Força a atualização do Token (JWT)
      await user.getIdToken(true);

      if (user.emailVerified) {
        // 3. Atualiza o Firestore
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
          verifiedEmail: true,
          status: 'active'
        });

        // 4. Redirecionamento
        router.refresh();
        router.replace("/");
      } else {
        toast.error("Ainda não detectamos a verificação.\n\nSe você já clicou no link, aguarde alguns segundos e tente novamente.");
      }
    } catch (error) {
      console.error("Erro na verificação:", error);
      toast.error("Ocorreu um erro ao verificar. Tente novamente.");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">

      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        <Card className={`${zoomIn} bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-lg rounded-3xl overflow-hidden`}>
          <div className="h-2 w-full bg-linear-to-r from-violet-500 to-emerald-500" />

          <CardHeader className="text-center pb-2 pt-8">
            <div className={`${zoomIn} delay-100 mx-auto mb-4 bg-violet-100 dark:bg-violet-900/30 p-4 rounded-full w-fit`}>
              <Mail className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className={`${fadeInUp} delay-200 text-2xl font-bold text-zinc-900 dark:text-zinc-100`}>Verifique seu E-mail</CardTitle>
            <CardDescription className={`${fadeInUp} delay-300 text-base mt-2 text-zinc-600 dark:text-zinc-400`}>
              Enviamos um link de confirmação para <strong className="text-zinc-900 dark:text-zinc-200">{user?.email}</strong>.
              <br className="mb-2" />
              Clique nele para ativar sua conta.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">

            {/* Aviso de Privacidade */}
            <div className={`${fadeInUp} delay-500 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-5 flex gap-4 items-start`}>
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg shrink-0">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">Conta Segura</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Após verificar o e-mail, você terá acesso imediato ao painel. Seus dados já estão criptografados e protegidos.
                </p>
              </div>
            </div>

            <div className={`${fadeInUp} delay-700 text-center text-sm text-zinc-500 dark:text-zinc-400`}>
              <p>Não recebeu? Verifique a pasta de <strong>Spam</strong> ou <strong>Lixo Eletrônico</strong>.</p>
            </div>
          </CardContent>

          <CardFooter className={`${fadeInUp} delay-700 flex flex-col gap-3 pt-2 pb-8`}>
            <Button
              onClick={checkVerification}
              disabled={isChecking}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg hover:cursor-pointer transition-all duration-200 active:scale-[0.98]"
            >
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Já verifiquei meu e-mail
            </Button>

            <Button
              variant="ghost"
              onClick={handleSendEmailVerification}
              disabled={isResending}
              className="w-full h-12 flex items-center gap-2 rounded-xl border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 hover:cursor-pointer transition-all duration-200"
            >
              {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reenviar E-mail"}
            </Button>

            <Button
              onClick={logout}
              variant="outline"
              className="w-full h-12 flex items-center gap-2 rounded-xl border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 hover:cursor-pointer transition-all duration-200"
            >
              Voltar para Login <ArrowRight className=" h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}