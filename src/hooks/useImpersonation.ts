"use client";

import { useEffect, useState } from "react";
import {
  clearImpersonationTargetUid,
  getImpersonationTargetUid,
  setImpersonationTargetUid,
  subscribeToImpersonationChange,
} from "@/lib/impersonation/client";

export function useImpersonation() {
  const [targetUid, setTargetUid] = useState<string | null>(() => getImpersonationTargetUid());

  useEffect(() => {
    return subscribeToImpersonationChange((next) => {
      setTargetUid(next);
    });
  }, []);

  return {
    impersonationTargetUid: targetUid,
    isImpersonating: !!targetUid,
    startImpersonation: (uid: string) => setImpersonationTargetUid(uid),
    stopImpersonation: () => clearImpersonationTargetUid(),
  };
}
