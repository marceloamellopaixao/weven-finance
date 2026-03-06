export interface CreditCardSettings {
  enabled: boolean;
  cardName: string;
  limit: number;
  alertThresholdPct: number;
  blockOnLimitExceeded: boolean;
  autoUnblockWhenBelowLimit: boolean;
  updatedAt?: string;
}

export interface CreditCardSummary {
  used: number;
  available: number;
  usagePct: number;
  isExceeded: boolean;
  pendingCount: number;
  trackedCount: number;
  untrackedCount: number;
}

export interface CreditCardState {
  settings: CreditCardSettings;
  summary: CreditCardSummary;
}
