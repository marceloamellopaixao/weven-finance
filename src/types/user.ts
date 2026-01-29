export type UserPlan = 'free' | 'premium' | 'pro';
export type UserRole = 'admin' | 'moderator' | 'client';
export type UserStatus = 'active' | 'inactive' | 'deleted' | 'blocked';
export type UserPaymentStatus = 'free' | 'paid' | 'not_paid' | 'pending' | 'overdue' | 'canceled' ;

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
  verifiedEmail: boolean;
  deletedAt?: string; // ISO Date
}