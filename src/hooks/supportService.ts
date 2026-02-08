import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/services/firebase/client";

export const sendSupportRequest = async (uid: string, email: string, name: string, reason: string) => {
  try {
    await addDoc(collection(db, "support_requests"), {
      uid,
      email,
      name,
      message: reason,
      status: "pending", // pending, in_progress, resolved
      createdAt: serverTimestamp(),
      platform: "web"
    });
  } catch (error) {
    console.error("Erro ao enviar solicitação de suporte:", error);
    throw error;
  }
};