"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/services/firebase/client";
import { PlansConfig, DEFAULT_PLANS_CONFIG } from "@/types/system";

/**
 * Hook de planos em tempo real
 * Qualquer alteração no Admin reflete automaticamente
 * em TODAS as páginas que usam usePlans()
 */
export function usePlans() {
  const [plans, setPlans] = useState<PlansConfig>(DEFAULT_PLANS_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "system", "plans");

    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setPlans(snap.data() as PlansConfig);
        } else {
          setPlans(DEFAULT_PLANS_CONFIG);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Erro realtime ao carregar planos:", error);
        setPlans(DEFAULT_PLANS_CONFIG);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return {
    plans,
    loading,
  };
}
