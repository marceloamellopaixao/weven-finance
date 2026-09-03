"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UsersRound } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { FAMILY_ROLE_LABELS } from "@/lib/workspaces/family";
import { acceptFamilyInvitation, getPendingFamilyInvitations, rejectFamilyInvitation } from "@/services/familyWorkspaceService";
import { setActiveWorkspaceId } from "@/services/workspaceService";
import type { PendingWorkspaceInvitation } from "@/types/workspace";

const PRIVATE_ROUTE_PATTERN = /^\/(dashboard|settings|account-profile|apps|cards|reports|piggy-bank|transactions|notifications)(\/|$)/;

export function WorkspaceInvitationModal() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const [invitations, setInvitations] = useState<PendingWorkspaceInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResponding, setIsResponding] = useState(false);
  const [cancellationConfirmed, setCancellationConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedForUserRef = useRef<string | null>(null);

  const loadInvitations = useCallback(async () => {
    if (!user) {
      loadedForUserRef.current = null;
      setInvitations([]);
      return;
    }
    if (loading || !PRIVATE_ROUTE_PATTERN.test(pathname || "")) {
      setInvitations([]);
      return;
    }
    if (loadedForUserRef.current === user.uid) return;
    loadedForUserRef.current = user.uid;
    setIsLoading(true);
    try {
      setInvitations(await getPendingFamilyInvitations());
    } catch {
      // O convite continua disponível nas notificações e no próximo acesso privado.
      loadedForUserRef.current = null;
    } finally {
      setIsLoading(false);
    }
  }, [loading, pathname, user]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  const invitation = invitations[0];
  const finishCurrent = () => {
    setCancellationConfirmed(false);
    setInvitations((current) => current.slice(1));
  };

  const handleAccept = async () => {
    if (!invitation) return;
    setIsResponding(true);
    setError(null);
    try {
      const result = await acceptFamilyInvitation(invitation.id, invitation.requiresSubscriptionCancellation && cancellationConfirmed);
      const acceptedMembership = result.members[0];
      if (acceptedMembership) {
        setActiveWorkspaceId(acceptedMembership.workspaceId, acceptedMembership.workspaceUid);
      }
      finishCurrent();
      window.dispatchEvent(new Event("wevenfinance:workspaces:changed"));
      if (result.subscriptionCanceled) {
        window.location.assign("/dashboard");
      }
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
      <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <UsersRound className="h-5 w-5" />
          </div>
          <DialogTitle>Convite para compartilhar uma família</DialogTitle>
          <DialogDescription>
            {invitation.inviterName} convidou você para participar de <strong>{invitation.workspaceName}</strong> como {FAMILY_ROLE_LABELS[invitation.role].toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        {invitation.requiresSubscriptionCancellation ? (
          <div className="space-y-3 rounded-2xl border border-amber-300/60 bg-amber-500/10 p-4 text-sm">
            <p className="font-semibold text-foreground">Você possui o plano {invitation.currentPlanName}.</p>
            <p className="text-muted-foreground">
              Para evitar duas cobranças, sua assinatura individual será cancelada ao aceitar. Seu acesso passará a ser somente ao perfil Família compartilhado; sua senha e seus dados pessoais não serão alterados.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300/50 bg-background/60 p-3">
              <Checkbox checked={cancellationConfirmed} disabled={isResponding} onCheckedChange={(checked) => setCancellationConfirmed(checked === true)} />
              <span className="leading-5">Confirmo o cancelamento do meu plano individual para entrar nesta família.</span>
            </label>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/70 bg-background/50 p-4 text-sm text-muted-foreground">
            Ao aceitar, você passará a usar o perfil Família compartilhado. Sua senha e seus dados pessoais não serão alterados.
          </div>
        )}
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button type="button" variant="outline" className="w-full rounded-xl" disabled={isResponding} onClick={() => void handleReject()}>
            Recusar convite
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl"
            disabled={isResponding || (invitation.requiresSubscriptionCancellation && !cancellationConfirmed)}
            onClick={() => void handleAccept()}
          >
            {isResponding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {invitation.requiresSubscriptionCancellation ? "Cancelar plano e aceitar" : "Aceitar convite"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
