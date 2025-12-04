"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Wallet, ArrowRight, ShieldCheck } from "lucide-react";

// Componente simples do ícone do Google para não depender de libs externas
const GoogleIcon = () => (
  <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export default function LoginPage() {
  const { signInWithGoogle, user } = useAuth();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Login falhou", error);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 relative overflow-hidden font-sans">
      
      {/* Background Decorativo (Gradientes e Formas) */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-violet-500/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-[20%] right-[20%] w-[200px] h-[200px] bg-emerald-500/10 rounded-full blur-[80px]" />
      </div>

      <div className="w-full max-w-md p-6 relative z-10 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Card de Login */}
        <div className="bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl border border-white/20 dark:border-zinc-800 shadow-2xl rounded-3xl p-8 md:p-10">
          
          {/* Logo e Cabeçalho */}
          <div className="text-center mb-8 space-y-2">
            <div className="inline-flex items-center justify-center p-3 bg-ilnear-to-tr from-violet-600 to-indigo-600 rounded-2xl shadow-lg shadow-violet-500/20 mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Weven<span className="text-violet-600">Finance</span>
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Gestão inteligente para o seu futuro.
            </p>
          </div>

          {/* Área de Ação */}
          <div className="space-y-6">
            <div className="space-y-4">
              <Button 
                onClick={handleLogin} 
                disabled={isLoading}
                className="w-full h-12 bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-700 text-base font-medium shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl group relative overflow-hidden"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">Conectando...</span>
                ) : (
                  <span className="flex items-center justify-center w-full">
                    <GoogleIcon />
                    Continuar com Google
                    <ArrowRight className="w-4 h-4 ml-2 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all text-zinc-400" />
                  </span>
                )}
              </Button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200 dark:border-zinc-800" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-transparent px-2 text-zinc-400">Segurança Garantida</span>
              </div>
            </div>

            {/* Badges de Confiança */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Dados Criptografados
              </div>
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Wallet className="h-4 w-4 text-blue-500" />
                Controle Total
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-xs text-zinc-400">
              Ao continuar, você concorda com nossos <a href="#" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Termos</a> e <a href="#" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">Privacidade</a>.
            </p>
          </div>
        </div>
        
        <p className="text-center text-xs text-zinc-400 mt-6 opacity-60">
          © {new Date().getFullYear()} Weven Finance. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}