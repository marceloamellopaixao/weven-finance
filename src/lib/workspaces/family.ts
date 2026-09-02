import type { FamilyPermission, FamilyRole, WorkspaceMember } from "@/types/workspace";

export const FAMILY_ROLES: FamilyRole[] = [
  "family_manager",
  "spouse_responsible",
  "child_dependent",
  "guest_member",
];

export const LEGACY_FAMILY_PERMISSIONS: FamilyPermission[] = [
  "view_all",
  "view_own",
  "create_entries",
  "edit_own_entries",
  "edit_all_entries",
  "view_consolidated_reports",
  "manage_members",
];

export type FamilyPermissionGroup = {
  id: string;
  title: string;
  description: string;
  permissions: FamilyPermission[];
};

export const FAMILY_PERMISSION_GROUPS: FamilyPermissionGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Controla o que aparece nos cards, limites diários, saldo e extrato resumido.",
    permissions: ["dashboard.view_all", "dashboard.view_own"],
  },
  {
    id: "transactions",
    title: "Lançamentos",
    description: "Controla visualização, criação, edição e exclusão de receitas/despesas.",
    permissions: [
      "transactions.view_all",
      "transactions.view_own",
      "transactions.create",
      "transactions.edit_own",
      "transactions.edit_all",
      "transactions.delete_own",
      "transactions.delete_all",
    ],
  },
  {
    id: "reports",
    title: "Relatórios",
    description: "Controla acesso aos relatórios consolidados e exportações.",
    permissions: ["reports.view_consolidated", "reports.export"],
  },
  {
    id: "cards",
    title: "Cartões",
    description: "Controla acesso e gestão dos cartões da família.",
    permissions: ["cards.view_all", "cards.view_own", "cards.manage_own", "cards.manage_all"],
  },
  {
    id: "piggy_banks",
    title: "Metas / Porquinho",
    description: "Controla acesso e gestão de metas e reservas familiares.",
    permissions: ["piggy_banks.view_all", "piggy_banks.view_own", "piggy_banks.manage_own", "piggy_banks.manage_all"],
  },
  {
    id: "settings",
    title: "Configurações",
    description: "Controla ajustes de conta, perfil financeiro, segurança e plano.",
    permissions: [
      "settings.view",
      "settings.edit_self",
      "settings.manage_workspace",
      "settings.manage_billing",
      "settings.manage_security",
    ],
  },
  {
    id: "family",
    title: "Família / Membros",
    description: "Controla convites, membros e permissões familiares.",
    permissions: [
      "family.view_members",
      "family.invite_members",
      "family.manage_members",
      "family.manage_permissions",
    ],
  },
];

export const FAMILY_PERMISSIONS: FamilyPermission[] = [
  ...LEGACY_FAMILY_PERMISSIONS,
  ...FAMILY_PERMISSION_GROUPS.flatMap((group) => group.permissions),
];

export const FAMILY_ROLE_LABELS: Record<FamilyRole, string> = {
  family_manager: "Gestor da família",
  spouse_responsible: "Cônjuge/responsável",
  child_dependent: "Filho/dependente",
  guest_member: "Membro convidado",
};

export const FAMILY_PERMISSION_LABELS: Record<FamilyPermission, string> = {
  view_all: "Ver tudo",
  view_own: "Ver apenas próprios lançamentos",
  create_entries: "Criar lançamentos",
  edit_own_entries: "Editar lançamentos próprios",
  edit_all_entries: "Editar todos os lançamentos",
  view_consolidated_reports: "Ver relatórios consolidados",
  manage_members: "Gerenciar membros",
  "dashboard.view_all": "Ver tudo",
  "dashboard.view_own": "Ver somente próprios lançamentos",
  "transactions.view_all": "Ver todos os lançamentos",
  "transactions.view_own": "Ver somente próprios lançamentos",
  "transactions.create": "Criar lançamentos",
  "transactions.edit_own": "Editar próprios lançamentos",
  "transactions.edit_all": "Editar todos os lançamentos",
  "transactions.delete_own": "Excluir próprios lançamentos",
  "transactions.delete_all": "Excluir todos os lançamentos",
  "reports.view_consolidated": "Ver relatórios consolidados",
  "reports.export": "Exportar PDF/Excel",
  "cards.view_all": "Ver todos os cartões",
  "cards.view_own": "Ver somente cartões vinculados a si",
  "cards.manage_own": "Criar/editar próprios cartões",
  "cards.manage_all": "Gerenciar todos os cartões",
  "piggy_banks.view_all": "Ver todas as metas",
  "piggy_banks.view_own": "Ver somente próprias metas",
  "piggy_banks.manage_own": "Criar/editar próprias metas",
  "piggy_banks.manage_all": "Gerenciar todas as metas",
  "settings.view": "Acessar configurações",
  "settings.edit_self": "Editar somente os próprios dados",
  "settings.manage_workspace": "Editar configurações do perfil financeiro",
  "settings.manage_billing": "Gerenciar plano e cobrança",
  "settings.manage_security": "Gerenciar segurança",
  "family.view_members": "Ver membros",
  "family.invite_members": "Convidar familiares",
  "family.manage_members": "Gerenciar membros",
  "family.manage_permissions": "Editar permissões",
};

