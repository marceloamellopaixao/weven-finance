"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeToUserSettings } from "@/services/transactionService";
import { useAuth } from "./useAuth";
import { UserSettings } from "@/types/transaction";

const DEFAULT_SETTINGS: UserSettings = { currentBalance: 0 };

export function useUserSettings() {
  const { user } = useAuth();

  const initialSettings = useMemo<UserSettings>(() => DEFAULT_SETTINGS, []);
  const [settings, setSettings] = useState<UserSettings>(initialSettings);

  // controla apenas se já recebemos o primeiro snapshot para o uid atual
  const [hasFirstSnapshot, setHasFirstSnapshot] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = subscribeToUserSettings(
      user.uid,
      (data) => {
        setSettings(data ?? DEFAULT_SETTINGS);
        setHasFirstSnapshot(true);
      },
      () => {
        setSettings(DEFAULT_SETTINGS);
        setHasFirstSnapshot(true);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const loading = Boolean(user?.uid) && !hasFirstSnapshot;

  return {
    settings,
    currentBalance: settings.currentBalance,
    loading,
  };
}
