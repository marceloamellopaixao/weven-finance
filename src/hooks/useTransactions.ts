"use client";
import { useEffect } from "react";
import { useGetTransactionsQuery } from "@/store/api/transactionsApi";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
export function useTransactions(options?: { syncRecurring?: boolean }) {
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId, activeWorkspace, loading: workspacesLoading } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const cryptoUid = activeWorkspace?.ownerUid || activeWorkspace?.uid || userId;
  const { data, isLoading, isFetching, refetch } = useGetTransactionsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", cryptoUid: cryptoUid || "", syncRecurring: Boolean(options?.syncRecurring) },
    { skip: !userId || !activeWorkspaceId },
  );
  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    return subscribeToTableChanges({ table: "transactions", filter: `uid=eq.${cryptoUid || userId}`, onChange: () => void refetch() });
  }, [activeWorkspaceId, cryptoUid, refetch, userId]);
  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !activeWorkspaceId);
  return { transactions: data ?? [], loading: waitingForWorkspace || isLoading || (!data && isFetching) };
}
