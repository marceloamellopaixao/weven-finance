import { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "pending";
export type PaymentMethod = "credit_card" | "debit_card" | "pix" | "cash" | "boleto" | "transfer";

export interface Transaction {
  id?: string;
  userId: string;
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;

  // Se a transação está arquivada ou não
  isArchived?: boolean;
  
  date: string;    // Data da Competência (Quando a compra ocorreu)
  dueDate: string; // Data de Vencimento (Quando o dinheiro sai)
  createdAt: Timestamp | Date;

  // Parcelamento
  groupId?: string;
  installmentCurrent?: number;
  installmentTotal?: number;
}

// DTO (Data Transfer Object) para criação, omitindo campos gerados pelo sistema
export type CreateTransactionDTO = Omit<Transaction, "id" | "createdAt" | "userId" | "status"> & {
  isInstallment: boolean;
  installmentsCount: number;
};

export interface UserSettings {
  currentBalance: number;
}