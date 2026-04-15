export type UserPlan = 'free' | 'premium' | 'pro';
export type BuiltInUserRole = 'admin' | 'moderator' | 'support' | 'client';
export type UserRole = BuiltInUserRole | (string & {});
export type UserStatus = 'active' | 'inactive' | 'deleted' | 'blocked';
export type UserPaymentStatus = 'free' | 'paid' | 'not_paid' | 'pending' | 'overdue' | 'canceled' ;
export type BillingSource = 'manual' | 'mercadopago_webhook' | 'mercadopago_confirm' | 'mercadopago_cancel' | 'system';

export interface BillingInfo {
  source?: BillingSource;
  provider?: 'mercadopago';
  gatewayStatus?: string;
  gatewayStatusDetail?: string;
  gatewayPlan?: UserPlan;
  externalReference?: string;
  paymentId?: string;
  preapprovalId?: string;
  merchantOrderId?: string;
  lastEventType?: string;
  lastEventAction?: string;
  lastEventId?: string;
  lastEventAt?: string; // ISO Date
  lastSyncAt?: string; // ISO Date
  lastError?: string;
  pendingPreapprovalId?: string;
  pendingPlan?: UserPlan;
  pendingCheckoutAt?: string; // ISO Date
  pendingCheckoutAttemptId?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  phone: string;
  completeName: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  blockReason?: string;
  createdAt: string; // ISO Date
  transactionCount: number;
  paymentStatus?: UserPaymentStatus;
  billing?: BillingInfo;
  verifiedEmail: boolean;
  authProviders?: string[];
  needsPasswordSetup?: boolean;
  deletedAt?: string; // ISO Date
  permanentDeleteAt?: string; // ISO Date
}
