"use client";
import { DEFAULT_FEATURE_ACCESS_CONFIG } from "@/types/system";
import { useGetAccessControlQuery } from "@/store/api/systemApi";
import { useAuth } from "./useAuth";
export function useFeatureAccess() {
  const { user, userProfile } = useAuth();
  const userId = userProfile?.uid || user?.uid;
  const { data, isLoading } = useGetAccessControlQuery({ userId: userId || "" }, { skip: !userId });
  return { featureAccess: data?.featureAccess ?? DEFAULT_FEATURE_ACCESS_CONFIG, loading: isLoading };
}
