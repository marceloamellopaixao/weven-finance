export type PiggyBankGoalType =
  | "card_limit"
  | "emergency_reserve"
  | "travel"
  | "home_renovation"
  | "dream_purchase"
  | "custom";

export interface PiggyBank {
  id: string;
  slug: string;
  name: string;
  goalType: PiggyBankGoalType;
  totalSaved: number;
  createdAt?: string;
  updatedAt?: string;
  lastDepositAt?: string;
}

export interface PiggyBankHistoryEntry {
  id: string;
  piggyBankId: string;
  amount: number;
  withdrawalMode?: string;
  yieldType?: string;
  sourceType?: "bank" | "cash";
  cardId?: string;
  cardLabel?: string;
  appliedToCardLimit?: boolean;
  createdAt?: string;
}

export interface PiggyBankDetail extends PiggyBank {
  withdrawalMode?: string;
  yieldType?: string;
  history: PiggyBankHistoryEntry[];
}
