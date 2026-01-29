"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Loader2, ArrowLeft, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/services/firebase/client";
import { FirebaseError } from "firebase/app";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState("");

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Por favor, insira seu e-mail.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Por favor, insira um e-mail válido.");
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setIsSent(true);
    } catch (err) {
      if (err instanceof FirebaseError) {
        if (err.code === 'auth/user-not-found') {
           // Por segurança, alguns sistemas não avisam, mas para UX aqui avisaremos
           setError("E-mail não encontrado em nossa base."); 
        } else {
           setError("Erro ao enviar e-mail. Tente novamente.");
        }
      } else {
        setError("Ocorreu um erro inesperado.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden font-sans px-4">
      
      {/* Background Decorativo */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        
        <div className={`${zoomIn} bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-6 md:p-8`}>
          
          {!isSent ? (
            <>
              <div className="text-center mb-6 space-y-2">
                <div className={`${zoomIn} inline-flex items-center justify-center p-3 bg-linear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4`}>
                  <KeyRound className="h-6 w-6 text-white" />
                </div>
                <h1 className={`${fadeInUp} delay-150 text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100`}>
                  Recuperar Senha
                </h1>
                <p className={`${fadeInUp} delay-200 text-sm text-zinc-500 dark:text-zinc-400`}>
                  Digite seu e-mail para receber um link de redefinição.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className={`${fadeInUp} delay-300 space-y-6`}>
                <div className="space-y-2">
                  <Label htmlFor="email"><Mail className="inline-block mr-2 h-4 w-4" /> E-mail</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="seu@email.com" 
                    className="bg-white/50 dark:bg-zinc-800/50 focus-visible:ring-violet-500"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {error && (
                  <div className="text-red-500 text-xs text-center font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                    {error}
                  </div>
                )}

                <Button 
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-medium shadow-lg shadow-violet-500/20 active:scale-[0.98] hover:cursor-pointer transition-all duration-200"
                >
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Enviar Link"}
                </Button>
              </form>
            </>
          ) : (
            <div className={`${fadeInUp} text-center space-y-6 py-4`}>
              <div className="mx-auto bg-emerald-100 dark:bg-emerald-900/30 p-4 rounded-full w-fit animate-in zoom-in duration-300">
                <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">E-mail Enviado!</h2>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Verifique sua caixa de entrada (e spam) no endereço <strong>{email}</strong> para redefinir sua senha.
                </p>
              </div>
              
              <Button 
                onClick={() => setIsSent(false)}
                variant="outline"
                className="w-full h-11 rounded-xl border-zinc-200 hover:bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 hover:cursor-pointer transition-all duration-200"
              >
                Tentar outro e-mail
              </Button>
            </div>
          )}

          <div className={`${fadeInUp} delay-500 mt-8 text-center`}>
            <Link 
              href="/login" 
              className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 flex items-center justify-center gap-1 hover:cursor-pointer transition-all duration-200"
            >
              <ArrowLeft className="w-3 h-3" /> Voltar para Login
            </Link>
          </div>

        </div>
        
        <p className={`${fadeInUp} delay-700 text-center text-[10px] text-zinc-400 mt-6 opacity-60`}>
          © 2026 WevenFinance.
        </p>
      </div>
    </div>
  );
}