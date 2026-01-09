export type UserRole = 'admin' | 'moderator' | 'client';
export type UserPlan = 'free' | 'premium' | 'pro';
export type UserStatus = 'active' | 'inactive';

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
}