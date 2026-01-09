import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "./firebase/client";
import { DEFAULT_PLANS_CONFIG, PlansConfig } from "@/types/system";

const SYSTEM_DOC_REF = doc(db, "system", "plans");

export const getPlansConfig = async (): Promise<PlansConfig> => {
    try {
        const snap = await getDoc(SYSTEM_DOC_REF);
        if (snap.exists()) {
            return snap.data() as PlansConfig;
        }
        // Se não existir, retorna o padrão
        return DEFAULT_PLANS_CONFIG;
    } catch (error) {
        console.error("Erro ao buscar os planos:", error);
        return DEFAULT_PLANS_CONFIG;
    }
}

export const updatePlansConfig = async (config: PlansConfig) => {
    try {
        await setDoc(SYSTEM_DOC_REF, config, { merge: true });
    } catch (error) {
        console.error("Erro ao atualizar os planos:", error);
        throw error;
    }
}