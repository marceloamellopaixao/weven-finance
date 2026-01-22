import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase/client";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";

const SYSTEM_DOC_REF = doc(db, "system", "plans");

/**
 * Fetch pontual (one-shot)
 * Útil para SSR, fallback ou chamadas manuais
 */
export const getPlansConfig = async (): Promise<PlansConfig> => {
  try {
    const snap = await getDoc(SYSTEM_DOC_REF);

    if (snap.exists()) {
      return snap.data() as PlansConfig;
    }

    return DEFAULT_PLANS_CONFIG;
  } catch (error) {
    console.error("Erro ao buscar os planos:", error);
    return DEFAULT_PLANS_CONFIG;
  }
};

/**
 * Atualização dos planos
 * Dispara automaticamente updates para quem estiver em realtime
 */
export const updatePlansConfig = async (config: PlansConfig) => {
  try {
    await setDoc(SYSTEM_DOC_REF, config, { merge: true });
  } catch (error) {
    console.error("Erro ao atualizar os planos:", error);
    throw error;
  }
};

/**
 * Subscription em tempo real
 * Retorna função de unsubscribe (OBRIGATÓRIO usar)
 */
export const subscribeToPlansConfig = (
  onChange: (data: PlansConfig) => void,
  onError?: (error: Error) => void
) => {
  return onSnapshot(
    SYSTEM_DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        onChange(snapshot.data() as PlansConfig);
      } else {
        onChange(DEFAULT_PLANS_CONFIG);
      }
    },
    (error) => {
      console.error("Erro realtime planos:", error);
      onError?.(error);
    }
  );
};
