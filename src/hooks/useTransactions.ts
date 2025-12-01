"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { subscribeToTransactions } from "@/services/transactionService";
import { Transaction } from "@/types/transaction";

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Caso de Logout: Limpa os dados e retorna
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 2. Caso de Login: Cria a subscrição (agora como const)
    const unsubscribe = subscribeToTransactions(user.uid, (data) => {
      setTransactions(data);
      setLoading(false);
    });

    // 3. Cleanup: Executa quando o componente desmonta ou user muda
    return () => unsubscribe();

  }, [user]);

  return { transactions, loading };
}