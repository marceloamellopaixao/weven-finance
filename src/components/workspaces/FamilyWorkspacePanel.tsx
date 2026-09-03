"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Loader2, MailPlus, Minus, Plus, ShieldCheck, Trash2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  FAMILY_PERMISSION_LABELS,
  FAMILY_PERMISSION_GROUPS,
  FAMILY_ROLE_LABELS,
  canEditFamilyMembers,
  canEditFamilyPermissions,
  canInviteFamilyMembers,
  canViewFamilyMembers,
  normalizeFamilyPermissions,
  toggleFamilyPermissionSelection,
} from "@/lib/workspaces/family";
import { getFamilyWorkspace, inviteFamilyMember, leaveFamilyWorkspace, resendFamilyInvitation, revokeFamilyInvitation, updateAdditionalFamilySeats, updateFamilyMember } from "@/services/familyWorkspaceService";
import type { FamilyPermission, FamilyRole, Workspace, WorkspaceInvitation, WorkspaceMember, WorkspaceSeatSummary } from "@/types/workspace";

const ROLE_OPTIONS = Object.keys(FAMILY_ROLE_LABELS) as FamilyRole[];

function canViewMembers(workspace: Workspace | null) {
  if (!workspace) return false;
  if (!workspace.membership) return true;
  return canViewFamilyMembers(workspace.membership);
}

function getVisiblePermissions(permissions: FamilyPermission[]) {
  const visible = new Set(FAMILY_PERMISSION_GROUPS.flatMap((group) => group.permissions));
  return permissions.filter((permission) => visible.has(permission));
}

