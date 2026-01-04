export type UserRole = 'admin' | 'client';
export type UserPlan = 'free' | 'pro' | 'premium';
export type UserStatus = 'active' | 'inactive';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  plan: UserPlan;
  status: UserStatus;
  createdAt: string; // ISO Date
}