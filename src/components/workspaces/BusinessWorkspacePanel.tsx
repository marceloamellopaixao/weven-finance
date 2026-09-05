"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Crown, Loader2, MailPlus, Minus, Plus, RefreshCw, Trash2, UserPlus, UsersRound } from "lucide-react";

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
import { updateWorkspace } from "@/services/workspaceService";
import {
  BUSINESS_ORGANIZATION_KINDS,
  BUSINESS_ORGANIZATION_LABELS,
  BUSINESS_TEAM_SIZE_LABELS,
  BUSINESS_TEAM_SIZES,
  normalizeBusinessOrganizationKind,
  normalizeBusinessTeamSize,
} from "@/lib/workspaces/business-profile";
import type {
  BusinessOrganizationKind,
  BusinessPermission,
  BusinessRole,
  BusinessTeamSize,
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
    <div className="grid gap-3 lg:grid-cols-2">
      {BUSINESS_PERMISSION_GROUPS.map((group) => {
        const selected = group.permissions.filter((permission) => value.includes(permission)).length;
        return (
          <div key={group.id} className="rounded-2xl bg-muted/35 p-4 ring-1 ring-border/55">
            <div className="mb-3 flex items-start justify-between gap-3">
              <span><span className="block text-sm font-semibold">{group.title}</span><span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{group.description}</span></span>
              <Badge variant="secondary" className="shrink-0">{selected}/{group.permissions.length}</Badge>
            </div>
            <div className="space-y-1.5">
              {group.permissions.map((permission) => (
                <label key={permission} className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-background/70">
                  <Checkbox disabled={disabled} checked={value.includes(permission)} onCheckedChange={() => onChange(toggleBusinessPermissionSelection(value, permission))} />
                  {BUSINESS_PERMISSION_LABELS[permission]}
                </label>
              ))}
            </div>
          </div>
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
  const [organizationKind, setOrganizationKind] = useState<BusinessOrganizationKind>("company");
  const [teamSize, setTeamSize] = useState<BusinessTeamSize>("solo");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [memberPage, setMemberPage] = useState(1);
  const [memberPages, setMemberPages] = useState(1);
  const [memberTotal, setMemberTotal] = useState(0);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  const refresh = useCallback(async () => {
    if (!workspace || !mayView) return;
    setBusy("load");
    setMessage(null);
    try {
      const result = await getBusinessWorkspace(workspace.id, { page: memberPage, limit: 10, search: memberSearchQuery });
      setMembers(result.members);
      setInvitations(result.invitations);
      setSeats(result.seats);
      setAdditionalSeats(result.seats.additional);
      setMemberPages(result.pagination.pages);
      setMemberTotal(result.pagination.total);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar a equipe.");
    } finally {
      setBusy(null);
    }
  }, [mayView, memberPage, memberSearchQuery, workspace]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!workspace) return;
    setOrganizationKind(normalizeBusinessOrganizationKind(workspace.settings?.businessOrganizationKind));
    setTeamSize(normalizeBusinessTeamSize(workspace.settings?.businessTeamSize));
  }, [workspace]);

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
      setMemberTotal((total) => total + 1);
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
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar esta pessoa.");
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
      setMemberTotal((total) => Math.max(0, total - 1));
      if (result.seats) setSeats(result.seats);
      setMessage("Funcionário removido da equipe. Os lançamentos anteriores foram preservados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível remover esta pessoa.");
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

  const saveOrganizationProfile = async () => {
    if (!workspace || workspace.membership) return;
    setBusy("organization");
    setMessage(null);
    try {
      await updateWorkspace({
        id: workspace.id,
        settings: { ...workspace.settings, businessOrganizationKind: organizationKind, businessTeamSize: teamSize },
      });
      setMessage("Perfil da organização atualizado. Novas categorias recomendadas foram adicionadas sem alterar as suas categorias personalizadas.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível atualizar o perfil da organização.");
    } finally {
      setBusy(null);
    }
  };

  if (loading || (busy === "load" && !seats)) {
    return <Card className="rounded-3xl"><CardContent className="flex min-h-56 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></CardContent></Card>;
  }
  if (!workspace) return null;

  const roleDescriptions: Record<Exclude<BusinessRole, "business_owner">, string> = {
    financial_admin: "Opera as finanças e gerencia a equipe, sem acesso à cobrança e à segurança.",
    collaborator: "Registra e acompanha apenas os próprios lançamentos.",
    accountant_viewer: "Consulta dados consolidados e exporta relatórios, sem fazer alterações.",
  };

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden rounded-3xl border-primary/20 bg-linear-to-br from-primary/15 via-card to-card shadow-lg shadow-primary/5">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary/15 blur-3xl" />
        <CardContent className="relative p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex items-start gap-4">
              <div><h2 className="text-2xl font-bold tracking-tight">Sua equipe, com acesso sob controle</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Convide pessoas, escolha responsabilidades e mantenha os dados da organização separados dos perfis pessoais.</p></div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={Boolean(busy)} className="text-muted-foreground"><RefreshCw className={`mr-2 h-4 w-4 ${busy === "load" ? "animate-spin" : ""}`} /> Atualizar</Button>
          </div>
          {seats ? (
            <div className="mt-7 grid grid-cols-2 overflow-hidden rounded-2xl border border-primary/15 bg-background/55 backdrop-blur-sm sm:grid-cols-4">
              {[["Incluídos no plano", seats.included], ["Usuários adicionais", seats.additional], ["Em uso agora", seats.occupied], ["Disponíveis", seats.available]].map(([label, value], index) => (
                <div key={label} className={`p-4 md:p-5 ${index % 2 ? "border-l" : ""} ${index > 1 ? "border-t sm:border-t-0 sm:border-l" : ""}`}><p className="text-2xl font-bold text-foreground">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {message ? <div role="status" className="rounded-2xl border border-primary/20 bg-primary/8 px-4 py-3 text-sm text-foreground">{message}</div> : null}

      {!workspace.membership ? (
        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader><CardTitle className="text-lg">Perfil da organização</CardTitle><CardDescription>Personalize categorias e linguagem sem mudar o plano ou separar os dados em outro workspace.</CardDescription></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2"><Label>Tipo de organização</Label><Select value={organizationKind} onValueChange={(value) => setOrganizationKind(value as BusinessOrganizationKind)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{BUSINESS_ORGANIZATION_KINDS.map((kind) => <SelectItem key={kind} value={kind}>{BUSINESS_ORGANIZATION_LABELS[kind]}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Tamanho da equipe</Label><Select value={teamSize} onValueChange={(value) => setTeamSize(value as BusinessTeamSize)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{BUSINESS_TEAM_SIZES.map((size) => <SelectItem key={size} value={size}>{BUSINESS_TEAM_SIZE_LABELS[size]}</SelectItem>)}</SelectContent></Select></div>
            <Button className="h-11 rounded-xl" disabled={busy === "organization" || teamSize === "100_plus"} onClick={() => void saveOrganizationProfile()}>{busy === "organization" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Salvar perfil</Button>
            {teamSize === "100_plus" ? <p className="md:col-span-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">Para mais de 100 pessoas, use o atendimento Enterprise. O Business padrão permite até 100 acessos.</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {mayView ? (
        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><UsersRound className="h-5 w-5" /></div><div><CardTitle className="text-lg">Pessoas da equipe</CardTitle><CardDescription>{memberTotal} pessoa(s) com acesso a este perfil.</CardDescription></div></div><form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); setMemberPage(1); setMemberSearchQuery(memberSearch.trim()); }}><Input aria-label="Buscar pessoa" className="h-10 w-full rounded-xl sm:w-56" value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Buscar nome ou e-mail" /><Button type="submit" variant="outline" className="rounded-xl">Buscar</Button></form></div></CardHeader>
          <CardContent className="space-y-3 pt-5">
            {members.map((member) => {
              const owner = member.role === "business_owner" || member.memberUid === workspace.uid;
              const draft = permissionDrafts[member.memberUid] || member.permissions;
              return (
                <div key={member.id} className="rounded-2xl bg-muted/25 p-4 ring-1 ring-border/55 transition-colors hover:bg-muted/40">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-sm font-bold text-primary">{(member.displayName || member.email).slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate font-semibold">{member.displayName || member.email}</p><p className="truncate text-sm text-muted-foreground">{member.email}</p></div></div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={member.status === "active" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300"}>{member.status === "active" ? "Ativo" : "Convite pendente"}</Badge>
                      {owner ? <Badge variant="secondary"><Crown className="mr-1 h-3 w-3" /> Proprietário</Badge> : (
                        <Select value={member.role} disabled={!mayEdit || busy === member.memberUid} onValueChange={(value) => void changeRole(member, value as Exclude<BusinessRole, "business_owner">)}><SelectTrigger className="w-52"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{BUSINESS_ROLE_LABELS[item]}</SelectItem>)}</SelectContent></Select>
                      )}
                      {!owner && mayEdit ? <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Remover da equipe" onClick={() => void removeMember(member)} disabled={busy === member.memberUid}><Trash2 className="h-4 w-4" /></Button> : null}
                    </div>
                  </div>
                  {!owner && mayEditPermissions ? (
                    <details className="group mt-3 border-t border-border/50 pt-3"><summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-primary">Acessos personalizados <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" /></summary><div className="mt-4 space-y-4"><PermissionMatrix value={draft} onChange={(next) => setPermissionDrafts((current) => ({ ...current, [member.memberUid]: next }))} disabled={busy === member.memberUid} /><div className="flex justify-end"><Button size="sm" disabled={!permissionDrafts[member.memberUid] || busy === member.memberUid} onClick={() => void savePermissions(member)}>Salvar acessos</Button></div></div></details>
                  ) : null}
                </div>
              );
            })}
            {members.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma pessoa vinculada.</p> : null}
            {memberPages > 1 ? <div className="flex items-center justify-between border-t border-border/60 pt-4"><Button variant="outline" size="sm" className="rounded-xl" disabled={memberPage <= 1 || busy === "load"} onClick={() => setMemberPage((page) => Math.max(1, page - 1))}>Anterior</Button><span className="text-xs text-muted-foreground">Página {memberPage} de {memberPages}</span><Button variant="outline" size="sm" className="rounded-xl" disabled={memberPage >= memberPages || busy === "load"} onClick={() => setMemberPage((page) => Math.min(memberPages, page + 1))}>Próxima</Button></div> : null}
          </CardContent>
        </Card>
      ) : null}

      {mayInvite ? (
        <Card className="rounded-3xl border-border/70 shadow-sm">
          <CardHeader className="pb-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-2.5 text-primary"><UserPlus className="h-5 w-5" /></div><div><CardTitle className="text-lg">Adicionar alguém à equipe</CardTitle><CardDescription>Se a pessoa já tiver conta, o perfil pessoal e a assinatura dela continuarão separados.</CardDescription></div></div></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 md:grid-cols-3"><div className="space-y-2"><Label>Nome</Label><Input className="h-11 rounded-xl" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nome da pessoa" /></div><div className="space-y-2"><Label>E-mail</Label><Input className="h-11 rounded-xl" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="pessoa@organizacao.com" /></div><div className="space-y-2"><Label>Papel na equipe</Label><Select value={role} onValueChange={(value) => handleRole(value as Exclude<BusinessRole, "business_owner">)}><SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{ROLE_OPTIONS.map((item) => <SelectItem key={item} value={item}>{BUSINESS_ROLE_LABELS[item]}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="rounded-2xl bg-primary/6 px-4 py-3 text-sm"><span className="font-semibold text-primary">{BUSINESS_ROLE_LABELS[role]}:</span> <span className="text-muted-foreground">{roleDescriptions[role]}</span></div>
            <details className="group rounded-2xl border border-border/60"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5"><span><span className="block text-sm font-semibold">Personalizar acessos</span><span className="block text-xs text-muted-foreground">Opcional — o papel escolhido já vem com acessos recomendados.</span></span><ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="border-t border-border/60 p-4"><PermissionMatrix value={permissions} onChange={setPermissions} /></div></details>
            <div className="flex justify-end"><Button className="h-11 rounded-xl px-6" onClick={() => void invite()} disabled={!email.trim() || Boolean(busy) || Boolean(seats && seats.available <= 0)}>{busy === "invite" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}{busy === "invite" ? "Enviando convite..." : seats && seats.available <= 0 ? "Sem acessos disponíveis" : "Enviar convite"}</Button></div>
          </CardContent>
        </Card>
      ) : null}

      {seats && !workspace.membership ? (
        <Card className="rounded-3xl border-border/70 shadow-sm"><CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold">Usuários adicionais</h3><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Seu plano inclui {seats.included}. Adicione capacidade apenas quando precisar{seats.additionalSeatPrice ? ` por R$ ${seats.additionalSeatPrice.toFixed(2).replace(".", ",")} por usuário/mês` : ""}.</p></div><div className="flex shrink-0 items-center gap-2 rounded-2xl bg-muted/40 p-2"><Button variant="ghost" size="icon" onClick={() => setAdditionalSeats((value) => Math.max(0, value - 1))}><Minus className="h-4 w-4" /></Button><span className="min-w-8 text-center text-lg font-bold">{additionalSeats}</span><Button variant="ghost" size="icon" onClick={() => setAdditionalSeats((value) => Math.min(seats.maxAdditionalSeats ?? value + 1, value + 1))}><Plus className="h-4 w-4" /></Button><Button size="sm" className="rounded-xl" onClick={() => void changeSeats()} disabled={busy === "seats" || additionalSeats === seats.additional}>{busy === "seats" ? "Salvando..." : "Atualizar"}</Button></div></CardContent></Card>
      ) : null}

      {mayInvite && invitations.some((item) => item.status === "pending") ? (
        <Card className="rounded-3xl border-amber-500/15 bg-amber-500/3"><CardHeader><CardTitle className="text-lg">Aguardando resposta</CardTitle><CardDescription>Convites expiram automaticamente após 7 dias.</CardDescription></CardHeader><CardContent className="space-y-2">{invitations.filter((item) => item.status === "pending").map((invitation) => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/60 p-3 ring-1 ring-border/50"><div><p className="font-medium">{invitation.email}</p><p className="text-xs text-muted-foreground">{BUSINESS_ROLE_LABELS[invitation.role]}</p></div><div className="flex gap-2"><Button variant="ghost" size="sm" onClick={async () => { if (!workspace) return; setBusy(invitation.id); try { await resendBusinessInvitation(workspace.id, invitation.id); setMessage("Convite reenviado."); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao reenviar."); } finally { setBusy(null); } }} disabled={busy === invitation.id}><MailPlus className="mr-2 h-4 w-4" />Reenviar</Button><Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive" onClick={async () => { if (!workspace) return; setBusy(invitation.id); try { const result = await revokeBusinessInvitation(workspace.id, invitation.id); setInvitations((current) => current.filter((item) => item.id !== invitation.id)); setMembers((current) => current.filter((item) => item.memberUid !== invitation.invitedMemberUid)); setMemberTotal((total) => Math.max(0, total - 1)); setSeats(result.seats); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cancelar."); } finally { setBusy(null); } }} disabled={busy === invitation.id}><Trash2 className="mr-2 h-4 w-4" />Cancelar</Button></div></div>)}</CardContent></Card>
      ) : null}
    </div>
  );
}