function PermissionMatrix({
  value,
  onChange,
  disabled,
}: {
  value: FamilyPermission[];
  onChange: (next: FamilyPermission[]) => void;
  disabled?: boolean;
}) {
  const visibleValue = getVisiblePermissions(value);
  const toggle = (permission: FamilyPermission) => {
    onChange(toggleFamilyPermissionSelection(visibleValue, permission));
  };

  return (
    <div className="space-y-2">
      {FAMILY_PERMISSION_GROUPS.map((group) => {
        const selectedCount = group.permissions.filter((permission) => visibleValue.includes(permission)).length;
        return (
          <details key={group.id} className="group rounded-2xl border border-border/70 bg-background/60 open:bg-accent/35">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{group.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{group.description}</span>
              </span>
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {selectedCount}/{group.permissions.length}
              </Badge>
            </summary>
            <div className="grid gap-2 border-t border-border/60 p-3 sm:grid-cols-2">
              {group.permissions.map((permission) => (
                <label key={permission} className={`flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm ${disabled ? "opacity-60" : ""}`}>
                  <Checkbox disabled={disabled} checked={visibleValue.includes(permission)} onCheckedChange={() => toggle(permission)} />
                  {FAMILY_PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function FamilyWorkspacePanel({ workspaces, loading }: { workspaces: Workspace[]; loading: boolean }) {
  const familyWorkspace = useMemo(
    () => {
      const active = workspaces.filter((workspace) => workspace.status !== "archived");
      return active.find((workspace) => workspace.type === "family" && (workspace.isDefault || workspace.membership)) || active.find((workspace) => workspace.type === "family") || null;
    },
    [workspaces],
  );

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<FamilyRole>("guest_member");
  const [permissions, setPermissions] = useState<FamilyPermission[]>(DEFAULT_FAMILY_ROLE_PERMISSIONS.guest_member);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [seats, setSeats] = useState<WorkspaceSeatSummary | null>(null);
  const [desiredAdditionalSeats, setDesiredAdditionalSeats] = useState(0);
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [isUpdatingSeats, setIsUpdatingSeats] = useState(false);
  const [showSeatUpdateConfirmation, setShowSeatUpdateConfirmation] = useState(false);
  const [updatingMemberUid, setUpdatingMemberUid] = useState<string | null>(null);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [invitationToRevoke, setInvitationToRevoke] = useState<WorkspaceInvitation | null>(null);
  const [isRevokingInvitation, setIsRevokingInvitation] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(null);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, FamilyPermission[]>>({});
  const [showLeaveConfirmation, setShowLeaveConfirmation] = useState(false);
  const [isLeavingFamily, setIsLeavingFamily] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const mayViewMembers = canViewMembers(familyWorkspace);
  const mayInviteMembers = !familyWorkspace?.membership || canInviteFamilyMembers(familyWorkspace.membership);
  const mayEditMembers = !familyWorkspace?.membership || canEditFamilyMembers(familyWorkspace.membership);
  const mayEditPermissions = !familyWorkspace?.membership || canEditFamilyPermissions(familyWorkspace.membership);

  const refresh = useCallback(async () => {
    if (!familyWorkspace || !mayViewMembers) return;
    setIsLoadingFamily(true);
    try {
      const data = await getFamilyWorkspace(familyWorkspace.id);
      setMembers(data.members);
      setInvitations(data.invitations);
      setSeats(data.seats);
      setDesiredAdditionalSeats(data.seats.additional);
    } catch {
      setMessage("Não foi possível carregar os membros agora. Tente novamente em alguns instantes.");
    } finally {
      setIsLoadingFamily(false);
    }
  }, [familyWorkspace, mayViewMembers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleRoleChange = (value: FamilyRole) => {
    setRole(value);
    setPermissions(DEFAULT_FAMILY_ROLE_PERMISSIONS[value]);
  };

  const handleInvite = async () => {
    if (!familyWorkspace || !email.trim()) return;
    setIsInviting(true);
    setMessage(null);
    try {
      const result = await inviteFamilyMember({
        workspaceId: familyWorkspace.id,
        email,
        displayName,
        role,
        permissions,
      });
      setEmail("");
      setDisplayName("");
      setMessage(
        result.recipientType === "existing_account"
          ? "Esta pessoa já possui uma conta. O convite aparecerá no próximo acesso para ela aceitar ou recusar."
          : "Convite enviado. A pessoa poderá criar o próprio acesso pelo e-mail recebido.",
      );
      setMembers((current) => current.some((member) => member.id === result.member.id) ? current : [...current, result.member]);
      setInvitations((current) => current.some((invitation) => invitation.id === result.invitation.id) ? current : [result.invitation, ...current]);
      setSeats(result.seats);
      setDesiredAdditionalSeats(result.seats.additional);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o convite agora. Revise o e-mail e tente novamente.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleMemberRoleChange = async (member: WorkspaceMember, nextRole: FamilyRole) => {
    if (!familyWorkspace) return;
    setUpdatingMemberUid(member.memberUid);
    setMessage(null);
    try {
      const nextPermissions = DEFAULT_FAMILY_ROLE_PERMISSIONS[nextRole];
      const result = await updateFamilyMember({
        workspaceId: familyWorkspace.id,
        memberUid: member.memberUid,
        role: nextRole,
        permissions: nextPermissions,
      });
      setMembers((current) => current.map((item) => (item.memberUid === result.member.memberUid ? result.member : item)));
      setPermissionDrafts((current) => {
        const next = { ...current };
        delete next[member.memberUid];
        return next;
      });
      setMessage("Papel e permissões atualizados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar este membro.");
    } finally {
      setUpdatingMemberUid(null);
    }
  };

  const handleMemberPermissionsChange = async (member: WorkspaceMember, nextPermissions: FamilyPermission[]) => {
    if (!familyWorkspace) return;
    const normalizedNext = normalizeFamilyPermissions(nextPermissions, member.role);
    const normalizedCurrent = normalizeFamilyPermissions(member.permissions, member.role);
    if (normalizedNext.length === normalizedCurrent.length && normalizedNext.every((permission) => normalizedCurrent.includes(permission))) {
      setPermissionDrafts((current) => {
        const next = { ...current };
        delete next[member.memberUid];
        return next;
      });
      return;
    }
    setUpdatingMemberUid(member.memberUid);
    setMessage(null);
    try {
      const result = await updateFamilyMember({
        workspaceId: familyWorkspace.id,
        memberUid: member.memberUid,
        permissions: normalizedNext,
      });
      setMembers((current) => current.map((item) => (item.memberUid === result.member.memberUid ? result.member : item)));
      setPermissionDrafts((current) => {
        const next = { ...current };
        delete next[member.memberUid];
        return next;
      });
      setMessage("Permissões atualizadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar as permissões.");
    } finally {
      setUpdatingMemberUid(null);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!familyWorkspace) return;
    setUpdatingMemberUid(member.memberUid);
    setMessage(null);
    try {
      const result = await updateFamilyMember({
        workspaceId: familyWorkspace.id,
        memberUid: member.memberUid,
        status: "disabled",
      });
      setMembers((current) => current.filter((item) => item.memberUid !== result.member.memberUid));
      setInvitations((current) => current.filter((invitation) => invitation.invitedMemberUid !== result.member.memberUid));
      if (result.seats) {
        setSeats(result.seats);
        setDesiredAdditionalSeats(result.seats.additional);
      }
      setMemberToRemove(null);
      setMessage("Membro removido da família.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover este membro.");
    } finally {
      setUpdatingMemberUid(null);
    }
  };

  const handleRevokeInvitation = async () => {
    if (!familyWorkspace || !invitationToRevoke) return;
    setIsRevokingInvitation(true);
    setMessage(null);
    try {
      const result = await revokeFamilyInvitation({
        workspaceId: familyWorkspace.id,
        invitationId: invitationToRevoke.id,
      });
      setInvitations((current) => current.filter((item) => item.id !== result.invitation.id));
      if (result.invitation.invitedMemberUid) {
        setMembers((current) => current.filter((member) => member.memberUid !== result.invitation.invitedMemberUid));
      }
      setSeats(result.seats);
      setDesiredAdditionalSeats(result.seats.additional);
      setInvitationToRevoke(null);
      setMessage("Convite cancelado e acesso reservado liberado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível cancelar o convite.");
    } finally {
      setIsRevokingInvitation(false);
    }
  };

  const handleResendInvitation = async (invitation: WorkspaceInvitation) => {
    if (!familyWorkspace || invitation.status !== "pending") return;
    setResendingInvitationId(invitation.id);
    setMessage(null);
    try {
      const result = await resendFamilyInvitation({
        workspaceId: familyWorkspace.id,
        invitationId: invitation.id,
      });
      setInvitations((current) => current.map((item) => (item.id === result.invitation.id ? result.invitation : item)));
      setMessage(result.emailSent ? "Convite reenviado por e-mail." : "Lembrete enviado dentro do WevenFinance.");
    } catch {
      setMessage("Não foi possível reenviar o convite agora. Tente novamente em alguns instantes.");
    } finally {
      setResendingInvitationId(null);
    }
  };

  const handleLeaveFamily = async () => {
    if (!familyWorkspace?.membership) return;
    setIsLeavingFamily(true);
    setMessage(null);
    try {
      await leaveFamilyWorkspace(familyWorkspace.id);
      setShowLeaveConfirmation(false);
      window.dispatchEvent(new Event("wevenfinance:workspaces:changed"));
      window.location.assign("/dashboard");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível sair da família agora.");
      setIsLeavingFamily(false);
    }
  };

  const handleUpdateSeats = async () => {
    if (!familyWorkspace || familyWorkspace.membership || !seats || desiredAdditionalSeats === seats.additional) return;
    setIsUpdatingSeats(true);
    setMessage(null);
    try {
      const result = await updateAdditionalFamilySeats(familyWorkspace.id, desiredAdditionalSeats);
      setSeats(result.seats);
      setDesiredAdditionalSeats(result.seats.additional);
      setShowSeatUpdateConfirmation(false);
      setMessage("Usuários adicionais atualizados. O novo valor será cobrado na próxima renovação, sem cobrança duplicada agora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar os usuários adicionais.");
    } finally {
      setIsUpdatingSeats(false);
    }
  };

  if (loading) {
    return (
      <Card className="app-panel-soft animate-pulse rounded-3xl border border-[var(--app-panel-border)]" role="status" aria-label="Carregando perfil Família">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <div className="h-6 w-48 rounded-xl bg-muted" />
            <div className="h-4 w-72 max-w-full rounded-xl bg-muted" />
          </div>
          <div className="h-16 rounded-2xl bg-muted/80" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 rounded-2xl bg-muted/70" />
            <div className="h-28 rounded-2xl bg-muted/70" />
          </div>
          <span className="sr-only">Carregando dados do perfil compartilhado</span>
        </CardContent>
      </Card>
    );
  }

  if (!familyWorkspace) {
    return (
      <Card className="app-panel-soft rounded-3xl border border-[var(--app-panel-border)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Perfil Família / Casa</CardTitle>
          <CardDescription>Crie um perfil Família / Casa para convidar e gerenciar seus familiares.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="app-panel-soft rounded-3xl border border-[var(--app-panel-border)]">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> {familyWorkspace.name}</CardTitle>
              <CardDescription>Convide familiares, defina papéis e escolha o que cada pessoa pode acessar.</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary">
              <ShieldCheck className="h-3 w-3" /> Família
            </Badge>
          </div>
        </CardHeader>
        {!mayViewMembers ? (
          <CardContent className="text-sm text-muted-foreground">Você pode usar este perfil, mas não tem permissão para gerenciar membros.</CardContent>
        ) : (
          <CardContent className="space-y-5">
            {seats ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/45 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">Pessoas no plano</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    O titular também conta como um usuário. Convites pendentes reservam um acesso.
                  </p>
                </div>
                <Badge variant="outline" className={seats.available > 0 ? "border-primary/30 bg-primary/10 text-primary" : "border-amber-300 bg-amber-500/10 text-amber-700"}>
                  {seats.occupied}/{seats.capacity} usuários
                </Badge>
              </div>
            ) : null}
            {!familyWorkspace.membership && seats ? (
              <div className="space-y-3 rounded-2xl border border-border/70 bg-background/45 px-4 py-4">
                <div>
                  <p className="text-sm font-semibold">Gerenciar usuários adicionais</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seats.additionalSeatPrice
                      ? `Cada usuário adicional custa R$ ${seats.additionalSeatPrice.toFixed(2).replace(".", ",")} por mês. A alteração entra na próxima renovação.`
                      : "O valor dos usuários adicionais ainda não foi configurado pelo Admin."}
                  </p>
                </div>
                {seats.additionalSeatPrice ? (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2" aria-label="Quantidade de usuários adicionais">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        disabled={isUpdatingSeats || desiredAdditionalSeats <= Math.max(0, seats.occupied - seats.included)}
                        onClick={() => setDesiredAdditionalSeats((current) => Math.max(Math.max(0, seats.occupied - seats.included), current - 1))}
                      >
                        <Minus className="h-4 w-4" />
                        <span className="sr-only">Remover um usuário adicional</span>
                      </Button>
                      <div className="min-w-28 text-center">
                        <p className="text-lg font-bold">{desiredAdditionalSeats}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {desiredAdditionalSeats === 1 ? "usuário adicional" : "usuários adicionais"}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 rounded-xl"
                        disabled={isUpdatingSeats || (seats.maxAdditionalSeats !== null && desiredAdditionalSeats >= seats.maxAdditionalSeats)}
                        onClick={() => setDesiredAdditionalSeats((current) => current + 1)}
                      >
                        <Plus className="h-4 w-4" />
                        <span className="sr-only">Adicionar um usuário adicional</span>
                      </Button>
                    </div>
                    <Button
                      type="button"
                      className="rounded-xl"
                      disabled={isUpdatingSeats || desiredAdditionalSeats === seats.additional}
                      onClick={() => setShowSeatUpdateConfirmation(true)}
                    >
                      {isUpdatingSeats ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Atualizar usuários
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {mayInviteMembers ? (
            <details className="rounded-2xl border border-[var(--app-panel-border)] bg-background/45">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-foreground">Convidar familiar</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Adicione uma pessoa e escolha o acesso dela.</span>
                </span>
                <Badge variant="outline" className="shrink-0 border-primary/25 bg-primary/10 text-primary">Convidar</Badge>
              </summary>
              <div className="grid gap-4 border-t border-border/70 p-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4 rounded-2xl border border-[var(--app-panel-border)] p-4">
                  <p className="text-sm font-semibold">Dados do membro</p>
                  <div className="space-y-2">
                    <Label htmlFor="family-email">E-mail do familiar</Label>
                    <Input id="family-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="family-name">Nome</Label>
                    <Input id="family-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Papel</Label>
                    <Select value={role} onValueChange={(value) => handleRoleChange(value as FamilyRole)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{FAMILY_ROLE_LABELS[option]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                    <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p>
                      Cada pessoa usa a própria conta e senha, que nunca são compartilhadas. Se o e-mail já estiver cadastrado, o convite aparecerá no WevenFinance; caso contrário, enviaremos um e-mail para criar o acesso.
                    </p>
                  </div>
                  <Button type="button" className="w-full gap-2 rounded-xl" disabled={isInviting || !email.trim()} onClick={handleInvite}>
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
                    Convidar familiar
                  </Button>
                </div>

                <div className="rounded-2xl border border-[var(--app-panel-border)] p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold">Permissões do convite</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Escolha o que esta pessoa poderá ver ou alterar.
                    </p>
                  </div>
                  <PermissionMatrix
                    value={permissions}
                    onChange={(next) => setPermissions(normalizeFamilyPermissions(next, role))}
                  />
                </div>
              </div>
            </details>
            ) : null}

            {message ? <p className="rounded-xl border border-border/70 px-3 py-2 text-xs text-muted-foreground">{message}</p> : null}

            {mayInviteMembers && invitations.some((invitation) => invitation.status === "pending") ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Convites pendentes</p>
                <div className="space-y-2">
                  {invitations.filter((invitation) => invitation.status === "pending").map((invitation) => (
                    <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--app-panel-border)] bg-background/45 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {FAMILY_ROLE_LABELS[invitation.role]} ainda não aceitou
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl"
                          disabled={resendingInvitationId === invitation.id || isRevokingInvitation}
                          onClick={() => void handleResendInvitation(invitation)}
                        >
                          {resendingInvitationId === invitation.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                          Reenviar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          disabled={resendingInvitationId === invitation.id || isRevokingInvitation}
                          onClick={() => setInvitationToRevoke(invitation)}
                        >
                          Cancelar convite
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
                <p className="text-sm font-semibold">Membros</p>
                {isLoadingFamily ? (
                  <div className="animate-pulse space-y-2" role="status" aria-label="Carregando membros">
                    {[0, 1].map((item) => (
                      <div key={item} className="flex items-center justify-between gap-3 rounded-xl border border-border/70 p-3">
                        <div className="space-y-2">
                          <div className="h-4 w-36 rounded-lg bg-muted" />
                          <div className="h-3 w-48 max-w-[60vw] rounded-lg bg-muted/80" />
                        </div>
                        <div className="h-9 w-32 rounded-xl bg-muted" />
                      </div>
                    ))}
                    <span className="sr-only">Carregando membros da família</span>
                  </div>
                ) : members.map((member) => {
                  const isOwnerManager = member.memberUid === member.workspaceUid;
                  const isInvitedManager = member.role === "family_manager" && !isOwnerManager;
                  return (
                  <div key={member.id} className={`rounded-xl border p-3 ${isOwnerManager ? "border-primary/30 bg-primary/8" : "border-[var(--app-panel-border)]"}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold">{member.displayName || member.email}</p>
                          {isOwnerManager ? (
                            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[10px] text-primary">Dono da família</Badge>
                          ) : null}
                          {isInvitedManager ? (
                            <Badge variant="outline" className="border-sky-300/60 bg-sky-500/10 text-[10px] text-sky-700">Gestor</Badge>
                          ) : null}
                          {member.status === "pending" ? (
                            <Badge variant="outline" className="border-amber-300/60 bg-amber-500/10 text-[10px] text-amber-700">Pendente</Badge>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                      {isOwnerManager ? (
                        <Badge variant="secondary" className="h-9 px-3">{FAMILY_ROLE_LABELS.family_manager}</Badge>
                      ) : mayEditMembers || mayEditPermissions ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {mayEditMembers ? (
                            <Select disabled={updatingMemberUid === member.memberUid} value={member.role} onValueChange={(value) => void handleMemberRoleChange(member, value as FamilyRole)}>
                              <SelectTrigger className="h-9 w-48">
                                {updatingMemberUid === member.memberUid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{FAMILY_ROLE_LABELS[option]}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : null}
                          {mayEditMembers ? (
                            <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={updatingMemberUid === member.memberUid} onClick={() => setMemberToRemove(member)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remover
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <Badge variant="secondary" className="h-9 px-3">{FAMILY_ROLE_LABELS[member.role]}</Badge>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {getVisiblePermissions(member.permissions).length} permissões configuradas.
                    </p>
                    {isOwnerManager ? (
                      <div className="mt-3 rounded-xl border border-primary/20 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                        O dono da família tem acesso completo para manter o perfil seguro.
                      </div>
                    ) : mayEditPermissions ? (
                      <details className="mt-3 rounded-xl border border-border/70 bg-background/60">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Editar permissões
                          </span>
                          <span className="text-[10px] font-medium text-primary">Configurar</span>
                        </summary>
                        <div className="space-y-3 border-t border-border/60 p-3">
                          <PermissionMatrix
                            value={permissionDrafts[member.memberUid] ?? member.permissions}
                            disabled={updatingMemberUid === member.memberUid}
                            onChange={(next) => setPermissionDrafts((current) => ({ ...current, [member.memberUid]: next }))}
                          />
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-xl"
                              disabled={!permissionDrafts[member.memberUid] || updatingMemberUid === member.memberUid}
                              onClick={() => void handleMemberPermissionsChange(member, permissionDrafts[member.memberUid] ?? member.permissions)}
                            >
                              {updatingMemberUid === member.memberUid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Salvar permissões
                            </Button>
                          </div>
                        </div>
                      </details>
                    ) : null}
                  </div>
                );
                })}
                {members.length === 0 && !isLoadingFamily ? (
                  <div className="rounded-xl border p-4 text-sm text-muted-foreground">Nenhum membro listado ainda.</div>
                ) : null}
            </div>
          </CardContent>
        )}
      </Card>

      {familyWorkspace.membership ? (
        <details className="rounded-2xl border border-border/70 bg-card/60">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-muted-foreground">
            Ações do perfil compartilhado
          </summary>
          <div className="flex flex-col gap-3 border-t border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Sair desta família</p>
              <p className="mt-1 text-xs text-muted-foreground">Você perderá o acesso compartilhado, mas sua conta pessoal não será apagada.</p>
            </div>
            <Button type="button" variant="outline" className="shrink-0 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={isLeavingFamily} onClick={() => setShowLeaveConfirmation(true)}>
              Sair da família
            </Button>
          </div>
        </details>
      ) : null}

      <Dialog open={Boolean(memberToRemove)} onOpenChange={(open) => !open && !updatingMemberUid && setMemberToRemove(null)}>
        <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Remover membro da família?</DialogTitle>
            <DialogDescription>
              {memberToRemove?.displayName || memberToRemove?.email} perderá o acesso a este perfil. A conta pessoal dessa pessoa não será apagada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={Boolean(updatingMemberUid)} onClick={() => setMemberToRemove(null)}>Manter membro</Button>
            <Button type="button" variant="destructive" disabled={!memberToRemove || Boolean(updatingMemberUid)} onClick={() => memberToRemove && void handleRemoveMember(memberToRemove)}>
              {updatingMemberUid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remover acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSeatUpdateConfirmation} onOpenChange={(open) => !isUpdatingSeats && setShowSeatUpdateConfirmation(open)}>
        <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Atualizar usuários adicionais?</DialogTitle>
            <DialogDescription>
              A capacidade passará para {seats ? seats.included + desiredAdditionalSeats : desiredAdditionalSeats} pessoas. O novo valor será aplicado somente na próxima renovação, sem cobrança imediata ou duplicada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={isUpdatingSeats} onClick={() => setShowSeatUpdateConfirmation(false)}>Manter quantidade</Button>
            <Button type="button" disabled={isUpdatingSeats} onClick={() => void handleUpdateSeats()}>
              {isUpdatingSeats ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar alteração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(invitationToRevoke)} onOpenChange={(open) => !open && !isRevokingInvitation && setInvitationToRevoke(null)}>
        <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancelar convite pendente?</DialogTitle>
            <DialogDescription>
              O convite de {invitationToRevoke?.email} deixará de funcionar e o acesso reservado será liberado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={isRevokingInvitation} onClick={() => setInvitationToRevoke(null)}>Voltar</Button>
            <Button type="button" variant="destructive" disabled={isRevokingInvitation} onClick={() => void handleRevokeInvitation()}>
              {isRevokingInvitation ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Cancelar convite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showLeaveConfirmation} onOpenChange={(open) => !isLeavingFamily && setShowLeaveConfirmation(open)}>
        <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Sair desta família?</DialogTitle>
            <DialogDescription>
              Você perderá acesso aos lançamentos, cartões e metas compartilhados. Sua conta continuará existindo e voltará ao perfil Pessoal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={isLeavingFamily} onClick={() => setShowLeaveConfirmation(false)}>Continuar na família</Button>
            <Button type="button" variant="destructive" disabled={isLeavingFamily} onClick={() => void handleLeaveFamily()}>
              {isLeavingFamily ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirmar saída
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
