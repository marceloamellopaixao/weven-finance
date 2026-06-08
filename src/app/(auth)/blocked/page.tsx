"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, DollarSign, Loader2, Lock, Mail, MessageCircle } from "lucide-react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { sendSupportRequest } from "@/hooks/supportService";

const WHATSAPP_SUPPORT_URL = "https://wa.me/5511992348613";

export default function BlockedPage() {
  const { user, userProfile, logout, loading, canPreviewRestrictedPages } = useAuth();
  const router = useRouter();
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);
  const [supportFeedback, setSupportFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const isBlocked = userProfile?.status === "blocked";
  const isInactive = userProfile?.status === "inactive";
  const canViewBlockedPage = isBlocked || isInactive || canPreviewRestrictedPages;
  const title = isBlocked ? "Acesso Bloqueado" : isInactive ? "Conta Inativa" : "Pré-visualização de bloqueio";
  const description = isBlocked
    ? "Sua conta foi bloqueada pela equipe administrativa."
    : isInactive
      ? "Sua conta está inativa no momento."
      : "Você está visualizando esta tela com permissão administrativa de auditoria.";

  useEffect(() => {
    if (loading) return;
    if (canViewBlockedPage) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [canViewBlockedPage, loading, router, user]);

  async function handleSupportRequest() {
    if (!user || !userProfile) return;
    setIsSubmittingSupport(true);
    setSupportFeedback(null);
    try {
      const result = await sendSupportRequest(
        user.uid,
        user.email || userProfile.email || "",
        userProfile.completeName || userProfile.displayName || user.email || "Usuário",
        [
          isBlocked ? "Solicitação de suporte para conta bloqueada." : "Solicitação de suporte para conta inativa.",
          userProfile.blockReason ? `Motivo exibido: ${userProfile.blockReason}` : "Nenhum motivo foi exibido ao usuário.",
          "O usuário pediu análise para regularizar o acesso.",
        ].join("\n")
      );
      setSupportFeedback({
        type: "success",
        message: result.protocol
          ? `Solicitação enviada. Protocolo: ${result.protocol}.`
          : "Solicitação enviada. O suporte vai analisar seu acesso.",
      });
    } catch (error) {
      setSupportFeedback({
        type: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar a solicitação agora.",
      });
    } finally {
      setIsSubmittingSupport(false);
    }
  }

  if (loading || !canViewBlockedPage) {
    return (
      <AuthPageShell maxWidthClassName="max-w-md">
        <div className="animate-pulse text-sm text-muted-foreground">Carregando informações...</div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell maxWidthClassName="max-w-lg">
      <Card className="app-panel-soft w-full overflow-hidden rounded-3xl border border-destructive/25 shadow-2xl shadow-destructive/10">
        <div className="h-2 w-full bg-destructive" />

        <CardHeader className="pb-2 pt-6 text-center">
          <div className="mx-auto mb-4 w-fit rounded-full border border-destructive/20 bg-destructive/10 p-4 text-destructive">
            {isBlocked ? <Lock className="h-10 w-10" /> : <AlertTriangle className="h-10 w-10" />}
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
            Solicite suporte técnico para que a equipe administrativa analise seu acesso.
          </p>

          {supportFeedback ? (
            <div
              role={supportFeedback.type === "error" ? "alert" : "status"}
              className={`rounded-xl border px-4 py-3 text-sm ${
                supportFeedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-destructive/20 bg-destructive/10 text-destructive"
              }`}
            >
              {supportFeedback.message}
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="flex flex-col gap-3 px-6 pb-8 pt-2 md:px-8">
          <Button
            type="button"
            className="h-12 w-full gap-2 rounded-xl text-base font-semibold"
            onClick={handleSupportRequest}
            disabled={isSubmittingSupport}
          >
            {isSubmittingSupport ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5" />}
            Solicitar suporte técnico
          </Button>

          {userProfile?.blockReason === "Falta de Pagamento" ? (
            <Link
              href="/settings?tab=billing"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 text-base font-semibold text-white shadow-lg shadow-green-600/20 transition-transform duration-200 hover:scale-[1.02] hover:bg-green-700 hover:cursor-pointer"
            >
              <DollarSign className="h-5 w-5" />
              Regularizar Pagamento
            </Link>
          ) : null}

          <Link
            href={WHATSAPP_SUPPORT_URL}
            target="_blank"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-green-600/30 bg-green-50 text-base font-semibold text-green-700 shadow-sm transition-transform duration-200 hover:scale-[1.02] hover:bg-green-100 hover:cursor-pointer"
          >
            <MessageCircle className="h-5 w-5" />
            Falar no WhatsApp
          </Link>

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
