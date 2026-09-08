import type { BusinessPermission, BusinessRole, BusinessWorkspaceMember } from "@/types/workspace";

export const BUSINESS_ROLES: BusinessRole[] = [
  "business_owner",
  "financial_admin",
  "collaborator",
  "accountant_viewer",
];

export type BusinessPermissionGroup = {
  id: string;
  title: string;
  description: string;
  permissions: BusinessPermission[];
};

export const BUSINESS_PERMISSION_GROUPS: BusinessPermissionGroup[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Define se a pessoa acompanha toda a organização ou somente os próprios lançamentos.",
    permissions: ["dashboard.view_all", "dashboard.view_own"],
  },
  {
    id: "transactions",
    title: "Lançamentos",
    description: "Controla consulta, criação, edição e exclusão de receitas e despesas.",
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
    description: "Libera visão consolidada e exportações para análise ou contabilidade.",
    permissions: ["reports.view_consolidated", "reports.export"],
  },
  {
    id: "cards",
    title: "Cartões corporativos",
    description: "Controla a consulta e a gestão dos cartões vinculados à organização.",
    permissions: ["cards.view_all", "cards.view_own", "cards.manage_own", "cards.manage_all"],
  },
  {
    id: "goals",
    title: "Reservas e metas",
    description: "Controla o acesso às reservas financeiras do negócio.",
    permissions: ["piggy_banks.view_all", "piggy_banks.view_own", "piggy_banks.manage_own", "piggy_banks.manage_all"],
  },
  {
    id: "settings",
    title: "Configurações",
    description: "Separa dados pessoais, configurações da organização, cobrança e segurança.",
    permissions: [
      "settings.view",
      "settings.edit_self",
      "settings.manage_workspace",
      "settings.manage_billing",
      "settings.manage_security",
    ],
  },
  {
    id: "team",
    title: "Equipe",
    description: "Controla visualização, convites, papéis e permissões da equipe.",
    permissions: [
      "business.view_members",
      "business.invite_members",
      "business.manage_members",
      "business.manage_permissions",
    ],
  },
];

const LEGACY_BUSINESS_PERMISSIONS: BusinessPermission[] = [
  "view_all",
  "view_own",
  "create_entries",
  "edit_own_entries",
  "edit_all_entries",
  "view_consolidated_reports",
  "manage_members",
];

export const BUSINESS_PERMISSIONS: BusinessPermission[] = [
  ...LEGACY_BUSINESS_PERMISSIONS,
  ...BUSINESS_PERMISSION_GROUPS.flatMap((group) => group.permissions),
];

export const EXCLUSIVE_BUSINESS_PERMISSION_PAIRS: ReadonlyArray<readonly [BusinessPermission, BusinessPermission]> = [
  ["view_all", "view_own"],
  ["dashboard.view_all", "dashboard.view_own"],
  ["transactions.view_all", "transactions.view_own"],
  ["cards.view_all", "cards.view_own"],
  ["piggy_banks.view_all", "piggy_banks.view_own"],
];

export const BUSINESS_ROLE_LABELS: Record<BusinessRole, string> = {
  business_owner: "Proprietário",
  financial_admin: "Administrador financeiro",
  collaborator: "Colaborador",
  accountant_viewer: "Contador / somente leitura",
};

export const BUSINESS_PERMISSION_LABELS: Record<BusinessPermission, string> = {
  view_all: "Ver tudo",
  view_own: "Ver somente os próprios lançamentos",
  create_entries: "Criar lançamentos",
  edit_own_entries: "Editar lançamentos próprios",
  edit_all_entries: "Editar todos os lançamentos",
  view_consolidated_reports: "Ver relatórios consolidados",
  manage_members: "Gerenciar equipe",
  "dashboard.view_all": "Ver toda a organização",
  "dashboard.view_own": "Ver somente os próprios lançamentos",
  "transactions.view_all": "Ver todos os lançamentos",
  "transactions.view_own": "Ver somente os próprios lançamentos",
  "transactions.create": "Criar lançamentos",
  "transactions.edit_own": "Editar lançamentos próprios",
  "transactions.edit_all": "Editar todos os lançamentos",
  "transactions.delete_own": "Excluir lançamentos próprios",
  "transactions.delete_all": "Excluir todos os lançamentos",
  "reports.view_consolidated": "Ver relatórios consolidados",
  "reports.export": "Exportar PDF/Excel",
  "cards.view_all": "Ver todos os cartões",
  "cards.view_own": "Ver somente cartões vinculados a si",
  "cards.manage_own": "Gerenciar os próprios cartões",
  "cards.manage_all": "Gerenciar todos os cartões",
  "piggy_banks.view_all": "Ver todas as reservas e metas",
  "piggy_banks.view_own": "Ver somente reservas vinculadas a si",
  "piggy_banks.manage_own": "Gerenciar as próprias reservas",
  "piggy_banks.manage_all": "Gerenciar todas as reservas",
  "settings.view": "Acessar configurações",
  "settings.edit_self": "Editar somente os próprios dados",
  "settings.manage_workspace": "Editar dados do negócio",
  "settings.manage_billing": "Gerenciar plano e cobrança",
  "settings.manage_security": "Gerenciar segurança",
  "business.view_members": "Ver equipe",
  "business.invite_members": "Convidar pessoas",
  "business.manage_members": "Gerenciar equipe",
  "business.manage_permissions": "Editar papéis e permissões",
};

