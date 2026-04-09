export type TransactionType = "income" | "expense";
export type TransactionStatus = "paid" | "pending";
export type PaymentMethod = "credit_card" | "debit_card" | "pix" | "cash" | "boleto" | "transfer";
export type InstallmentValueMode = "divide_total" | "repeat_value";

export type TransactionCreatedAt =
  | Date
  | string
  | {
      seconds: number;
      nanoseconds: number;
    };

export interface Transaction {
  id?: string;
  userId: string;
  description: string;
  amount: number;
  amountForLimit?: number;
  type: TransactionType;
  category: string;
  status: TransactionStatus;
  paymentMethod: PaymentMethod;
  cardId?: string;
  cardLabel?: string;
  cardType?: "credit_card" | "debit_card";
  isEncrypted?: boolean;
  isArchived?: boolean;
  date: string;
  dueDate: string;
  createdAt: TransactionCreatedAt;
  groupId?: string;
  isRecurring?: boolean;
  recurrenceEnded?: boolean;
  installmentCurrent?: number;
  installmentTotal?: number;
}

export type CreateTransactionDTO = Omit<Transaction, "id" | "createdAt" | "userId" | "status"> & {
  isInstallment: boolean;
  installmentsCount: number;
  installmentValueMode?: InstallmentValueMode;
};

export interface UserSettings {
  currentBalance: number;
}
