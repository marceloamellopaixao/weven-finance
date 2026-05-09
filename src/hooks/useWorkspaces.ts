"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  createWorkspace as createWorkspaceRequest,
  getUserWorkspaces,
  setDefaultWorkspace as setDefaultWorkspaceRequest,
  subscribeToWorkspacesChanged,
} from "@/services/workspaceService";
import type { CreateWorkspaceInput, Workspace } from "@/types/workspace";

export function useWorkspaces() {
  const { user, userProfile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const effectiveUid = userProfile?.uid || user?.uid;
    if (!user || !effectiveUid) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await getUserWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar contextos");
    } finally {
      setLoading(false);
    }
  }, [user, userProfile?.uid]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return subscribeToWorkspacesChanged(() => void refresh());
  }, [refresh]);

  const createWorkspace = useCallback(
    async (input: CreateWorkspaceInput) => {
      const workspace = await createWorkspaceRequest(input);
      await refresh();
      return workspace;
    },
    [refresh]
  );

  const setDefaultWorkspace = useCallback(
    async (id: string) => {
      const workspace = await setDefaultWorkspaceRequest(id);
      await refresh();
      return workspace;
    },
    [refresh]
  );

  return {
    workspaces,
    defaultWorkspace: workspaces.find((workspace) => workspace.isDefault) || null,
    loading,
    error,
    createWorkspace,
    setDefaultWorkspace,
    refresh,
  };
}
