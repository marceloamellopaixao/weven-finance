"use client";
import { useGetTransactionsQuery } from "@/store/api/transactionsApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
export function useTransactions(_options?: { syncRecurring?: boolean }) {
  void _options;
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId, activeWorkspace, loading: workspacesLoading } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const cryptoUid = activeWorkspace?.ownerUid || activeWorkspace?.uid || userId;
  const { data, isLoading, isFetching, refetch } = useGetTransactionsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", ownerId: cryptoUid || "", cryptoUid: cryptoUid || "" },
    { skip: !userId || !activeWorkspaceId },
  );
  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !activeWorkspaceId);
  return { transactions: data ?? [], loading: waitingForWorkspace || isLoading || (!data && isFetching), refetch };
}
