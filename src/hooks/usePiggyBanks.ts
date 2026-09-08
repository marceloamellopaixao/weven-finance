"use client";

import { useGetPiggyBanksQuery } from "@/store/api/piggyBanksApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export function usePiggyBanks() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, activeWorkspaceId, loading: workspacesLoading } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const ownerId = activeWorkspace?.ownerUid || activeWorkspace?.uid || userId;
  const { data = [], isLoading, isFetching, isError, refetch } = useGetPiggyBanksQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", ownerId: ownerId || "" },
    { skip: !userId || !activeWorkspaceId },
  );
  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !activeWorkspaceId);

  return {
    piggyBanks: data,
    loading: waitingForWorkspace || isLoading || (!data && isFetching),
    error: isError,
    refetch,
  };
}
