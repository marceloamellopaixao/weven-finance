import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  deleteDoc,
  getCountFromServer,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, deleteUser, updateProfile } from "firebase/auth";
import { db } from "./firebase/client";
import {
  UserProfile,
  UserStatus,
  UserPlan,
  UserRole,
  UserPaymentStatus,
} from "@/types/user";


// Realtime: Buscar todos os usuários (Admin)
export const subscribeToAllUsers = (
  onChange: (users: UserProfile[]) => void,
  onError?: (error: Error) => void
) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const users = snapshot.docs.map((d) => d.data() as UserProfile);
      onChange(users);
    },
    (error) => {
      console.error("Erro realtime ao buscar usuários:", error);
      onError?.(error as Error);
    }
  );
};

// Realtime: Buscar um usuário específico
export const subscribeToUserProfile = (
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
) => {
  const userRef = doc(db, "users", uid);

  return onSnapshot(
    userRef,
    (snap) => {
      onChange(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      console.error(`Erro realtime user profile (${uid}):`, error);
      onError?.(error as Error);
    }
  );
};

// Buscar todos os usuários (one-shot / fallback)
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => d.data() as UserProfile);
  } catch (error) {
    console.error("Erro ao buscar usuários:", error);
    return [];
  }
};

// Atualizar status do usuário (Ativo/Bloqueado)
export const updateUserStatus = async (
  uid: string,
  status: UserStatus,
  reason?: string
) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      status,
      blockReason: reason || "",
    });
  } catch (error) {
    console.error(`Erro ao atualizar status do usuário ${uid}:`, error);
    throw error;
  }
};

// Atualizar plano do usuário (free/premium/pro)
export const updateUserPlan = async (uid: string, plan: UserPlan) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { plan });
  } catch (error) {
    console.error(`Erro ao atualizar plano do usuário ${uid}:`, error);
    throw error;
  }
};

// Atualizar Role (admin/moderator/client)
export const updateUserRole = async (uid: string, role: UserRole) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { role });
  } catch (error) {
    console.error(`Erro ao atualizar role do usuário ${uid}:`, error);
    throw error;
  }
};

// Atualizar status de pagamento do usuário (paid/pending/overdue)
export const updateUserPaymentStatus = async (
  uid: string,
  paymentStatus: UserPaymentStatus
) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { paymentStatus });
  } catch (error) {
    console.error(`Erro ao atualizar status de pagamento do usuário ${uid}:`, error);
    throw error;
  }
};

// Contagem otimizada (Aggregation)
export const getUserTransactionCount = async (uid: string): Promise<number> => {
  try {
    const transactionsRef = collection(db, "users", uid, "transactions");
    const snapshot = await getCountFromServer(transactionsRef);
    return snapshot.data().count;
  } catch (error) {
    console.error(`Erro ao contar transações para ${uid}:`, error);
    return 0;
  }
};

// Atualizar próprio perfil
export const updateOwnProfile = async (
  uid: string,
  data: { displayName: string; completeName: string; phone: string }
) => {
  const auth = getAuth();

  if (auth.currentUser) {
    try {
      await updateProfile(auth.currentUser, {
        displayName: data.displayName,
      });
    } catch (error) {
      console.error("Erro ao atualizar displayName no Auth:", error);
      throw error;
    }
  }

  const userRef = doc(db, "users", uid);
  try {
    await updateDoc(userRef, {
      displayName: data.displayName,
      completeName: data.completeName,
      phone: data.phone,
    });
  } catch (error) {
    console.error(`Erro ao atualizar perfil do usuário ${uid}:`, error);
    throw error;
  }
};

// Resetar dados financeiros do usuário
export const resetUserFinancialData = async (uid: string) => {
  const transactionsRef = collection(db, "users", uid, "transactions");
  const snapshot = await getDocs(transactionsRef);

  const batch = writeBatch(db);
  try {
    snapshot.docs.forEach((d) => {
      batch.delete(d.ref);
    });
  } catch (error) {
    console.error(`Erro ao preparar batch de reset ${uid}:`, error);
    throw error;
  }

  try {
    await batch.commit();
  } catch (error) {
    console.error(`Erro ao commitar batch de reset ${uid}:`, error);
    throw error;
  }
};

// Deletar usuário permanentemente
export const deleteUserPermanently = async (uid: string) => {
  await resetUserFinancialData(uid);

  const auth = getAuth();
  const currentUser = auth.currentUser;

  if (currentUser && currentUser.uid === uid) {
    try {
      await deleteUser(currentUser);
    } catch (error) {
      console.error("Erro ao deletar do Auth:", error);
    }
  }

  await deleteDoc(doc(db, "users", uid));
};