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

export default function VerifyEmailPage() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(false);

  const handleSendEmailVerification = async () => {
    try {
      if (!user) {
        alert("Usuário não autenticado!");
        return;
      }
      await sendEmailVerification(user);
      alert("E-mail de verificação enviado com sucesso!");
    }
    catch (error) {
      alert("Erro ao enviar e-mail. Tente novamente em alguns minutos.");
      console.error(error);
    }
  };

  const checkVerification = async () => {
    if (!user) return;
    setIsChecking(true);
    try {
        // 1. Força o Firebase a atualizar o token localmente para ver se o emailVerified mudou
        await user.reload();
        
        if (user.emailVerified) {
            // 2. Atualiza o banco de dados para refletir a verificação
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, { verifiedEmail: true });
            
            // 3. Redireciona para o dashboard
            router.push("/"); 
            // Opcional: router.refresh() se necessário
        } else {
            alert("Ainda não conseguimos confirmar. Verifique sua caixa de entrada (e spam) e clique no link.");
        }
    } catch (error) {
        console.error("Erro ao verificar:", error);
        alert("Erro ao verificar status. Tente novamente.");
    } finally {
        setIsChecking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden font-sans px-4">
      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-lg relative z-10 animate-in fade-in zoom-in-95 duration-500">
        <Card className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-3xl overflow-hidden">
          <div className="h-2 w-full bg-linear-to-r from-violet-500 to-emerald-500" />

          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 bg-violet-100 dark:bg-violet-900/30 p-4 rounded-full w-fit">
              <Mail className="h-8 w-8 text-violet-600 dark:text-violet-400" />
            </div>
            <CardTitle className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Verifique seu E-mail</CardTitle>
            <CardDescription className="text-base mt-2 text-zinc-600 dark:text-zinc-400">
              Enviamos um link de confirmação para o seu endereço de e-mail.
              <br />
              Clique nele para ativar sua conta e liberar seu acesso ao painel.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-6">

            {/* Aviso de Privacidade */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-5 flex gap-4 items-start">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-lg shrink-0">
                <ShieldCheck className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 text-sm">Privacidade Garantida</h4>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">
                  Utilizamos criptografia de ponta a ponta. Isso significa que <strong>ninguém da nossa equipe</strong>, desenvolvedores ou suporte, consegue visualizar seus valores, saldos ou transações. Seus dados são exclusivamente seus.
                </p>
              </div>
            </div>

            <div className="text-center text-sm text-zinc-500 dark:text-zinc-400">
              <p>Não recebeu o e-mail? Verifique sua caixa de Spam.</p>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-2 pb-8">
            <Button 
                onClick={checkVerification} 
                disabled={isChecking}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg transition-all active:scale-[0.98]"
            >
                {isChecking ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Já verifiquei meu e-mail
            </Button>
            
            <Button variant="ghost" onClick={handleSendEmailVerification} className="w-full h-12 flex items-center gap-2 rounded-xl border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">Enviar Novamente</Button>
            
            <Button onClick={logout} variant="outline" className="w-full h-12 flex items-center gap-2 rounded-xl border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800">
              Voltar para Login <ArrowRight className=" h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}