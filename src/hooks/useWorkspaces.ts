"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useGetWorkspacesQuery } from "@/store/api/workspacesApi";
import {
  createWorkspace as createWorkspaceRequest,
  deleteWorkspace as deleteWorkspaceRequest,
  getActiveWorkspaceId,
  getActiveWorkspaceOwnerUid,
  setActiveWorkspaceId as setActiveWorkspaceIdRequest,
  setDefaultWorkspace as setDefaultWorkspaceRequest,
  subscribeToActiveWorkspaceChanged,
  subscribeToWorkspacesChanged,
  updateWorkspace as updateWorkspaceRequest,
} from "@/services/workspaceService";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "@/types/workspace";

export function useWorkspaces() {
  const { user, userProfile } = useAuth();
  const userId = userProfile?.uid || user?.uid;
  const { data: workspaces = [], isLoading: loading, error: queryError, refetch } = useGetWorkspacesQuery(
    { userId: userId || "" }, { skip: !userId },
  );
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    typeof window === "undefined" ? null : getActiveWorkspaceId(),
  );

  const activeWorkspaces = useMemo(() => workspaces.filter((workspace) => workspace.status !== "archived"), [workspaces]);
  const defaultWorkspace = activeWorkspaces.find((workspace) => workspace.isDefault) || null;
  const activeWorkspace = activeWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) || defaultWorkspace || activeWorkspaces[0] || null;

  useEffect(() => {
    if (!activeWorkspaces.length) return;
    const storedId = getActiveWorkspaceId();
    const nextId = storedId && activeWorkspaces.some((workspace) => workspace.id === storedId)
      ? storedId : defaultWorkspace?.id || activeWorkspaces[0]?.id || null;
    const target = activeWorkspaces.find((workspace) => workspace.id === nextId);
    const ownerUid = target ? target.ownerUid || target.uid : null;
    if (nextId && (nextId !== storedId || ownerUid !== getActiveWorkspaceOwnerUid())) {
      setActiveWorkspaceIdRequest(nextId, ownerUid);
    }
  }, [activeWorkspaces, defaultWorkspace?.id]);

  useEffect(() => subscribeToWorkspacesChanged(() => { if (userId) void refetch(); }), [refetch, userId]);
  useEffect(() => subscribeToActiveWorkspaceChanged(() => setActiveWorkspaceIdState(getActiveWorkspaceId())), []);

  const refresh = useCallback(async () => { if (userId) await refetch(); }, [refetch, userId]);
  const createWorkspace = useCallback(async (input: CreateWorkspaceInput) => { const result = await createWorkspaceRequest(input); await refresh(); return result; }, [refresh]);
  const updateWorkspace = useCallback(async (input: UpdateWorkspaceInput) => { const result = await updateWorkspaceRequest(input); await refresh(); return result; }, [refresh]);
  const setDefaultWorkspace = useCallback(async (id: string) => { const result = await setDefaultWorkspaceRequest(id); await refresh(); return result; }, [refresh]);
  const deleteWorkspace = useCallback(async (input: { id: string; mode: "archive" | "delete_data" }) => { await deleteWorkspaceRequest(input); await refresh(); }, [refresh]);
  const setActiveWorkspace = useCallback((id: string) => {
    const target = activeWorkspaces.find((workspace) => workspace.id === id);
    if (!target) return;
    setActiveWorkspaceIdRequest(id, target.ownerUid || target.uid);
    setActiveWorkspaceIdState(id);
  }, [activeWorkspaces]);

  return {
    workspaces, activeWorkspaces, defaultWorkspace, activeWorkspace,
    activeWorkspaceId: activeWorkspace?.id || null,
    loading, error: queryError ? "Não foi possível carregar contextos" : null,
    createWorkspace, updateWorkspace, deleteWorkspace, setDefaultWorkspace, setActiveWorkspace, refresh,
  };
}
