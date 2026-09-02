"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { FAMILY_ROLE_LABELS } from "@/lib/workspaces/family";
import { acceptFamilyInvitation, getPendingFamilyInvitations, rejectFamilyInvitation } from "@/services/familyWorkspaceService";
import type { PendingWorkspaceInvitation } from "@/types/workspace";

export function WorkspaceInvitationModal() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [invitations, setInvitations] = useState<PendingWorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!user) {
      setInvitations([]);
      return;
    }
    if (loading || pathname === "/first-access") return;
    setIsLoading(true);
    try {
      setInvitations(await getPendingFamilyInvitations());
    } catch {
      // O convite continua disponível nas notificações e no próximo acesso.
    } finally {
      setIsLoading(false);
    }
  }, [loading, pathname, user]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const invitation = invitations[0];
  const finishCurrent = () => setInvitations((current) => current.slice(1));

  const handleAccept = async () => {
    if (!invitation) return;
    setIsResponding(true);
    setError(null);
    try {
      await acceptFamilyInvitation(invitation.id);
      finishCurrent();
      window.dispatchEvent(new Event("wevenfinance:workspaces:changed"));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível aceitar o convite.");
    } finally {
      setIsResponding(false);
    }
  };

  const handleReject = async () => {
    if (!invitation) return;
    setIsResponding(true);
    setError(null);
    try {
      await rejectFamilyInvitation(invitation.id);
      finishCurrent();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível recusar o convite.");
    } finally {
      setIsResponding(false);
    }
  };

  if (isLoading || !invitation) return null;

  return (
    <Dialog open>
      <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[460px]" showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UsersRound className="h-5 w-5" />
          </div>
          <DialogTitle>Convite para compartilhar uma família</DialogTitle>
          <DialogDescription>
            {invitation.inviterName} convidou você para participar de <strong>{invitation.workspaceName}</strong> como {FAMILY_ROLE_LABELS[invitation.role].toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
          Ao aceitar, sua conta Free continua existindo e você apenas ganha acesso ao perfil compartilhado. Sua senha, assinatura e dados pessoais não serão alterados.
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="outline" className="w-full rounded-xl" disabled={isResponding} onClick={() => void handleReject()}>
            Recusar
          </Button>
          <Button type="button" className="w-full rounded-xl" disabled={isResponding} onClick={() => void handleAccept()}>
            {isResponding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Aceitar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
