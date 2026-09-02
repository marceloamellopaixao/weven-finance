"use client";

import { BriefcaseBusiness, Check, ChevronsUpDown, Home, Plus, UserRound, UsersRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useAuth } from "@/hooks/useAuth";
import { canAccessAdminArea } from "@/lib/access-control/roles";
import { canViewFamilyMembers } from "@/lib/workspaces/family";
import type { Workspace, WorkspaceType } from "@/types/workspace";

const WORKSPACE_ICONS: Record<WorkspaceType, typeof WalletCards> = {
  personal: WalletCards,
  professional: BriefcaseBusiness,
  church: BriefcaseBusiness,
  family: Home,
  business: BriefcaseBusiness,
};

const WORKSPACE_TONE: Record<WorkspaceType, string> = {
  personal: "bg-emerald-500/12 text-emerald-700 ring-emerald-500/20",
  professional: "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20",
  church: "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20",
  family: "bg-amber-500/12 text-amber-700 ring-amber-500/20",
  business: "bg-fuchsia-500/12 text-fuchsia-700 ring-fuchsia-500/20",
};

const WORKSPACE_KIND_LABEL: Record<WorkspaceType, string> = {
  personal: "Pessoal",
  professional: "Business/PJ",
  church: "Business/PJ",
  family: "Família",
  business: "Business/PJ",
};

function getInitials(workspace: Workspace) {
  const words = workspace.name.trim().split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]).join("");
  return (initials || "WF").toUpperCase();
}

function WorkspaceAvatar({ workspace, active, compact }: { workspace: Workspace; active?: boolean; compact?: boolean }) {
  const Icon = WORKSPACE_ICONS[workspace.type] || WalletCards;
  return (
    <div className={`relative flex shrink-0 items-center justify-center ring-1 ${compact ? "h-6 w-6 rounded-full" : "h-12 w-12 rounded-2xl"} ${WORKSPACE_TONE[workspace.type]}`}>
      {workspace.type === "family" ? <UsersRound className={compact ? "h-3 w-3" : "h-4 w-4"} /> : <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />}
      {active ? (
        <span className={`absolute flex items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background ${compact ? "-right-0.5 -bottom-0.5 h-4 w-4" : "-right-1 -bottom-1 h-5 w-5"}`}>
          <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
        </span>
      ) : null}
    </div>
  );
}

export function WorkspaceProfileSwitcher() {
  const { userProfile } = useAuth();
  const { workspaces, activeWorkspaces, activeWorkspace, activeWorkspaceId, loading, setActiveWorkspace } = useWorkspaces();
  const [open, setOpen] = useState(false);
  const canOpenFamilySettings = workspaces.some((workspace) => {
    if (workspace.type !== "family" && !workspace.settings?.familyModeEnabled && !workspace.membership) return false;
    return !workspace.membership || canViewFamilyMembers(workspace.membership);
  });
  const canCreateProfiles = canAccessAdminArea(userProfile);

  if (loading || activeWorkspaces.length === 0 || !activeWorkspace) return null;

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          id="tour-workspace-switcher"
          type="button"
          variant="outline"
          className="flex h-10 w-10 max-w-[42vw] shrink-0 items-center gap-2 rounded-full border-color:var(--app-panel-border) bg-card/60 p-1 text-left shadow-sm sm:w-auto sm:px-2 sm:pr-3 md:max-w-[260px]"
        >
          <WorkspaceAvatar workspace={activeWorkspace} active compact />
          <span className="hidden min-w-0 sm:block">
            <span className="block truncate text-xs font-semibold leading-tight text-foreground">{activeWorkspace.name}</span>
            <span className="block truncate text-[10px] leading-tight text-muted-foreground">
              Trocar perfil
            </span>
          </span>
          <ChevronsUpDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" sideOffset={10} className="app-panel-soft max-h-[calc(100svh-5rem)] w-[calc(100vw-1rem)] max-w-80 overflow-y-auto rounded-2xl border-color:var(--app-panel-border) p-2 shadow-xl shadow-primary/10 sm:w-[min(92vw,520px)] sm:max-w-[520px] sm:p-3">
        <DropdownMenuLabel className="flex items-center justify-between gap-3 px-2 pb-2 sm:px-1">
          <span className="text-sm font-semibold">Trocar perfil</span>
          <Badge variant="outline" className="gap-1 border-primary/25 bg-primary/10 text-primary">
            <UserRound className="h-3 w-3" /> Perfis
          </Badge>
        </DropdownMenuLabel>

        <div className="space-y-1 sm:hidden">
          {activeWorkspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId;
            return (
              <button
                key={`${workspace.ownerUid || workspace.uid}:${workspace.id}:mobile`}
                type="button"
                onClick={() => {
                  setActiveWorkspace(workspace.id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  active
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-transparent bg-transparent hover:bg-accent/70"
                }`}
              >
                <WorkspaceAvatar workspace={workspace} active={active} compact />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold leading-tight">{workspace.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {workspace.membership ? workspace.membership.displayName || "Convidado" : WORKSPACE_KIND_LABEL[workspace.type]}
                  </span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            );
          })}
        </div>

        <div className="hidden grid-cols-2 gap-2 sm:grid sm:grid-cols-3">
          {activeWorkspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId;
            return (
              <button
                key={`${workspace.ownerUid || workspace.uid}:${workspace.id}`}
                type="button"
                onClick={() => {
                  setActiveWorkspace(workspace.id);
                  setOpen(false);
                }}
                className={`group min-h-[132px] rounded-2xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                  active
                    ? "border-primary/45 bg-primary/10 shadow-md shadow-primary/10"
                    : "border-border/75 bg-background/65 hover:border-primary/30 hover:bg-accent/60"
                }`}
              >
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="relative">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-[24px] text-lg font-bold ring-1 ${WORKSPACE_TONE[workspace.type]}`}>
                      {workspace.type === "family" ? <UsersRound className="h-7 w-7" /> : getInitials(workspace)}
                    </div>
                    {active ? (
                      <span className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{workspace.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {workspace.membership ? workspace.membership.displayName || "Convidado" : WORKSPACE_KIND_LABEL[workspace.type]}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <DropdownMenuSeparator className="my-3" />
        {canCreateProfiles ? (
          <Link href="/account-profile?create=1" className="block">
            <Button variant="ghost" className="h-10 w-full justify-start rounded-xl text-sm">
              <Plus className="mr-2 h-4 w-4" />
              Criar novo perfil
            </Button>
          </Link>
        ) : null}
        {canOpenFamilySettings ? (
          <Link href="/settings?tab=family" className="block">
            <Button variant="ghost" className="h-10 w-full justify-start rounded-xl text-sm">
              <UsersRound className="mr-2 h-4 w-4" />
              Gerenciar perfis da família
            </Button>
          </Link>
        ) : null}
        <Link href="/settings?tab=profiles" className="block">
          <Button variant="ghost" className="h-10 w-full justify-start rounded-xl text-sm">
            <WalletCards className="mr-2 h-4 w-4" />
            Configurações de perfil
          </Button>
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
