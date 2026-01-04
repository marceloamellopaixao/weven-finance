import { collection, doc, CollectionReference, DocumentData } from "firebase/firestore";
import { db } from "@/services/firebase/client";

// Helpers de coleção
export const usersCol = () => collection(db, "users") as CollectionReference<DocumentData>;
export const userDoc = (uid: string) => doc(db, "users", uid);

// Subcoleções (mantidas)
export const transactionsCol = (uid: string) => 
  collection(db, "users", uid, "transactions") as CollectionReference<DocumentData>;

export const installmentsCol = (uid: string) => 
  collection(db, "users", uid, "installments") as CollectionReference<DocumentData>;

export const categoriesCol = (uid: string) => 
  collection(db, "users", uid, "categories");

export const accountsCol = (uid: string) => 
  collection(db, "users", uid, "accounts");