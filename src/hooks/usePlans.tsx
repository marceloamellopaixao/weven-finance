"use client";
import { DEFAULT_PLANS_CONFIG } from "@/types/system";
import { useGetPlansQuery } from "@/store/api/systemApi";
import { useAuth } from "./useAuth";
export function usePlans() {
  const { user, userProfile } = useAuth();
  const userId = userProfile?.uid || user?.uid;
  const { data, isLoading } = useGetPlansQuery({ userId: userId || "" }, { skip: !userId });
  return { plans: data ?? DEFAULT_PLANS_CONFIG, loading: isLoading };
}
