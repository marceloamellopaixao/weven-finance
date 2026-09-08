"use client";

import { useCallback, useMemo } from "react";
import { AccessPermissionLevel, AccessResourceKey } from "@/types/system";
import { ACCESS_LEVEL_RANK } from "@/lib/access-control/config";
import { useGetAccessControlQuery } from "@/store/api/systemApi";
import { useAuth } from "@/hooks/useAuth";

export function useAccessControl() {
  const { user, userProfile } = useAuth();
  const userId = userProfile?.uid || user?.uid;
  const { data, isLoading: loading, refetch } = useGetAccessControlQuery(
    { userId: userId || "" },
    { skip: !userId },
  );
  const access = useMemo(() => data?.access ?? {}, [data?.access]);

  const can = useCallback(
    (resource: AccessResourceKey, minimum: AccessPermissionLevel = "read") => {
      const level = access[resource] ?? "none";
      return ACCESS_LEVEL_RANK[level] >= ACCESS_LEVEL_RANK[minimum];
    },
    [access]
  );

  return { access, can, loading, refetch };
}
