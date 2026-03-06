export type PaymentCardType = "credit_card" | "debit_card" | "credit_and_debit";

export interface PaymentCard {
  id: string;
  bankName: string;
  last4: string;
  type: PaymentCardType;
  brand?: string;
  bin?: string;
  dueDate?: number;
  limitEnabled?: boolean;
  creditLimit?: number;
  alertThresholdPct?: number;
  blockOnLimitExceeded?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PaymentCardIdentification {
  brand: string | null;
  bankName: string | null;
  suggestedType: PaymentCardType | null;
}