export const DEFAULT_FAMILY_ROLE_PERMISSIONS: Record<FamilyRole, FamilyPermission[]> = {
  family_manager: [
    "view_all",
    "create_entries",
    "edit_own_entries",
    "edit_all_entries",
    "view_consolidated_reports",
    "manage_members",
    "dashboard.view_all",
    "transactions.view_all",
    "transactions.create",
    "transactions.edit_own",
    "transactions.edit_all",
    "transactions.delete_own",
    "transactions.delete_all",
    "reports.view_consolidated",
    "reports.export",
    "cards.view_all",
    "cards.manage_own",
    "cards.manage_all",
    "piggy_banks.view_all",
    "piggy_banks.manage_own",
    "piggy_banks.manage_all",
    "settings.view",
    "settings.edit_self",
    "settings.manage_workspace",
    "settings.manage_billing",
    "settings.manage_security",
    "family.view_members",
    "family.invite_members",
    "family.manage_members",
    "family.manage_permissions",
  ],
  spouse_responsible: [
    "view_all",
    "create_entries",
    "edit_own_entries",
    "edit_all_entries",
    "view_consolidated_reports",
    "dashboard.view_all",
    "transactions.view_all",
    "transactions.create",
    "transactions.edit_own",
    "transactions.edit_all",
    "transactions.delete_own",
    "reports.view_consolidated",
    "reports.export",
    "cards.view_all",
    "cards.manage_own",
    "piggy_banks.view_all",
    "piggy_banks.manage_own",
    "settings.view",
    "settings.edit_self",
    "family.view_members",
  ],
  child_dependent: [
    "view_own",
    "create_entries",
    "edit_own_entries",
    "dashboard.view_own",
    "transactions.view_own",
    "transactions.create",
    "transactions.edit_own",
    "cards.view_own",
    "piggy_banks.view_own",
    "piggy_banks.manage_own",
    "settings.view",
    "settings.edit_self",
  ],
  guest_member: [
    "view_own",
    "create_entries",
    "dashboard.view_own",
    "transactions.view_own",
    "transactions.create",
    "settings.view",
    "settings.edit_self",
  ],
};

const GRANULAR_TO_LEGACY: Partial<Record<FamilyPermission, FamilyPermission[]>> = {
  "dashboard.view_all": ["view_all"],
  "dashboard.view_own": ["view_own"],
  "transactions.view_all": ["view_all"],
  "transactions.view_own": ["view_own"],
  "transactions.create": ["create_entries"],
  "transactions.edit_own": ["edit_own_entries"],
  "transactions.edit_all": ["edit_all_entries"],
  "reports.view_consolidated": ["view_consolidated_reports"],
  "family.manage_members": ["manage_members"],
  "family.manage_permissions": ["manage_members"],
};

function expandCompatiblePermissions(permissions: FamilyPermission[]) {
  const expanded = new Set(permissions);
  permissions.forEach((permission) => {
    GRANULAR_TO_LEGACY[permission]?.forEach((legacy) => expanded.add(legacy));
  });
  if (expanded.has("edit_all_entries")) expanded.add("edit_own_entries");
  if (expanded.has("transactions.edit_all")) expanded.add("transactions.edit_own");
  if (expanded.has("transactions.delete_all")) expanded.add("transactions.delete_own");
  if (expanded.has("cards.manage_all")) expanded.add("cards.manage_own");
  if (expanded.has("piggy_banks.manage_all")) expanded.add("piggy_banks.manage_own");
  if (expanded.has("family.manage_members")) expanded.add("family.view_members");
  if (expanded.has("family.manage_permissions")) {
    expanded.add("family.view_members");
    expanded.add("family.manage_members");
  }
  return Array.from(expanded);
}

