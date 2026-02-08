import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase/client";

// --- TIPOS ---

export type SupportRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type FeatureRequestStatus = "pending" | "under_review" | "approved" | "rejected" | "implemented";

// --- FUNÇÕES DE SERVIÇO ---

// Envia solicitação de suporte técnico
export const sendSupportRequest = async (uid: string, email: string, name: string, reason: string) => {
  try {
    await addDoc(collection(db, "support_requests"), {
      uid,
      email,
      name,
      message: reason,
      type: "support",
      status: "pending" as SupportRequestStatus,
      createdAt: serverTimestamp(),
      platform: "web"
    });
  } catch (error) {
    console.error("Erro ao enviar solicitação de suporte:", error);
    throw error;
  }
};

// Envia sugestão de funcionalidade/ideia para o Firestore
export const sendFeatureRequest = async (uid: string, email: string, name: string, idea: string) => {
  try {
    await addDoc(collection(db, "feature_requests"), {
      uid,
      email,
      name,
      message: idea,
      type: "feature",
      status: "pending" as FeatureRequestStatus, // Status inicial padrão
      createdAt: serverTimestamp(),
      platform: "web",
      votes: 0 // Campo futuro para votação de features
    });
  } catch (error) {
    console.error("Erro ao enviar sugestão:", error);
    throw error;
  }
};