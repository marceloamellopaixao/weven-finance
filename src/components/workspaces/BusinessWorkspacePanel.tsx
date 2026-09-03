"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, MailPlus, Minus, Plus, RefreshCw, ShieldCheck, Trash2, UsersRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BUSINESS_PERMISSION_GROUPS,
  BUSINESS_PERMISSION_LABELS,
  BUSINESS_ROLE_LABELS,
  DEFAULT_BUSINESS_ROLE_PERMISSIONS,
  canEditBusinessMembers,
  canEditBusinessPermissions,
  canInviteBusinessMembers,
  canViewBusinessMembers,
  normalizeBusinessPermissions,
  toggleBusinessPermissionSelection,
} from "@/lib/workspaces/business";
import {
  getBusinessWorkspace,
  inviteBusinessMember,
  resendBusinessInvitation,
  revokeBusinessInvitation,
  updateAdditionalBusinessSeats,
  updateBusinessMember,
} from "@/services/businessWorkspaceService";
import type {
  BusinessPermission,
  BusinessRole,
  BusinessWorkspaceInvitation,
  BusinessWorkspaceMember,
  Workspace,
  WorkspaceSeatSummary,
} from "@/types/workspace";

const ROLE_OPTIONS: Exclude<BusinessRole, "business_owner">[] = ["financial_admin", "collaborator", "accountant_viewer"];

function isBusinessMember(member: Workspace["membership"]): member is BusinessWorkspaceMember {
  return Boolean(member && ["business_owner", "financial_admin", "collaborator", "accountant_viewer"].includes(member.role));
}

