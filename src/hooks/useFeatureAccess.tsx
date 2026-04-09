"use client";

import { useEffect, useState } from "react";
import { DEFAULT_FEATURE_ACCESS_CONFIG, FeatureAccessConfig } from "@/types/system";
import { subscribeToFeatureAccessConfig } from "@/services/systemService";

export function useFeatureAccess() {
  const [featureAccess, setFeatureAccess] = useState<FeatureAccessConfig>(DEFAULT_FEATURE_ACCESS_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToFeatureAccessConfig(
      (data) => {
        setFeatureAccess(data);
        setLoading(false);
      },
      () => {
        setFeatureAccess(DEFAULT_FEATURE_ACCESS_CONFIG);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { featureAccess, loading };
}
