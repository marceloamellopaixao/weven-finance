export type UserRole = 'admin' | 'moderator' | 'client';
export type UserStatus = 'active' | 'inactive';
export type UserPlan = 'free' | 'premium' | 'pro';
export type AuthProvider = 'google' | 'facebook' | 'email';
export type UserPaymentStatus = 'paid' | 'pending' | 'overdue';

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
  transactionCount?: number;
  authProvider?: AuthProvider;
  paymentStatus?: UserPaymentStatus;
}