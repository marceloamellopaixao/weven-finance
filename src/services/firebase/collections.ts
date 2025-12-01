import { collection, doc, CollectionReference, DocumentData } from "firebase/firestore";
import { db } from "./client";

// Helpers de coleção
export const usersCol = () => collection(db, "users");
export const userDoc = (uid: string) => doc(db, "users", uid);

// Tipando explicitamente o retorno para evitar erros de linter em outros lugares
export const transactionsCol = (uid: string) => 
  collection(db, "users", uid, "transactions") as CollectionReference<DocumentData>;

export const installmentsCol = (uid: string) => 
  collection(db, "users", uid, "installments") as CollectionReference<DocumentData>;

export const categoriesCol = (uid: string) => 
  collection(db, "users", uid, "categories");

export const accountsCol = (uid: string) => 
  collection(db, "users", uid, "accounts");