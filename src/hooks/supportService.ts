import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, Timestamp, updateDoc, where } from "firebase/firestore";
import { db } from "@/services/firebase/client";

// --- TIPOS ---

export type SupportRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type FeatureRequestStatus = "pending" | "under_review" | "approved" | "rejected" | "implemented";

export interface SupportTicket {
  id: string;
  uid: string;
  email: string;
  name: string;
  message: string;
  type: "support" | "feature";
  status: SupportRequestStatus | FeatureRequestStatus;
  createdAt: Date | Timestamp;
  platform: string;
  assignedTo?: string; // UID do funcionário responsável
  assignedToName?: string; // Nome cacheado para facilitar
}

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

// Realtime: Buscar chamados de suporte e sugestões de funcionalidades
export const subscribeToSupportTickets = (
  userUid: string,
  userRole: string,
  onChange: (tickets: SupportTicket[]) => void,
  onError?: (error: Error) => void
) => {
  const colRef = collection(db, "support_requests");

  let q;

  if (userRole === 'admin' || userRole === 'moderator') {
    q = query(colRef, orderBy("createdAt", "desc"));
  } else {
    q = query(
      colRef,
      where("assignedTo", "==", userUid), // Somente tickets atribuídos ao usuário
      orderBy("createdAt", "desc")
    );
  }

  return onSnapshot(q, (snapshot) => {
    const tickets = snapshot.docs.map((doc) => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
      } as SupportTicket;
    });
    onChange(tickets);
  }, (error) => {
    console.error("Erro ao buscar tickets de suporte:", error);
    onError?.(error as Error);
  });
};

// Atualizar status ou responsável do chamado
export const updateTicket = async (ticketId: string, updates: Partial<SupportTicket>) => {
  try {
    const ref = doc(db, "support_requests", ticketId);
    await updateDoc(ref, updates);
  } catch (error) {
    console.error("Erro ao atualizar ticket:", error);
    throw error;
  }
}