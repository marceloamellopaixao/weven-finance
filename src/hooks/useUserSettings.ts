"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToUserSettings } from "@/services/transactionService";
import { useAuth } from "./useAuth";
import { UserSettings } from "@/types/transaction";

const DEFAULT_SETTINGS: UserSettings = { currentBalance: 0 };

export function useUserSettings() {
  const { user, userProfile } = useAuth();
  const effectiveUid = userProfile?.uid || user?.uid;

  const initialSettings = useMemo<UserSettings>(() => DEFAULT_SETTINGS, []);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);

  const [snapshotUid, setSnapshotUid] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveUid) return;

    const unsubscribe = subscribeToUserSettings(
      effectiveUid,
      (data) => {
        setSettings(data ?? DEFAULT_SETTINGS);
        setSnapshotUid(effectiveUid);
      },
      () => {
        setSettings(DEFAULT_SETTINGS);
        setSnapshotUid(effectiveUid);
      }
    );

    return () => unsubscribe();
  }, [effectiveUid]);

  const loading = Boolean(effectiveUid) && snapshotUid !== effectiveUid;
  const visibleSettings = loading ? DEFAULT_SETTINGS : settings;

  return {
    settings: visibleSettings,
    currentBalance: visibleSettings.currentBalance,
    loading,
  };
}
