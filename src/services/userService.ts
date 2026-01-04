import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
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