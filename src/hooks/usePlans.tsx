"use client";

import { useState, useEffect, useCallback } from "react";
import { getPlansConfig } from "@/services/systemService";
import { PlansConfig, DEFAULT_PLANS_CONFIG } from "@/types/system";

export function usePlans() {
    const [plans, setPlans] = useState<PlansConfig>(DEFAULT_PLANS_CONFIG);
    const [loading, setLoading] = useState(true);

    const refreshPlans = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPlansConfig();
            setPlans(data);
        } catch (error) {
            console.error("Erro ao carregar planos:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { 
        refreshPlans();
    }, [refreshPlans]);

    return { plans, loading, refreshPlans };
}