function PermissionMatrix({ value, onChange, disabled }: { value: BusinessPermission[]; onChange: (permissions: BusinessPermission[]) => void; disabled?: boolean }) {
  return (
    <div className="space-y-2">
      {BUSINESS_PERMISSION_GROUPS.map((group) => {
        const selected = group.permissions.filter((permission) => value.includes(permission)).length;
        return (
          <details key={group.id} className="rounded-2xl border border-border/70 bg-background/55 open:bg-accent/25">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold">{group.title}</span>
                <span className="block text-xs text-muted-foreground">{group.description}</span>
              </span>
              <Badge variant="outline">{selected}/{group.permissions.length}</Badge>
            </summary>
            <div className="grid gap-2 border-t border-border/60 p-3 md:grid-cols-2">
              {group.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 rounded-xl border border-border/50 px-3 py-2 text-sm">
                  <Checkbox disabled={disabled} checked={value.includes(permission)} onCheckedChange={() => onChange(toggleBusinessPermissionSelection(value, permission))} />
                  {BUSINESS_PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function BusinessWorkspacePanel({ workspaces, loading }: { workspaces: Workspace[]; loading: boolean }) {
  const workspace = useMemo(() => {
    const business = workspaces.filter((item) => item.status !== "archived" && item.type === "business");
    return business.find((item) => item.isDefault || item.membership) || business[0] || null;
  }, [workspaces]);
  const membership = workspace && isBusinessMember(workspace.membership) ? workspace.membership : null;
  const mayView = !workspace?.membership || canViewBusinessMembers(membership);
  const mayInvite = !workspace?.membership || canInviteBusinessMembers(membership);
  const mayEdit = !workspace?.membership || canEditBusinessMembers(membership);
  const mayEditPermissions = !workspace?.membership || canEditBusinessPermissions(membership);

  const [members, setMembers] = useState<BusinessWorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<BusinessWorkspaceInvitation[]>([]);
  const [seats, setSeats] = useState<WorkspaceSeatSummary | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Exclude<BusinessRole, "business_owner">>("collaborator");
  const [permissions, setPermissions] = useState<BusinessPermission[]>(DEFAULT_BUSINESS_ROLE_PERMISSIONS.collaborator);
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, BusinessPermission[]>>({});
  const [additionalSeats, setAdditionalSeats] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!workspace || !mayView) return;
    setBusy("load");
    setMessage(null);
    try {
      const result = await getBusinessWorkspace(workspace.id);
      setMembers(result.members);
      setInvitations(result.invitations);
      setSeats(result.seats);
      setAdditionalSeats(result.seats.additional);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a equipe.");
    } finally {
      setBusy(null);
    }
  }, [mayView, workspace]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleRole = (next: Exclude<BusinessRole, "business_owner">) => {
    setRole(next);
    setPermissions(DEFAULT_BUSINESS_ROLE_PERMISSIONS[next]);
  };

  const invite = async () => {
    if (!workspace || !email.trim()) return;
    setBusy("invite");
    setMessage(null);
    try {
      const result = await inviteBusinessMember({ workspaceId: workspace.id, email, displayName, role, permissions });
      setMembers((current) => current.some((item) => item.id === result.member.id) ? current : [...current, result.member]);
      setInvitations((current) => [result.invitation, ...current.filter((item) => item.id !== result.invitation.id)]);
      setSeats(result.seats);
      setEmail("");
      setDisplayName("");
      setMessage(result.recipientType === "existing_account" ? "Convite enviado para uma conta existente." : "Convite enviado. A pessoa definirá a própria senha no primeiro acesso.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível enviar o convite.");
    } finally {
      setBusy(null);
    }
  };

  const changeRole = async (member: BusinessWorkspaceMember, nextRole: Exclude<BusinessRole, "business_owner">) => {
    if (!workspace) return;
    setBusy(member.memberUid);
    try {
      const result = await updateBusinessMember({ workspaceId: workspace.id, memberUid: member.memberUid, role: nextRole, permissions: DEFAULT_BUSINESS_ROLE_PERMISSIONS[nextRole] });
      setMembers((current) => current.map((item) => item.memberUid === member.memberUid ? result.member : item));
      setPermissionDrafts((current) => { const next = { ...current }; delete next[member.memberUid]; return next; });
      setMessage("Papel e permissões atualizados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o funcionário.");
    } finally { setBusy(null); }
  };

  const savePermissions = async (member: BusinessWorkspaceMember) => {
    if (!workspace) return;
    const draft = normalizeBusinessPermissions(permissionDrafts[member.memberUid] || member.permissions, member.role);
    setBusy(member.memberUid);
    try {
      const result = await updateBusinessMember({ workspaceId: workspace.id, memberUid: member.memberUid, permissions: draft });
      setMembers((current) => current.map((item) => item.memberUid === member.memberUid ? result.member : item));
      setPermissionDrafts((current) => { const next = { ...current }; delete next[member.memberUid]; return next; });
      setMessage("Permissões atualizadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar as permissões.");
    } finally { setBusy(null); }
  };

  const removeMember = async (member: BusinessWorkspaceMember) => {
    if (!workspace || !window.confirm(`Remover ${member.displayName || member.email} da equipe?`)) return;
    setBusy(member.memberUid);
    try {
      const result = await updateBusinessMember({ workspaceId: workspace.id, memberUid: member.memberUid, status: "disabled" });
      setMembers((current) => current.filter((item) => item.memberUid !== member.memberUid));
      if (result.seats) setSeats(result.seats);
      setMessage("Funcionário removido da equipe. Os lançamentos anteriores foram preservados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover o funcionário.");
    } finally { setBusy(null); }
  };

  const changeSeats = async () => {
    if (!workspace || !seats || additionalSeats === seats.additional) return;
    setBusy("seats");
    try {
      const result = await updateAdditionalBusinessSeats(workspace.id, additionalSeats);
      setSeats(result.seats);
      setMessage("Usuários adicionais atualizados. A alteração será aplicada na próxima renovação, sem cobrança duplicada agora.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar os usuários adicionais.");
    } finally { setBusy(null); }
  };

  if (loading || (busy === "load" && !seats)) {
    return <Card className="rounded-3xl"><CardContent className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!workspace) return null;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden rounded-3xl border-primary/20">
        <CardHeader className="bg-linear-to-r from-primary/12 via-primary/5 to-transparent">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl"><BriefcaseBusiness className="h-5 w-5 text-primary" /> Equipe Business/PJ</CardTitle>
              <CardDescription>Convide funcionários e defina exatamente quais dados cada pessoa pode consultar ou alterar.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={Boolean(busy)}><RefreshCw className="mr-2 h-4 w-4" /> Atualizar</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          {message ? <div className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm">{message}</div> : null}

          {seats ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {[["Incluídos", seats.included], ["Adicionais", seats.additional], ["Em uso", seats.occupied], ["Disponíveis", seats.available]].map(([label, value]) => (
                <div key={label} className="rounded-2xl border bg-background/60 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>
              ))}
            </div>
          ) : null}

          {mayInvite ? (
            <section className="space-y-4 rounded-2xl border bg-background/45 p-4">
              <div><h3 className="font-semibold">Convidar funcionário</h3><p className="text-sm text-muted-foreground">Contas existentes recebem o convite no aplicativo; novas contas recebem o acesso por e-mail.</p></div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-2"><Label>Nome</Label><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nome do funcionário" /></div>
                <div className="space-y-2"><Label>E-mail</Label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pessoa@empresa.com" /></div>
                <div className="space-y-2"><Label>Papel</Label><Select value={role} onValueChange={(value) => handleRole(value as Exclude<BusinessRole, "business_owner">)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{BUSINESS_ROLE_LABELS[item]}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <PermissionMatrix value={permissions} onChange={setPermissions} />
              <Button onClick={() => void invite()} disabled={!email.trim() || Boolean(busy)}><MailPlus className="mr-2 h-4 w-4" />{busy === "invite" ? "Enviando..." : "Enviar convite"}</Button>
            </section>
          ) : null}

          {seats && !workspace.membership ? (
            <section className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border bg-background/45 p-4">
              <div><h3 className="font-semibold">Gerenciar usuários adicionais</h3><p className="text-sm text-muted-foreground">O proprietário já ocupa um usuário. Reduções só são permitidas quando não há pessoas ou convites ocupando a capacidade.</p></div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setAdditionalSeats((value) => Math.max(0, value - 1))}><Minus className="h-4 w-4" /></Button>
                <span className="min-w-10 text-center font-semibold">{additionalSeats}</span>
                <Button variant="outline" size="icon" onClick={() => setAdditionalSeats((value) => Math.min(seats.maxAdditionalSeats ?? value + 1, value + 1))}><Plus className="h-4 w-4" /></Button>
                <Button onClick={() => void changeSeats()} disabled={busy === "seats" || additionalSeats === seats.additional}>Aplicar</Button>
              </div>
            </section>
          ) : null}
        </CardContent>
      </Card>

      {mayView ? (
        <Card className="rounded-3xl">
          <CardHeader><CardTitle className="flex items-center gap-2"><UsersRound className="h-5 w-5" /> Funcionários</CardTitle><CardDescription>{members.length} pessoa(s) vinculada(s) ao perfil.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {members.map((member) => {
              const owner = member.role === "business_owner" || member.memberUid === workspace.uid;
              const draft = permissionDrafts[member.memberUid] || member.permissions;
              return (
                <div key={member.id} className="rounded-2xl border bg-background/55 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div><p className="font-semibold">{member.displayName || member.email}</p><p className="text-sm text-muted-foreground">{member.email}</p></div>
                    <div className="flex items-center gap-2">
                      <Badge variant={member.status === "active" ? "default" : "outline"}>{member.status === "active" ? "Ativo" : "Convite pendente"}</Badge>
                      {owner ? <Badge variant="secondary"><ShieldCheck className="mr-1 h-3 w-3" /> Proprietário</Badge> : (
                        <Select value={member.role} disabled={!mayEdit || busy === member.memberUid} onValueChange={(value) => void changeRole(member, value as Exclude<BusinessRole, "business_owner">)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{BUSINESS_ROLE_LABELS[item]}</SelectItem>)}</SelectContent></Select>
                      )}
                      {!owner && mayEdit ? <Button variant="destructive" size="icon" onClick={() => void removeMember(member)} disabled={busy === member.memberUid}><Trash2 className="h-4 w-4" /></Button> : null}
                    </div>
                  </div>
                  {!owner && mayEditPermissions ? (
                    <details className="mt-4"><summary className="cursor-pointer text-sm font-medium text-primary">Editar permissões</summary><div className="mt-3 space-y-3"><PermissionMatrix value={draft} onChange={(next) => setPermissionDrafts((current) => ({ ...current, [member.memberUid]: next }))} disabled={busy === member.memberUid} /><Button size="sm" disabled={!permissionDrafts[member.memberUid] || busy === member.memberUid} onClick={() => void savePermissions(member)}>Salvar permissões</Button></div></details>
                  ) : null}
                </div>
              );
            })}
            {members.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum funcionário vinculado.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {mayInvite && invitations.some((item) => item.status === "pending") ? (
        <Card className="rounded-3xl"><CardHeader><CardTitle className="text-lg">Convites pendentes</CardTitle></CardHeader><CardContent className="space-y-2">{invitations.filter((item) => item.status === "pending").map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"><div><p className="font-medium">{invitation.email}</p><p className="text-xs text-muted-foreground">{BUSINESS_ROLE_LABELS[invitation.role]}</p></div><div className="flex gap-2"><Button variant="outline" size="sm" onClick={async () => { if (!workspace) return; setBusy(invitation.id); try { await resendBusinessInvitation(workspace.id, invitation.id); setMessage("Convite reenviado."); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao reenviar."); } finally { setBusy(null); } }} disabled={busy === invitation.id}><MailPlus className="mr-2 h-4 w-4" />Reenviar</Button><Button variant="outline" size="sm" onClick={async () => { if (!workspace) return; setBusy(invitation.id); try { const result = await revokeBusinessInvitation(workspace.id, invitation.id); setInvitations((current) => current.filter((item) => item.id !== invitation.id)); setMembers((current) => current.filter((item) => item.memberUid !== invitation.invitedMemberUid)); setSeats(result.seats); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cancelar."); } finally { setBusy(null); } }} disabled={busy === invitation.id}><Trash2 className="mr-2 h-4 w-4" />Cancelar</Button></div></div>)}</CardContent></Card>
      ) : null}
    </div>
  );
}
