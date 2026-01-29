"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Lock, MessageCircle } from "lucide-react";

export default function BlockedPage() {
  const { userProfile, logout, loading } = useAuth();
  
  // Definição das animações (Padrão do sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";
  const zoomIn = "animate-in fade-in zoom-in-50 duration-500 fill-mode-both";

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500 text-sm">Carregando informações...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-20 flex flex-col items-center justify-center">
      
      <Card className={`${fadeInUp} w-full border-red-200 dark:border-red-900/50 shadow-2xl bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden`}>
        <div className="h-2 w-full bg-red-600" />

        <CardHeader className="text-center pb-2 pt-6">
          <div className={`${zoomIn} mx-auto bg-red-50 dark:bg-red-900/20 p-4 rounded-full w-fit mb-4 border border-red-100 dark:border-red-900/50`}>
            <Lock className="h-10 w-10 text-red-600 dark:text-red-500" />
          </div>
          
          <CardTitle className={`${fadeInUp} delay-150 text-2xl font-bold text-red-600 dark:text-red-500`}>
            Acesso Suspenso
          </CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-6 px-6 md:px-8">
          <p className={`${fadeInUp} delay-300 text-zinc-600 dark:text-zinc-400 leading-relaxed`}>
            A sua conta encontra-se temporariamente bloqueada pelos administradores do sistema.
          </p>

          {/* 3. Caixa de motivo deslizando com atraso */}
          <div className={`${fadeInUp} delay-500`}>
            {userProfile?.blockReason ? (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 p-4 rounded-xl text-left shadow-sm">
                <span className="flex text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1 items-center gap-2">
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
          </div>

          <p className={`${fadeInUp} delay-700 text-xs text-zinc-500 px-2 leading-relaxed`}>
            Para recuperar o acesso, regularizar pagamentos ou contestar esta ação, por favor entre em contato com a nossa equipe de suporte.
          </p>
        </CardContent>

        <CardFooter className={`${fadeInUp} delay-700 flex flex-col gap-3 pt-2 pb-8 px-6 md:px-8`}>
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 rounded-xl shadow-lg shadow-green-600/20 hover:cursor-pointer transition-all hover:scale-[1.02] font-semibold text-base"
            onClick={() => window.open("https://wa.me/5511992348613", "_blank")}
          >
            <MessageCircle className="h-5 w-5" /> 
            Falar no WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 h-12 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:cursor-pointer gap-2 transition-all hover:scale-[1.02] font-medium text-base"
            onClick={logout}
          >
            Sair da Conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}