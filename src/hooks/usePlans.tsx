"use client";

import { useEffect, useState } from "react";
import { PlansConfig, DEFAULT_PLANS_CONFIG } from "@/types/system";
import { subscribeToPlansConfig } from "@/services/systemService";

export function usePlans() {
  const [plans, setPlans] = useState<PlansConfig>(DEFAULT_PLANS_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToPlansConfig(
      (data) => {
        setPlans(data);
        setLoading(false);
      },
      () => {
        setPlans(DEFAULT_PLANS_CONFIG);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { plans, loading };
}
