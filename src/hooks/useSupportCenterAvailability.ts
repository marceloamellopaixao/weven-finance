"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getAccessTokenOrThrow } from "@/services/auth/token";

export function useSupportCenterAvailability() {
  const { user } = useAuth();
  const [availability, setAvailability] = useState<{ uid: string; enabled: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    const uid = user.uid;
    void getAccessTokenOrThrow()
      .then((token) => fetch("/api/features/support-center", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }))
      .then(async (response) => response.ok ? response.json() as Promise<{ enabled?: boolean }> : { enabled: false })
      .then((payload) => { if (!cancelled) setAvailability({ uid, enabled: payload.enabled === true }); })
      .catch(() => { if (!cancelled) setAvailability({ uid, enabled: false }); });
    return () => { cancelled = true; };
  }, [user]);

  return Boolean(user && availability?.uid === user.uid && availability.enabled);
}
