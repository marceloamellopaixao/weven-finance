import { collection, getDocs, doc, updateDoc, query, orderBy, writeBatch, deleteDoc, getCountFromServer } from "firebase/firestore";
import { getAuth, deleteUser, updateProfile } from "firebase/auth";
import { db } from "./firebase/client";
import { UserProfile, UserStatus, UserPlan, UserRole } from "@/types/user";

export const getAllUsers = async (): Promise<UserProfile[]> => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as UserProfile);
};

export const updateUserStatus = async (uid: string, status: UserStatus, reason?: string) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { 
    status,
    blockReason: reason || "" 
  });
};

export const updateUserPlan = async (uid: string, plan: UserPlan) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { plan });
};

// NOVA: Atualizar Role (Admin/Moderator/Client)
export const updateUserRole = async (uid: string, role: UserRole) => {
  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { role });
};

// NOVA: Contagem otimizada (Aggregation)
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

export const updateOwnProfile = async (uid: string, data: { displayName: string, completeName: string, phone: string }) => {
  const auth = getAuth();
  
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, {
      displayName: data.displayName
    });
  }

  const userRef = doc(db, "users", uid);
  await updateDoc(userRef, { 
    displayName: data.displayName,
    completeName: data.completeName,
    phone: data.phone
  });
};

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