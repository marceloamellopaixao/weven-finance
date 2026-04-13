"use client";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { AlertTriangle, Lock, MessageCircle } from "lucide-react";
import { AuthPageShell } from "@/components/auth/AuthPageShell";

export default function BlockedPage() {
  const { userProfile, logout, loading } = useAuth();

  const isBlocked = userProfile?.status === "blocked";
  const title = isBlocked ? "Acesso Bloqueado" : "Conta Inativa";
  const description = isBlocked
    ? "Sua conta foi bloqueada pela equipe administrativa."
    : "Sua conta está inativa no momento.";

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground">Carregando informações...</div>
      </div>
    );
  }

  return (
    <AuthPageShell maxWidthClassName="max-w-lg">
      <Card className="app-panel-soft w-full overflow-hidden rounded-3xl border border-destructive/25 shadow-2xl shadow-destructive/10">
        <div className="h-2 w-full bg-destructive" />

        <CardHeader className="pb-2 pt-6 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            {isBlocked ? (
              <Lock className="h-10 w-10" />
            ) : (
              <AlertTriangle className="h-10 w-10" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold text-destructive">{title}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 px-6 text-center md:px-8">
          <p className="leading-relaxed text-muted-foreground">{description}</p>

          {userProfile?.blockReason ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-left shadow-sm">
              <span className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-destructive">
                Motivo
              </span>
              <p className="text-sm font-medium text-foreground">{userProfile.blockReason}</p>
            </div>
          ) : (
            <div className="rounded-xl bg-muted p-4 text-sm italic text-muted-foreground">
              Nenhum motivo específico foi informado.
            </div>
          )}

          <p className="px-2 text-xs leading-relaxed text-muted-foreground">
            Entre em contato com o suporte para regularizar seu acesso.
          </p>
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-8 pt-2 md:px-8">
          <Button
            className="h-12 w-full gap-2 rounded-xl bg-green-600 text-base font-semibold text-white shadow-lg shadow-green-600/20 transition-transform duration-200 hover:scale-[1.02] hover:bg-green-700 hover:cursor-pointer"
            onClick={() => window.open("https://wa.me/5511992348613", "_blank")}
          >
            <MessageCircle className="h-5 w-5" />
            Falar no WhatsApp
          </Button>

          <Button
            variant="ghost"
            className="h-12 w-full gap-2 rounded-xl text-base font-medium text-muted-foreground hover:text-foreground hover:cursor-pointer"
            onClick={logout}
          >
            Sair da Conta
          </Button>
        </CardFooter>
      </Card>
    </AuthPageShell>
  );
}
