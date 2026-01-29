import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
  getCountFromServer,
  onSnapshot,
} from "firebase/firestore";
import { getAuth, updateProfile, signOut } from "firebase/auth";
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
      const users = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          email: data.email || "",
          displayName: data.displayName || "Sem Nome",
          completeName: data.completeName || data.displayName || "",
          phone: data.phone || "",
          role: data.role || 'client',
          plan: data.plan || 'free',
          status: data.status || 'active',
          createdAt: data.createdAt || new Date().toISOString(),
          transactionCount: data.transactionCount || 0,
          paymentStatus: data.paymentStatus || 'pending',
          verifiedEmail: data.verifiedEmail || false,
          blockReason: data.blockReason || ""
        } as UserProfile;
      });
      onChange(users);
    },
    (error) => {
      console.error("Erro ao buscar usuários:", error);
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
      onChange(snap.exists() ? ({ ...(snap.data() as UserProfile), uid: snap.id }) : null);
    },
    (error) => {
      console.error(`Erro ao buscar usuário (${uid}):`, error);
      onError?.(error as Error);
    }
  );
};

// --- FUNÇÃO DE MIGRAÇÃO/CORREÇÃO DE DADOS ---
export const normalizeDatabaseUsers = async () => {
  const usersRef = collection(db, "users");
  const snapshot = await getDocs(usersRef);

  // O Firestore permite até 500 operações por batch
  const batch = writeBatch(db);
  let updateCount = 0;

  snapshot.docs.forEach((docSnap) => {
    const data = docSnap.data();
    const updates: Record<string, unknown> = {};
    let needsUpdate = false;

    // Verifica cada campo novo. Se não existir (undefined), define o padrão.
    if (data.phone === undefined) { updates.phone = ""; needsUpdate = true; }
    if (data.completeName === undefined) { updates.completeName = data.displayName || ""; needsUpdate = true; }
    if (data.transactionCount === undefined) { updates.transactionCount = 0; needsUpdate = true; }
    if (data.paymentStatus === undefined) { updates.paymentStatus = 'pending'; needsUpdate = true; }
    if (data.verifiedEmail === undefined) { updates.verifiedEmail = false; needsUpdate = true; }
    if (data.blockReason === undefined) { updates.blockReason = ""; needsUpdate = true; }

    // Garante campos antigos essenciais também
    if (data.role === undefined) { updates.role = 'client'; needsUpdate = true; }
    if (data.plan === undefined) { updates.plan = 'free'; needsUpdate = true; }
    if (data.status === undefined) { updates.status = 'active'; needsUpdate = true; }

    if (needsUpdate) {
      batch.update(docSnap.ref, updates);
      updateCount++;
    }
  });

  if (updateCount > 0) {
    await batch.commit();
  }

  return updateCount;
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

// Obter contagem de transações do usuário
export const getUserTransactionCount = async (uid: string): Promise<number> => {
  try {
    const transactionsRef = collection(db, "users", uid, "transactions");
    const snapshot = await getCountFromServer(transactionsRef);
    const total = snapshot.data().count;

    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, { transactionCount: total });

    return total;
  } catch (error) {

    console.error(`Erro ao contar transações para o usuário ${uid}:`, error);
    return 0;
  }
};

// Atualizar próprio perfil
export const updateOwnProfile = async (
  uid: string,
  data: { displayName: string; completeName: string; phone: string }
) => {
  const auth = getAuth();
  const user = auth.currentUser;

  if (user) {
    try {
      await updateProfile(user, {
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

// Resetar dados financeiros do usuário (Delete Físico)
export const resetUserFinancialData = async (uid: string) => {
  const transactionsRef = collection(db, "users", uid, "transactions");
  const snapshot = await getDocs(transactionsRef);

  const CHUNK_SIZE = 450; 
  const chunks = [];
  
  for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
    chunks.push(snapshot.docs.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

// 2. Arquivar dados financeiros (Define isArchived = true)
export const archiveUserFinancialData = async (uid: string) => {
  const transactionsRef = collection(db, "users", uid, "transactions");
  const snapshot = await getDocs(transactionsRef);

  const CHUNK_SIZE = 450;
  const chunks = [];
  for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
    chunks.push(snapshot.docs.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      // Não alteramos o status, apenas marcamos como arquivado
      batch.update(d.ref, { 
        isArchived: true
      });
    });
    await batch.commit();
  }
};

// 3. Desarquivar dados financeiros (Define isArchived = false)
export const unarchiveUserFinancialData = async (uid: string) => {
  const transactionsRef = collection(db, "users", uid, "transactions");
  const snapshot = await getDocs(transactionsRef);

  const CHUNK_SIZE = 450;
  const chunks = [];
  for (let i = 0; i < snapshot.docs.length; i += CHUNK_SIZE) {
    chunks.push(snapshot.docs.slice(i, i + CHUNK_SIZE));
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db);
    chunk.forEach((d) => {
      batch.update(d.ref, { 
        isArchived: false
      });
    });
    await batch.commit();
  }
};

// 3. Exclusão Lógica (Cliente se exclui)
export const softDeleteUser = async (uid: string): Promise<void> => {
  try {
    // Arquiva transações (esconde do painel)
    await archiveUserFinancialData(uid);

    // Marca usuário como deletado
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      status: 'deleted' as UserStatus,
      role: 'client' as UserRole,
      paymentStatus: 'canceled' as UserPaymentStatus,
      blockReason: "Usuário solicitou exclusão (Dados Arquivados)",
      deletedAt: new Date().toISOString(),
    });

    const auth = getAuth();
    if (auth.currentUser?.uid === uid) {
      await signOut(auth);
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Erro ao arquivar/deletar usuário:", error.message);
      throw error;
    }
    throw new Error("Erro desconhecido ao deletar usuário.");
  }
};

// 4. Restauração Completa (Admin restaura conta)
export const restoreUserAccount = async (uid: string): Promise<void> => {
  try {
    // Desarquiva transações (mostra no painel novamente)
    await unarchiveUserFinancialData(uid);

    // Reativa usuário
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, {
      status: 'active' as UserStatus,
      // Define como pending para que o admin verifique o pagamento depois
      paymentStatus: 'pending' as UserPaymentStatus, 
      blockReason: "", // Limpa motivo de bloqueio
      deletedAt: null
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      console.error("Erro ao restaurar usuário:", error.message);
      throw error;
    }
    throw new Error("Erro ao restaurar usuário.");
  }
};