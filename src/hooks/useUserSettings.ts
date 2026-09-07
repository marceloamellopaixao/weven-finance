"use client";

import { useMemo } from "react";
import { useGetFinanceSettingsQuery } from "@/store/api/financeApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
import { UserSettings } from "@/types/transaction";

const DEFAULT_SETTINGS: UserSettings = { currentBalance: 0 };

export function useUserSettings() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, activeWorkspaceId, loading: workspacesLoading } = useWorkspaces();
  const effectiveUid = userProfile?.uid || user?.uid;
  const ownerId = activeWorkspace?.ownerUid || activeWorkspace?.uid || effectiveUid;
  const { data, isLoading, isFetching } = useGetFinanceSettingsQuery(
    { userId: effectiveUid || "", workspaceId: activeWorkspaceId || "", ownerId: ownerId || "" },
    { skip: !effectiveUid || !activeWorkspaceId },
  );
  const visibleSettings = useMemo<UserSettings>(() => data ?? DEFAULT_SETTINGS, [data]);
  const loading = Boolean(effectiveUid) && (workspacesLoading || !activeWorkspaceId || isLoading || (!data && isFetching));

  return {
    settings: visibleSettings,
    currentBalance: visibleSettings.currentBalance,
    loading,
  };
}
