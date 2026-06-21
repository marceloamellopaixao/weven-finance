"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, MailPlus, ShieldCheck, Trash2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  FAMILY_PERMISSION_LABELS,
  FAMILY_PERMISSION_GROUPS,
  FAMILY_ROLE_LABELS,
  canViewFamilyMembers,
  normalizeFamilyPermissions,
} from "@/lib/workspaces/family";
import { getFamilyWorkspace, inviteFamilyMember, resendFamilyInvitation, resendFamilyMemberAccess, updateFamilyMember } from "@/services/familyWorkspaceService";
import type { FamilyPermission, FamilyRole, Workspace, WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";

const ROLE_OPTIONS = Object.keys(FAMILY_ROLE_LABELS) as FamilyRole[];

function canManage(workspace: Workspace | null) {
  if (!workspace) return false;
  if (!workspace.membership) return true;
  return workspace.membership.permissions.includes("manage_members");
}

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
    const next = visibleValue.includes(permission)
      ? visibleValue.filter((item) => item !== permission)
      : [...visibleValue, permission];
    onChange(next);
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
    () => workspaces.find((workspace) => workspace.type === "family" && (workspace.isDefault || workspace.membership)) || workspaces.find((workspace) => workspace.type === "family") || null,
    [workspaces],
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<FamilyRole>("guest_member");
  const [permissions, setPermissions] = useState<FamilyPermission[]>(DEFAULT_FAMILY_ROLE_PERMISSIONS.guest_member);
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteMode, setInviteMode] = useState<"temporary_password" | "auto_password" | "self_setup">("self_setup");
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [resendingInvitationId, setResendingInvitationId] = useState<string | null>(null);
  const [resendingMemberUid, setResendingMemberUid] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const mayManage = canManage(familyWorkspace);
  const mayViewMembers = canViewMembers(familyWorkspace);

  const toggleExpanded = () => setIsExpanded((current) => !current);

  const refresh = useCallback(async () => {
    if (!familyWorkspace || !mayViewMembers) return;
    setIsLoadingFamily(true);
    try {
      const data = await getFamilyWorkspace(familyWorkspace.id);
      setMembers(data.members);
      setInvitations(data.invitations);
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
        inviteMode,
        temporaryPassword: inviteMode === "temporary_password" ? temporaryPassword : undefined,
      });
      setEmail("");
      setDisplayName("");
      setTemporaryPassword("");
      setMessage(
        result.emailSent
          ? "Convite enviado. Peça para a pessoa verificar a caixa de entrada e o lixo eletrônico."
          : "Acesso criado. Compartilhe a senha temporária com a pessoa por um canal seguro.",
      );
      await refresh();
    } catch {
      setMessage("Não foi possível enviar o convite agora. Revise o e-mail e tente novamente.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleMemberRoleChange = async (member: WorkspaceMember, nextRole: FamilyRole) => {
    if (!familyWorkspace) return;
    const nextPermissions = DEFAULT_FAMILY_ROLE_PERMISSIONS[nextRole];
    const updated = await updateFamilyMember({
      workspaceId: familyWorkspace.id,
      memberUid: member.memberUid,
      role: nextRole,
      permissions: nextPermissions,
    });
    setMembers((current) => current.map((item) => (item.memberUid === updated.memberUid ? updated : item)));
  };

  const handleMemberPermissionsChange = async (member: WorkspaceMember, nextPermissions: FamilyPermission[]) => {
    if (!familyWorkspace) return;
    const updated = await updateFamilyMember({
      workspaceId: familyWorkspace.id,
      memberUid: member.memberUid,
      permissions: normalizeFamilyPermissions(nextPermissions, member.role),
    });
    setMembers((current) => current.map((item) => (item.memberUid === updated.memberUid ? updated : item)));
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!familyWorkspace) return;
    const confirmed = window.confirm(
      `Remover ${member.displayName || member.email} da família? A conta da pessoa não será apagada.`
    );
    if (!confirmed) return;
    const updated = await updateFamilyMember({
      workspaceId: familyWorkspace.id,
      memberUid: member.memberUid,
      status: "disabled",
    });
    setMembers((current) => current.filter((item) => item.memberUid !== updated.memberUid));
      setMessage("Membro removido da família.");
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
      setMessage("Convite reenviado. Peça para a pessoa verificar a caixa de entrada e o lixo eletrônico.");
    } catch {
      setMessage("Não foi possível reenviar o convite agora. Tente novamente em alguns instantes.");
    } finally {
      setResendingInvitationId(null);
    }
  };

  const handleResendMemberAccess = async (member: WorkspaceMember) => {
    if (!familyWorkspace) return;
    setResendingMemberUid(member.memberUid);
    setMessage(null);
    try {
      await resendFamilyMemberAccess({
        workspaceId: familyWorkspace.id,
        memberUid: member.memberUid,
      });
      setMessage("Acesso reenviado. Peça para a pessoa verificar a caixa de entrada e o lixo eletrônico.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível reenviar o acesso.");
    } finally {
      setResendingMemberUid(null);
    }
  };

  if (loading) {
    return (
      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando perfil...
        </CardContent>
      </Card>
    );
  }

  if (!familyWorkspace) {
    return (
      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Perfil Família / Casa</CardTitle>
          <CardDescription>Crie um perfil Família / Casa para convidar e gerenciar seus familiares.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> {familyWorkspace.name}</CardTitle>
              <CardDescription>Convide familiares, defina papéis e escolha o que cada pessoa pode acessar.</CardDescription>
            </div>
            <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary">
              <ShieldCheck className="h-3 w-3" /> Familia
            </Badge>
          </div>
        </CardHeader>
        {!mayViewMembers ? (
          <CardContent className="text-sm text-muted-foreground">Você pode usar este perfil, mas não tem permissão para gerenciar membros.</CardContent>
        ) : (
          <CardContent className="space-y-5">
            {mayManage ? (
            <details className="rounded-2xl border border-color:var(--app-panel-border) bg-background/45">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-sm font-semibold text-foreground">Convidar familiar</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">Adicione uma pessoa e escolha o acesso dela.</span>
                </span>
                <Badge variant="outline" className="shrink-0 border-primary/25 bg-primary/10 text-primary">Convidar</Badge>
              </summary>
              <div className="grid gap-4 border-t border-border/70 p-4 lg:grid-cols-[1fr_1.2fr]">
                <div className="space-y-4 rounded-2xl border border-color:var(--app-panel-border) p-4">
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
                  <div className="space-y-2">
                    <Label>Acesso inicial</Label>
                    <Select value={inviteMode} onValueChange={(value) => setInviteMode(value as "temporary_password" | "auto_password" | "self_setup")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="self_setup">Enviar convite para criar senha</SelectItem>
                        <SelectItem value="temporary_password">Definir senha temporária</SelectItem>
                        <SelectItem value="auto_password">Gerar senha automaticamente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {inviteMode === "temporary_password" ? (
                    <div className="space-y-2">
                      <Label htmlFor="family-temp-password">Senha temporária</Label>
                      <Input id="family-temp-password" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} />
                    </div>
                  ) : null}
                  <Button type="button" className="w-full gap-2 rounded-xl" disabled={isInviting || !email.trim()} onClick={handleInvite}>
                    {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailPlus className="h-4 w-4" />}
                    Convidar familiar
                  </Button>
                </div>

                <div className="rounded-2xl border border-color:var(--app-panel-border) p-4">
                  <div className="mb-3">
                    <p className="text-sm font-semibold">Permissoes do convite</p>
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

            {mayManage && invitations.some((invitation) => invitation.status === "pending") ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Convites pendentes</p>
                <div className="space-y-2">
                  {invitations.filter((invitation) => invitation.status === "pending").map((invitation) => (
                    <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-color:var(--app-panel-border) bg-background/45 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {FAMILY_ROLE_LABELS[invitation.role]} ainda não aceitou
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl"
                        disabled={resendingInvitationId === invitation.id}
                        onClick={() => void handleResendInvitation(invitation)}
                      >
                        {resendingInvitationId === invitation.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                        Reenviar convite
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="space-y-2">
                <p className="text-sm font-semibold">Membros</p>
                {isLoadingFamily ? (
                  <div className="rounded-xl border p-4 text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Carregando membros...</div>
                ) : members.map((member) => {
                  const isOwnerManager = member.memberUid === member.workspaceUid;
                  const isInvitedManager = member.role === "family_manager" && !isOwnerManager;
                  return (
                  <div key={member.id} className={`rounded-xl border p-3 ${isOwnerManager ? "border-primary/30 bg-primary/8" : "border-color:var(--app-panel-border)"}`}>
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
                      ) : mayManage ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Select value={member.role} onValueChange={(value) => void handleMemberRoleChange(member, value as FamilyRole)}>
                            <SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{FAMILY_ROLE_LABELS[option]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl" disabled={resendingMemberUid === member.memberUid} onClick={() => void handleResendMemberAccess(member)}>
                            {resendingMemberUid === member.memberUid ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
                            Reenviar acesso
                          </Button>
                          <Button type="button" variant="outline" size="sm" className="h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void handleRemoveMember(member)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Remover
                          </Button>
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
                    ) : mayManage ? (
                      <details onToggle={toggleExpanded} className="mt-3 rounded-xl border border-border/70 bg-background/60">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                            Editar permissões
                          </span>
                          {/* Ao clicar o botão abrir ele fica fechar */}
                          <span className="text-[10px] font-medium text-primary">{isExpanded ? 'Fechar' : 'Abrir'}</span>
                        </summary>
                        <div className="border-t border-border/60 p-3">
                          <PermissionMatrix
                            value={member.permissions}
                            onChange={(next) => void handleMemberPermissionsChange(member, next)}
                          />
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

      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardContent className="flex items-start gap-3 p-5 text-sm text-muted-foreground">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          As senhas e links de acesso são protegidos. Ninguém da família consegue ver a senha de outra pessoa.
        </CardContent>
      </Card>

      <Card className="app-panel-soft rounded-3xl border border-amber-300/60">
        <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold text-foreground">Encerrar família</p>
              <p className="mt-1">
                Essa opção ainda não está disponível. 
                <br />
                Por enquanto, você pode remover membros individualmente.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" className="rounded-xl border-amber-300 text-amber-700" disabled>
            Indisponível no momento
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
