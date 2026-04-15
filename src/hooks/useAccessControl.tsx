"use client";

import { useCallback, useEffect, useState } from "react";
import { AccessPermissionLevel, AccessResourceKey } from "@/types/system";
import { ACCESS_LEVEL_RANK } from "@/lib/access-control/config";
import { getMyAccessControl } from "@/services/systemService";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

const POLLING_INTERVAL_MS = 60000;

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

export function useAccessControl() {
  const [access, setAccess] = useState<Partial<Record<AccessResourceKey, AccessPermissionLevel>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!shouldPollNow()) return;
      try {
        const data = await getMyAccessControl();
        if (!cancelled) setAccess(data.access);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
    const stopRealtime = subscribeToTableChanges({
      table: "system_configs",
      onChange: () => void run(),
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      stopRealtime();
    };
  }, []);

  const can = useCallback(
    (resource: AccessResourceKey, minimum: AccessPermissionLevel = "read") => {
      const level = access[resource] ?? "none";
      return ACCESS_LEVEL_RANK[level] >= ACCESS_LEVEL_RANK[minimum];
    },
    [access]
  );

  return { access, can, loading };
}