export const DEFAULT_BUSINESS_ROLE_PERMISSIONS: Record<BusinessRole, BusinessPermission[]> = {
  business_owner: [...BUSINESS_PERMISSIONS],
  financial_admin: [
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
    "business.view_members",
    "business.invite_members",
    "business.manage_members",
    "business.manage_permissions",
  ],
  collaborator: [
    "dashboard.view_own",
    "transactions.view_own",
    "transactions.create",
    "transactions.edit_own",
    "cards.view_own",
    "cards.manage_own",
    "piggy_banks.view_own",
    "piggy_banks.manage_own",
    "settings.view",
    "settings.edit_self",
  ],
  accountant_viewer: [
    "dashboard.view_all",
    "transactions.view_all",
    "reports.view_consolidated",
    "reports.export",
    "cards.view_all",
    "piggy_banks.view_all",
    "settings.view",
  ],
};

function removeContradictoryPermissions(permissions: BusinessPermission[]) {
  const normalized = new Set(permissions);
  EXCLUSIVE_BUSINESS_PERMISSION_PAIRS.forEach(([all, own]) => {
    if (normalized.has(all) && normalized.has(own)) normalized.delete(own);
  });
  return Array.from(normalized);
}

function expandImpliedPermissions(permissions: BusinessPermission[]) {
  const expanded = new Set(permissions);
  if (expanded.has("dashboard.view_all") || expanded.has("transactions.view_all")) expanded.add("view_all");
  if (expanded.has("dashboard.view_own") || expanded.has("transactions.view_own")) expanded.add("view_own");
  if (expanded.has("transactions.create")) expanded.add("create_entries");
  if (expanded.has("transactions.edit_own")) expanded.add("edit_own_entries");
  if (expanded.has("transactions.edit_all")) expanded.add("edit_all_entries");
  if (expanded.has("reports.view_consolidated")) expanded.add("view_consolidated_reports");
  if (expanded.has("business.manage_members") || expanded.has("business.manage_permissions")) expanded.add("manage_members");
  if (expanded.has("transactions.edit_all")) expanded.add("transactions.edit_own");
  if (expanded.has("transactions.delete_all")) expanded.add("transactions.delete_own");
  if (expanded.has("cards.manage_all")) expanded.add("cards.manage_own");
  if (expanded.has("piggy_banks.manage_all")) expanded.add("piggy_banks.manage_own");
  if (expanded.has("business.manage_members")) expanded.add("business.view_members");
  if (expanded.has("business.manage_permissions")) {
    expanded.add("business.view_members");
    expanded.add("business.manage_members");
  }
  return Array.from(expanded);
}

export function normalizeBusinessRole(value: unknown): BusinessRole {
  return BUSINESS_ROLES.includes(value as BusinessRole) ? (value as BusinessRole) : "collaborator";
}

export function normalizeBusinessPermissions(value: unknown, role: BusinessRole): BusinessPermission[] {
  const source = Array.isArray(value) ? value : DEFAULT_BUSINESS_ROLE_PERMISSIONS[role];
  const selected = source.filter((permission): permission is BusinessPermission =>
    BUSINESS_PERMISSIONS.includes(permission as BusinessPermission),
  );
  const fallback = selected.length > 0 ? selected : DEFAULT_BUSINESS_ROLE_PERMISSIONS[role];
  return removeContradictoryPermissions(expandImpliedPermissions(Array.from(new Set(fallback))));
}

export function toggleBusinessPermissionSelection(
  permissions: BusinessPermission[],
  permission: BusinessPermission,
) {
  const next = new Set(permissions);
  if (next.has(permission)) {
    next.delete(permission);
  } else {
    next.add(permission);
    const pair = EXCLUSIVE_BUSINESS_PERMISSION_PAIRS.find((items) => items.includes(permission));
    pair?.forEach((item) => {
      if (item !== permission) next.delete(item);
    });
  }
  return Array.from(next);
}

export function hasBusinessPermission(
  member: BusinessWorkspaceMember | null | undefined,
  permission: BusinessPermission,
) {
  return Boolean(member?.permissions.includes(permission));
}

export function canViewBusinessMembers(member: BusinessWorkspaceMember | null | undefined) {
  return !member || hasBusinessPermission(member, "business.view_members");
}

export function canInviteBusinessMembers(member: BusinessWorkspaceMember | null | undefined) {
  return !member || hasBusinessPermission(member, "business.invite_members");
}

export function canEditBusinessMembers(member: BusinessWorkspaceMember | null | undefined) {
  return !member || hasBusinessPermission(member, "business.manage_members");
}

export function canEditBusinessPermissions(member: BusinessWorkspaceMember | null | undefined) {
  return !member || hasBusinessPermission(member, "business.manage_permissions");
}