export function normalizeFamilyRole(value: unknown): FamilyRole {
  return FAMILY_ROLES.includes(value as FamilyRole) ? (value as FamilyRole) : "guest_member";
}

export function normalizeFamilyPermissions(value: unknown, role: FamilyRole): FamilyPermission[] {
  const source = Array.isArray(value) ? value : DEFAULT_FAMILY_ROLE_PERMISSIONS[role];
  const permissions = source.filter((item): item is FamilyPermission => FAMILY_PERMISSIONS.includes(item as FamilyPermission));
  return expandCompatiblePermissions(Array.from(new Set(permissions.length > 0 ? permissions : DEFAULT_FAMILY_ROLE_PERMISSIONS[role])));
}

export function hasFamilyPermission(member: WorkspaceMember | null | undefined, permission: FamilyPermission) {
  return Boolean(member?.permissions.includes(permission));
}

export function canViewFamilyTransaction(member: WorkspaceMember | null | undefined, createdByUid: string) {
  if (!member) return true;
  if (hasFamilyPermission(member, "view_all")) return true;
  if (hasFamilyPermission(member, "view_own")) return member.memberUid === createdByUid;
  return false;
}

export function canCreateFamilyTransaction(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "create_entries");
}

export function canEditFamilyTransaction(member: WorkspaceMember | null | undefined, createdByUid: string) {
  if (!member) return true;
  if (hasFamilyPermission(member, "edit_all_entries")) return true;
  return hasFamilyPermission(member, "edit_own_entries") && member.memberUid === createdByUid;
}

export function canManageFamilyMembers(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "manage_members");
}

export function canViewFamilyMembers(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "family.view_members") || canManageFamilyMembers(member);
}

export function canInviteFamilyMembers(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "family.invite_members") || canManageFamilyMembers(member);
}

export function canEditFamilyMembers(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "family.manage_members") || canManageFamilyMembers(member);
}

export function canEditFamilyPermissions(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "family.manage_permissions") || canManageFamilyMembers(member);
}

export function canViewFamilyDashboardSummary(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "dashboard.view_all") || hasFamilyPermission(member, "view_all");
}

function isOwnFamilyResource(member: WorkspaceMember | null | undefined, createdByUid?: string | null) {
  return Boolean(member?.memberUid && createdByUid && member.memberUid === createdByUid);
}

export function canViewFamilyCard(member: WorkspaceMember | null | undefined, createdByUid?: string | null) {
  if (!member) return true;
  if (hasFamilyPermission(member, "cards.view_all")) return true;
  return hasFamilyPermission(member, "cards.view_own") && isOwnFamilyResource(member, createdByUid);
}

export function canManageFamilyCard(member: WorkspaceMember | null | undefined, createdByUid?: string | null) {
  if (!member) return true;
  if (hasFamilyPermission(member, "cards.manage_all")) return true;
  return hasFamilyPermission(member, "cards.manage_own") && isOwnFamilyResource(member, createdByUid);
}

export function canManageFamilyCardSettings(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "cards.manage_all");
}

export function canViewFamilyPiggyBank(member: WorkspaceMember | null | undefined, createdByUid?: string | null) {
  if (!member) return true;
  if (hasFamilyPermission(member, "piggy_banks.view_all")) return true;
  return hasFamilyPermission(member, "piggy_banks.view_own") && isOwnFamilyResource(member, createdByUid);
}

export function canManageFamilyPiggyBank(member: WorkspaceMember | null | undefined, createdByUid?: string | null) {
  if (!member) return true;
  if (hasFamilyPermission(member, "piggy_banks.manage_all")) return true;
  return hasFamilyPermission(member, "piggy_banks.manage_own") && isOwnFamilyResource(member, createdByUid);
}

export function canCreateFamilyPiggyBank(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "piggy_banks.manage_own") || hasFamilyPermission(member, "piggy_banks.manage_all");
}

export function canViewFamilySettings(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "settings.view");
}

export function canManageFamilyBilling(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "settings.manage_billing");
}

export function canManageFamilyWorkspaceSettings(member: WorkspaceMember | null | undefined) {
  return !member || hasFamilyPermission(member, "settings.manage_workspace");
}
