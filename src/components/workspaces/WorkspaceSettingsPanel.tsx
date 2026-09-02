"use client";

import { useState } from "react";
import { ArchiveRestore, Check, Loader2, Plus, Star, Trash2, WalletCards } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdminArea } from "@/lib/access-control/roles";
import { WORKSPACE_TYPE_LABELS, type Workspace } from "@/types/workspace";

type EditingState = {
  id: string;
  name: string;
} | null;

function workspaceSubtitle(workspace: Workspace) {
  if (workspace.membership) return `Compartilhado com você como ${workspace.membership.displayName || "membro"}`;
  return WORKSPACE_TYPE_LABELS[workspace.type];
}

export function WorkspaceSettingsPanel() {
  const { userProfile } = useAuth();
  const {
    workspaces,
    activeWorkspaceId,
    defaultWorkspace,
    loading,
    error,
    setActiveWorkspace,
    setDefaultWorkspace,
    updateWorkspace,
    deleteWorkspace,
  } = useWorkspaces();
  const [editing, setEditing] = useState<EditingState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const activeOwnedWorkspaces = workspaces.filter((workspace) => workspace.status !== "archived" && !workspace.membership);
  const canCreateProfiles = canAccessAdminArea(userProfile);

  const handleSaveName = async () => {
    if (!editing || !editing.name.trim()) return;
    setSavingId(editing.id);
    setFeedback(null);
    try {
      await updateWorkspace({ id: editing.id, name: editing.name.trim() });
      setEditing(null);
      setFeedback("Perfil atualizado.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Não foi possível salvar o perfil.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSetDefault = async (workspace: Workspace) => {
    setSavingId(workspace.id);
    setFeedback(null);
    try {
      await setDefaultWorkspace(workspace.id);
      setFeedback("Perfil padrão atualizado.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Não foi possível definir o padrão.");
    } finally {
      setSavingId(null);
    }
  };

  const handleRestoreWorkspace = async (workspace: Workspace) => {
    setSavingId(workspace.id);
    setFeedback(null);
    try {
      await updateWorkspace({ id: workspace.id, settings: { ...workspace.settings, archivedAt: null } });
      setFeedback("Perfil restaurado. Você já pode usar esse perfil novamente.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Não foi possível restaurar o perfil.");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteWorkspace = async (workspace: Workspace, mode: "archive" | "delete_data") => {
    const actionLabel = mode === "archive" ? "arquivar este perfil" : "excluir os dados deste perfil";
    const dataWarning = mode === "archive"
      ? "Os dados ficam guardados para uma restauração futura."
      : "Transações, cartões, categorias e metas deste perfil serão removidos. Essa ação não pode ser desfeita.";
    if (!window.confirm(`Deseja ${actionLabel}? ${dataWarning}`)) return;
    setSavingId(workspace.id);
    setFeedback(null);
    try {
      await deleteWorkspace({ id: workspace.id, mode });
      setFeedback(mode === "archive" ? "Perfil arquivado. Ele não aparece mais para uso, mas os dados continuam guardados." : "Perfil e dados removidos.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Não foi possível atualizar este perfil.");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardContent className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando perfis...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border)">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
              <WalletCards className="h-5 w-5" /> Perfis financeiros
            </CardTitle>
            <CardDescription>
              Seu perfil próprio acompanha o plano contratado. Convites compartilhados aparecem separadamente.
            </CardDescription>
          </div>
          {canCreateProfiles ? (
            <Link href="/account-profile?create=1">
              <Button className="w-full gap-2 rounded-xl sm:w-auto">
                <Plus className="h-4 w-4" />
                Criar perfil
              </Button>
            </Link>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          {feedback ? (
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary">
              {feedback}
            </div>
          ) : null}
          {workspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId;
            const isDefault = workspace.id === defaultWorkspace?.id || workspace.isDefault;
            const editable = !workspace.membership;
            const archived = workspace.status === "archived";
            const isEditing = editing?.id === workspace.id;
            return (
              <div key={`${workspace.ownerUid || workspace.uid}:${workspace.id}`} className={`rounded-2xl border p-4 transition-colors ${active ? "border-primary/40 bg-primary/10" : archived ? "border-dashed border-amber-300/60 bg-amber-500/5" : "border-color:var(--app-panel-border) bg-background/55"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">{workspace.name}</h3>
                      {archived ? <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">Arquivado</Badge> : active ? <Badge className="gap-1"><Check className="h-3 w-3" /> Ativo</Badge> : null}
                      {isDefault && !archived ? <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700"><Star className="h-3 w-3" /> Padrão</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{workspaceSubtitle(workspace)}</p>
                    {archived ? (
                      <p className="rounded-xl border border-amber-300/50 bg-amber-500/10 px-3 py-2 text-xs text-muted-foreground">
                        Este perfil está guardado. Para voltar a usar, restaure o perfil e mantenha um plano compatível.
                      </p>
                    ) : workspace.type === "family" || workspace.type === "business" ? (
                      <p className="rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground">
                        Arquivar ou excluir este perfil não troca sua cobrança automaticamente. Para mudar de plano, use a aba Planos.
                      </p>
                    ) : null}
                    {isEditing ? (
                      <div className="max-w-xl space-y-2 pt-2">
                        <Label htmlFor={`workspace-name-${workspace.id}`}>Nome do perfil</Label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Input
                            id={`workspace-name-${workspace.id}`}
                            value={editing.name}
                            onChange={(event) => setEditing({ id: workspace.id, name: event.target.value })}
                          />
                          <Button type="button" className="rounded-xl" disabled={savingId === workspace.id} onClick={handleSaveName}>
                            {savingId === workspace.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Salvar
                          </Button>
                          <Button type="button" variant="ghost" className="rounded-xl" onClick={() => setEditing(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!archived ? (
                      <Button type="button" variant={active ? "secondary" : "outline"} className="rounded-xl" disabled={active} onClick={() => setActiveWorkspace(workspace.id)}>
                        {active ? "Em uso" : "Usar agora"}
                      </Button>
                    ) : null}
                    {editable ? (
                      archived ? (
                        <Button type="button" variant="outline" className="rounded-xl" disabled={savingId === workspace.id} onClick={() => void handleRestoreWorkspace(workspace)}>
                          {savingId === workspace.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArchiveRestore className="mr-2 h-4 w-4" />}
                          Restaurar
                        </Button>
                      ) : (
                      <>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isEditing} onClick={() => setEditing({ id: workspace.id, name: workspace.name })}>
                          Renomear
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isDefault || savingId === workspace.id} onClick={() => void handleSetDefault(workspace)}>
                          {savingId === workspace.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Definir padrão
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={activeOwnedWorkspaces.length <= 1 || savingId === workspace.id} onClick={() => void handleDeleteWorkspace(workspace, "archive")}>
                          Arquivar
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" disabled={activeOwnedWorkspaces.length <= 1 || savingId === workspace.id} onClick={() => void handleDeleteWorkspace(workspace, "delete_data")}>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir dados
                        </Button>
                      </>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
