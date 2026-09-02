"use client";
import { useEffect } from "react";
import { useGetTransactionsQuery } from "@/store/api/transactionsApi";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
export function useTransactions(options?: { syncRecurring?: boolean }) {
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const { data, isLoading, isFetching, refetch } = useGetTransactionsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", syncRecurring: Boolean(options?.syncRecurring) },
    { skip: !userId || !activeWorkspaceId },
  );
  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    return subscribeToTableChanges({ table: "transactions", filter: `uid=eq.${userId}`, onChange: () => void refetch() });
  }, [activeWorkspaceId, refetch, userId]);
  return { transactions: data ?? [], loading: isLoading || (!data && isFetching) };
}
