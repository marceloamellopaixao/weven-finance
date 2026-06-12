import type { UserProfile, UserRole } from "@/types/user";

export const CREATOR_SUPREME_UID = "Z3ciyXudWuZZywhojA6iWJTurH52";

const ADMIN_AREA_ROLES = new Set<UserRole>(["admin", "moderator", "support"]);

type AccessIdentity = Pick<UserProfile, "uid" | "role"> | null | undefined;

export function isCreatorSupremeUid(uid: string | null | undefined) {
  return String(uid || "").trim() === CREATOR_SUPREME_UID;
}

export function canAccessAdminArea(identity: AccessIdentity) {
  if (!identity) return false;
  return isCreatorSupremeUid(identity.uid) || ADMIN_AREA_ROLES.has(identity.role);
}
