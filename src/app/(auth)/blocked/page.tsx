"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Lock, MessageCircle } from "lucide-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BlockedPage() {
  const { userProfile, logout, loading, user } = useAuth();
  const router = useRouter();

  // Redirecionamentos de segurança
  useEffect(() => {
    if (!loading) {
      // Se estiver logado e ATIVO, não deveria estar aqui -> vai para home
      if (userProfile && userProfile.status === 'active') {
        router.push("/");
      }
    }
  }, [user, userProfile, loading, router]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">Carregando...</div>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 font-sans p-4">
      <Card className="w-full max-w-md border-red-200 dark:border-red-900/50 shadow-2xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden">
        <div className="h-2 w-full bg-red-600" />
        
        <CardHeader className="text-center pb-2 pt-8">
          <div className="mx-auto bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-fit mb-4 animate-in zoom-in duration-500 border border-red-100 dark:border-red-900/50">
            <Lock className="h-10 w-10 text-red-600 dark:text-red-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-500">Acesso Suspenso</CardTitle>
        </CardHeader>
        
        <CardContent className="text-center space-y-6 px-8">
          <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">
            A sua conta encontra-se temporariamente bloqueada pelos administradores do sistema.
          </p>
          
          {userProfile?.blockReason ? (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-4 rounded-xl text-left shadow-sm">
              <span className="flex text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                Motivo do Bloqueio
              </span>
              <p className="text-red-900 dark:text-red-100 font-medium text-sm">
                {userProfile.blockReason}
              </p>
            </div>
          ) : (
            <div className="bg-zinc-100 dark:bg-zinc-800 p-4 rounded-xl text-sm text-zinc-500 italic">
              Nenhum motivo específico foi informado.
            </div>
          )}

          <p className="text-xs text-zinc-500 px-4">
            Para recuperar o acesso, regularizar pagamentos ou contestar esta acção, por favor entre em contacto com a nossa equipa de suporte.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2 pb-8 px-8">
          <Button 
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 rounded-xl shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02] font-semibold text-base"
            onClick={() => window.open("https://wa.me/5511988024979", "_blank")} // Substitua pelo número real do suporte
          >
            <MessageCircle className="h-5 w-5" /> Falar no WhatsApp
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 h-12 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800" 
            onClick={logout}
          >
            Sair da Conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}