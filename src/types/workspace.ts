import type { CurrencyCode } from "@/lib/money/formatMoney";

export type WorkspaceType = "personal" | "professional" | "church" | "family" | "business";
export type FinancialProfileType = "personal" | "family" | "business";
export type WorkspaceStatus = "active" | "archived";

export type WorkspaceSettings = {
  currency?: CurrencyCode;
  monthlyReportEnabled?: boolean;
  categoriesPresetApplied?: boolean;
  familyModeEnabled?: boolean;
  businessDocument?: string;
  archivedAt?: string | null;
};

export function toFinancialProfileType(type: WorkspaceType | null | undefined): FinancialProfileType {
  if (type === "family") return "family";
  if (type === "business" || type === "professional" || type === "church") return "business";
  return "personal";
}

export function getFinancialProfileLabel(type: WorkspaceType | null | undefined) {
  const normalized = toFinancialProfileType(type);
  if (normalized === "family") return "Família";
  if (normalized === "business") return "Business/PJ";
  return "Uso pessoal";
}

export type FamilyRole = "family_manager" | "spouse_responsible" | "child_dependent" | "guest_member";

export type FamilyPermission =
  | "view_all"
  | "view_own"
  | "create_entries"
  | "edit_own_entries"
  | "edit_all_entries"
  | "view_consolidated_reports"
  | "manage_members"
  | "dashboard.view_all"
  | "dashboard.view_own"
  | "transactions.view_all"
  | "transactions.view_own"
  | "transactions.create"
  | "transactions.edit_own"
  | "transactions.edit_all"
  | "transactions.delete_own"
  | "transactions.delete_all"
  | "reports.view_consolidated"
  | "reports.export"
  | "cards.view_all"
  | "cards.view_own"
  | "cards.manage_own"
  | "cards.manage_all"
  | "piggy_banks.view_all"
  | "piggy_banks.view_own"
  | "piggy_banks.manage_own"
  | "piggy_banks.manage_all"
  | "settings.view"
  | "settings.edit_self"
  | "settings.manage_workspace"
  | "settings.manage_billing"
  | "settings.manage_security"
  | "family.view_members"
  | "family.invite_members"
  | "family.manage_members"
  | "family.manage_permissions";

export type FamilyMemberStatus = "active" | "pending" | "disabled";

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  workspaceUid: string;
  memberUid: string;
  email: string;
  displayName: string;
  role: FamilyRole;
  permissions: FamilyPermission[];
  status: FamilyMemberStatus;
  invitedByUid?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceInvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type WorkspaceInvitation = {
  id: string;
  workspaceId: string;
  workspaceUid: string;
  email: string;
  role: FamilyRole;
  permissions: FamilyPermission[];
  status: WorkspaceInvitationStatus;
  invitedByUid: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type Workspace = {
  id: string;
  uid: string;
  name: string;
  type: WorkspaceType;
  isDefault: boolean;
  status?: WorkspaceStatus;
  ownerUid?: string;
  membership?: WorkspaceMember;
  createdAt: string;
  updatedAt: string;
  settings?: WorkspaceSettings;
};

export type CreateWorkspaceInput = {
  name: string;
  type: WorkspaceType;
  isDefault?: boolean;
  settings?: WorkspaceSettings;
};

export type UpdateWorkspaceInput = {
  id: string;
  name?: string;
  type?: WorkspaceType;
  isDefault?: boolean;
  settings?: WorkspaceSettings;
};

export const WORKSPACE_TYPE_LABELS: Record<WorkspaceType, string> = {
  personal: "Pessoal",
  professional: "Business/PJ",
  church: "Business/PJ",
  family: "Família",
  business: "Business/PJ",
};
