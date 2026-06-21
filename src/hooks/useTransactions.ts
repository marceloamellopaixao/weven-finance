"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { subscribeToTransactions } from "@/services/transactionService";
import { Transaction } from "@/types/transaction";

export function useTransactions(options?: { syncRecurring?: boolean }) {
  const { user, userProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const syncRecurring = Boolean(options?.syncRecurring);

  useEffect(() => {
    // 1. Caso de Logout: Limpa os dados e retorna
    const effectiveUid = userProfile?.uid || user?.uid;
    if (!user || !effectiveUid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 2. Caso de Login: Cria a subscrição (agora como const)
    const unsubscribe = subscribeToTransactions(effectiveUid, (data) => {
      setTransactions(data);
      setLoading(false);
    }, undefined, { syncRecurring });

    // 3. Cleanup: Executa quando o componente desmonta ou user muda
    return () => unsubscribe();

  }, [syncRecurring, user, userProfile?.uid]);

  return { transactions, loading };
}
