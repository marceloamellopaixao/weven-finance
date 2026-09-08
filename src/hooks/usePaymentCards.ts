"use client";

import { useGetPaymentCardsQuery } from "@/store/api/cardsApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export function usePaymentCards() {
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId, activeWorkspace, loading: workspacesLoading } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const ownerId = activeWorkspace?.ownerUid || activeWorkspace?.uid || userId;
  const { data = [], isLoading, isFetching, refetch } = useGetPaymentCardsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", ownerId: ownerId || "" }, { skip: !userId || !activeWorkspaceId },
  );
  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !activeWorkspaceId);
  return { paymentCards: data, loading: waitingForWorkspace || isLoading || (!data && isFetching), refetch };
}
