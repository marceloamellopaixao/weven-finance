"use client";

import { useEffect } from "react";

import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { useGetPaymentCardsQuery } from "@/store/api/cardsApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export function usePaymentCards() {
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId, loading: workspacesLoading } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const { data = [], isLoading, isFetching, refetch } = useGetPaymentCardsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "" }, { skip: !userId || !activeWorkspaceId },
  );
  useEffect(() => {
    if (!userId || !activeWorkspaceId) return;
    return subscribeToTableChanges({ table: "payment_cards", filter: `uid=eq.${userId}`, onChange: () => void refetch() });
  }, [activeWorkspaceId, refetch, userId]);
  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !activeWorkspaceId);
  return { paymentCards: data, loading: waitingForWorkspace || isLoading || (!data && isFetching), refetch };
}
