"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Star, WalletCards } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { WORKSPACE_TYPE_LABELS, type Workspace } from "@/types/workspace";

type EditingState = {
  id: string;
  name: string;
} | null;

function workspaceSubtitle(workspace: Workspace) {
  if (workspace.membership) return `Compartilhado com voce como ${workspace.membership.displayName || "membro"}`;
  return WORKSPACE_TYPE_LABELS[workspace.type];
}

export function WorkspaceSettingsPanel() {
  const {
    workspaces,
    activeWorkspaceId,
    defaultWorkspace,
    loading,
    error,
    setActiveWorkspace,
    setDefaultWorkspace,
    updateWorkspace,
  } = useWorkspaces();
  const [editing, setEditing] = useState<EditingState>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSaveName = async () => {
    if (!editing || !editing.name.trim()) return;
    setSavingId(editing.id);
    setFeedback(null);
    try {
      await updateWorkspace({ id: editing.id, name: editing.name.trim() });
      setEditing(null);
      setFeedback("Perfil atualizado.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Nao foi possivel salvar o perfil.");
    } finally {
      setSavingId(null);
    }
  };

  const handleSetDefault = async (workspace: Workspace) => {
    setSavingId(workspace.id);
    setFeedback(null);
    try {
      await setDefaultWorkspace(workspace.id);
      setFeedback("Perfil padrao atualizado.");
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Nao foi possivel definir o padrao.");
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
              Crie contextos separados para vida pessoal, igreja, trabalho, familia ou negocio.
            </CardDescription>
          </div>
          <Link href="/account-profile?create=1">
            <Button className="w-full gap-2 rounded-xl sm:w-auto">
              <Plus className="h-4 w-4" />
              Criar perfil
            </Button>
          </Link>
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
            const isEditing = editing?.id === workspace.id;
            return (
              <div key={`${workspace.ownerUid || workspace.uid}:${workspace.id}`} className={`rounded-2xl border p-4 transition-colors ${active ? "border-primary/40 bg-primary/10" : "border-color:var(--app-panel-border) bg-background/55"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-foreground">{workspace.name}</h3>
                      {active ? <Badge className="gap-1"><Check className="h-3 w-3" /> Ativo</Badge> : null}
                      {isDefault ? <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700"><Star className="h-3 w-3" /> Padrao</Badge> : null}
                    </div>
                    <p className="text-sm text-muted-foreground">{workspaceSubtitle(workspace)}</p>
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
                    <Button type="button" variant={active ? "secondary" : "outline"} className="rounded-xl" disabled={active} onClick={() => setActiveWorkspace(workspace.id)}>
                      {active ? "Em uso" : "Usar agora"}
                    </Button>
                    {editable ? (
                      <>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isEditing} onClick={() => setEditing({ id: workspace.id, name: workspace.name })}>
                          Renomear
                        </Button>
                        <Button type="button" variant="outline" className="rounded-xl" disabled={isDefault || savingId === workspace.id} onClick={() => void handleSetDefault(workspace)}>
                          {savingId === workspace.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                          Definir padrao
                        </Button>
                      </>
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
