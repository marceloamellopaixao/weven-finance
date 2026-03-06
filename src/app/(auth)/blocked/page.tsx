"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertTriangle, Lock, MessageCircle } from "lucide-react";

export default function BlockedPage() {
  const { userProfile, logout, loading } = useAuth();

  const isBlocked = userProfile?.status === "blocked";
  const title = isBlocked ? "Acesso Bloqueado" : "Conta Inativa";
  const description = isBlocked
    ? "Sua conta foi bloqueada pela equipe administrativa."
    : "Sua conta está inativa no momento.";

  if (loading) {
    return (
        <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500 text-sm">Carregando informações...</div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg mx-auto px-4 py-20 flex flex-col items-center justify-center">
      <Card className="w-full border-red-200 shadow-2xl bg-white rounded-3xl overflow-hidden">
        <div className="h-2 w-full bg-red-600" />

        <CardHeader className="text-center pb-2 pt-6">
          <div className="mx-auto bg-red-50 p-4 rounded-full w-fit mb-4 border border-red-100">
            {isBlocked ? (
              <Lock className="h-10 w-10 text-red-600" />
            ) : (
              <AlertTriangle className="h-10 w-10 text-red-600" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-red-600">{title}</CardTitle>
        </CardHeader>

        <CardContent className="text-center space-y-6 px-6 md:px-8">
          <p className="text-zinc-600 leading-relaxed">{description}</p>

          {userProfile?.blockReason ? (
            <div className="bg-red-50 border border-red-100 p-4 rounded-xl text-left shadow-sm">
              <span className="flex text-xs font-bold text-red-600 uppercase tracking-wider mb-1 items-center gap-2">
                Motivo
              </span>
              <p className="text-red-900 font-medium text-sm">{userProfile.blockReason}</p>
            </div>
          ) : (
            <div className="bg-zinc-100 p-4 rounded-xl text-sm text-zinc-500 italic">
              Nenhum motivo específico foi informado.
            </div>
          )}

          <p className="text-xs text-zinc-500 px-2 leading-relaxed">
            Entre em contato com o suporte para regularizar seu acesso.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 pt-2 pb-8 px-6 md:px-8">
          <Button
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-12 rounded-xl shadow-lg shadow-green-600/20 hover:cursor-pointer transition-all hover:scale-[1.02] font-semibold text-base"
            onClick={() => window.open("https://wa.me/5511992348613", "_blank")}
          >
            <MessageCircle className="h-5 w-5" />
            Falar no WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="w-full text-zinc-500 hover:text-zinc-900 h-12 rounded-xl hover:bg-zinc-100 hover:cursor-pointer gap-2 transition-all hover:scale-[1.02] font-medium text-base"
            onClick={logout}
          >
            Sair da Conta
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
