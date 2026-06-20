"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import {
  createWorkspace as createWorkspaceRequest,
  getActiveWorkspaceId,
  getUserWorkspaces,
  setDefaultWorkspace as setDefaultWorkspaceRequest,
  setActiveWorkspaceId as setActiveWorkspaceIdRequest,
  subscribeToActiveWorkspaceChanged,
  subscribeToWorkspacesChanged,
  updateWorkspace as updateWorkspaceRequest,
} from "@/services/workspaceService";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@/types/workspace";

export function useWorkspaces() {
  const { user, userProfile } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getActiveWorkspaceId()
  );

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
      const storedActiveId = getActiveWorkspaceId();
      const nextActiveId = storedActiveId && data.some((workspace) => workspace.id === storedActiveId)
        ? storedActiveId
        : data.find((workspace) => workspace.isDefault)?.id || data[0]?.id || null;
      setActiveWorkspaceIdState(nextActiveId);
      if (nextActiveId && nextActiveId !== storedActiveId) {
        setActiveWorkspaceIdRequest(nextActiveId);
      }
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    return subscribeToActiveWorkspaceChanged(() => {
      setActiveWorkspaceIdState(getActiveWorkspaceId());
    });
  }, []);

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

  const setActiveWorkspace = useCallback((id: string) => {
    setActiveWorkspaceIdRequest(id);
    setActiveWorkspaceIdState(id);
  }, []);

  const updateWorkspace = useCallback(
    async (input: UpdateWorkspaceInput) => {
      const workspace = await updateWorkspaceRequest(input);
      await refresh();
      return workspace;
    },
    [refresh]
  );

  const defaultWorkspace = workspaces.find((workspace) => workspace.isDefault) || null;
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ||
    defaultWorkspace ||
    workspaces[0] ||
    null;

  return {
    workspaces,
    defaultWorkspace,
    activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || null,
    loading,
    error,
    createWorkspace,
    updateWorkspace,
    setDefaultWorkspace,
    setActiveWorkspace,
    refresh,
  };
}
