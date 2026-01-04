import { collection, getDocs, doc, updateDoc, query, orderBy, writeBatch, deleteDoc } from "firebase/firestore";
import { getAuth, deleteUser, updateProfile } from "firebase/auth";
import { db } from "./firebase/client";
import { UserProfile, UserStatus, UserPlan } from "@/types/user";

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const updateUserStatus = async (uid: string, status: UserStatus) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { status });
};

export const updateUserPlan = async (uid: string, plan: UserPlan) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { plan });
};

// --- NOVAS FUNÇÕES PARA O PRÓPRIO USUÁRIO ---

export const updateOwnProfile = async (uid: string, data: { displayName: string }) => {
  const auth = getAuth();
  
  // 1. Atualiza no Auth (Login)
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, {
      displayName: data.displayName
    });
  }

  // 2. Atualiza no Firestore (Banco)
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { 
    displayName: data.displayName 
  });
};

// --- FUNÇÕES ADMINISTRATIVAS ---

export const resetUserFinancialData = async (uid: string) => {
  const transactionsRef = collection(db, "users", uid, "transactions");
  const snapshot = await getDocs(transactionsRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });

  await batch.commit();
};

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