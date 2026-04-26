import {
  AccessControlConfig,
  AccessControlRule,
  AccessPermissionLevel,
  AccessResourceKey,
  AccessRoleDefinition,
  AccessSubjectType,
  DEFAULT_ACCESS_CONTROL_CONFIG,
  FeatureAccessConfig,
  ManagedFeatureKey,
} from "@/types/system";
import { UserPlan } from "@/types/user";

export const ACCESS_LEVEL_RANK: Record<AccessPermissionLevel, number> = {
  none: 0,
  read: 1,
  write: 2,
  full: 3,
};

export const ACCESS_RESOURCE_KEYS: AccessResourceKey[] = [
  "dashboard.read",
  "dashboard.monthly_forecast",
  "dashboard.smart_daily_limit",
  "dashboard.privacy_toggle",
  "transactions.read",
  "transactions.create",
  "transactions.edit",
  "transactions.delete",
  "transactions.installments",
  "transactions.recurring",
  "transactions.categories",
  "transactions.bulk_actions",
  "cards.read",
  "cards.write",
  "cards.delete",
  "cards.identify_bank",
  "cards.limit_rules",
  "piggy_bank.read",
  "piggy_bank.write",
  "piggy_bank.delete",
  "piggy_bank.card_limit",
  "piggy_bank.history",
  "settings.read",
  "settings.write",
  "settings.appearance",
  "settings.navigation",
  "settings.security",
  "settings.account_delete",
  "billing.read",
  "billing.manage",
  "billing.checkout",
  "billing.cancel",
  "billing.exempt",
  "apps.read",
  "apps.quick_bar",
  "apps.guided_tour",
  "notifications.read",
  "notifications.write",
  "onboarding.read",
  "onboarding.write",
  "support.read",
  "support.write",
  "support.delete",
  "admin.users.read",
  "admin.users.write",
  "admin.users.delete",
  "admin.support.read",
  "admin.support.write",
  "admin.support.delete",
  "admin.restore.read",
  "admin.restore.write",
  "admin.restore.delete",
  "admin.plans.read",
  "admin.plans.write",
  "admin.metrics.read",
  "admin.audit.read",
  "admin.export",
  "admin.impersonation",
  "admin.health",
  "admin.billing_jobs",
  "admin.retention_jobs",
  "admin.permissions.read",
  "admin.permissions.write",
  "admin.permissions.delete",
];

export type AccessResourceDefinition = {
  key: AccessResourceKey;
  label: string;
  description: string;
};

export type AccessScreenDefinition = {
  id: string;
  label: string;
  route: string;
  description: string;
  resources: AccessResourceDefinition[];
};

export const ACCESS_SCREENS: AccessScreenDefinition[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
    description: "Visão geral, indicadores e direção financeira do mês.",
    resources: [
      { key: "dashboard.read", label: "Visualizar dashboard", description: "Permite abrir o painel principal." },
      { key: "dashboard.monthly_forecast", label: "Previsão de fechamento", description: "Mostra a projeção de fechamento do mês." },
      { key: "dashboard.smart_daily_limit", label: "Limite diário inteligente", description: "Mostra o quanto ainda pode gastar por dia." },
      { key: "dashboard.privacy_toggle", label: "Ocultar valores", description: "Permite usar o modo de privacidade dos valores." },
    ],
  },
  {
    id: "transactions",
    label: "Transações",
    route: "/transactions/new e /transactions/[id]/edit",
    description: "Criação, edição, categorias, recorrências e compras parceladas.",
    resources: [
      { key: "transactions.read", label: "Visualizar transações", description: "Permite ver extrato e detalhes." },
      { key: "transactions.create", label: "Criar transações", description: "Permite adicionar receitas e despesas." },
      { key: "transactions.edit", label: "Editar transações", description: "Permite alterar lançamentos existentes." },
      { key: "transactions.delete", label: "Excluir transações", description: "Permite remover lançamentos." },
      { key: "transactions.installments", label: "Compra parcelada", description: "Permite criar e editar parcelamentos." },
      { key: "transactions.recurring", label: "Lançamento fixo", description: "Permite criar e encerrar recorrências." },
      { key: "transactions.categories", label: "Gerenciar categorias", description: "Permite criar, editar e remover categorias." },
      { key: "transactions.bulk_actions", label: "Ações em massa", description: "Permite ações em vários lançamentos ao mesmo tempo." },
    ],
  },
  {
    id: "cards",
    label: "Cartões",
    route: "/cards",
    description: "Cartões, banco, limite, alerta e regras de fatura.",
    resources: [
      { key: "cards.read", label: "Visualizar cartões", description: "Permite abrir a tela de cartões." },
      { key: "cards.write", label: "Criar e editar cartões", description: "Permite cadastrar ou alterar cartões." },
      { key: "cards.delete", label: "Excluir cartões", description: "Permite remover cartões." },
      { key: "cards.identify_bank", label: "Identificar banco por BIN", description: "Permite buscar banco e visual do cartão pelo BIN." },
      { key: "cards.limit_rules", label: "Limites e alertas", description: "Permite alterar limite, alerta e bloqueios do cartão." },
    ],
  },
  {
    id: "piggy_bank",
    label: "Metas e reservas",
    route: "/piggy-bank",
    description: "Metas, aportes, resgates, histórico e vínculo com cartão.",
    resources: [
      { key: "piggy_bank.read", label: "Visualizar metas", description: "Permite abrir metas e reservas." },
      { key: "piggy_bank.write", label: "Criar e editar metas", description: "Permite criar metas, aportar e resgatar." },
      { key: "piggy_bank.delete", label: "Excluir metas", description: "Permite remover metas." },
      { key: "piggy_bank.card_limit", label: "Meta vinculada ao cartão", description: "Permite usar meta para aumento de limite." },
      { key: "piggy_bank.history", label: "Histórico da meta", description: "Permite consultar movimentações da meta." },
    ],
  },
  {
    id: "settings",
    label: "Configurações",
    route: "/settings",
    description: "Conta, aparência, navegação, segurança e exclusão de conta.",
    resources: [
      { key: "settings.read", label: "Visualizar configurações", description: "Permite abrir a página de configurações." },
      { key: "settings.write", label: "Editar perfil", description: "Permite alterar dados da conta." },
      { key: "settings.appearance", label: "Tema e cor", description: "Permite alterar tema e cor principal." },
      { key: "settings.navigation", label: "Navegação e barra rápida", description: "Permite alterar atalhos e comportamento da barra." },
      { key: "settings.security", label: "Senha e segurança", description: "Permite solicitar troca de senha e ações de segurança." },
      { key: "settings.account_delete", label: "Excluir conta", description: "Permite solicitar exclusão da própria conta." },
    ],
  },
  {
    id: "billing",
    label: "Assinatura",
    route: "/billing e planos",
    description: "Plano, checkout, cancelamento e histórico de cobrança.",
    resources: [
      { key: "billing.read", label: "Visualizar assinatura", description: "Permite ver plano e histórico." },
      { key: "billing.manage", label: "Gerenciar assinatura", description: "Permite ações gerais de assinatura." },
      { key: "billing.checkout", label: "Contratar plano", description: "Permite iniciar checkout de upgrade." },
      { key: "billing.cancel", label: "Cancelar assinatura", description: "Permite cancelar assinatura ativa." },
      { key: "billing.exempt", label: "Cobrança do plano", description: "Define se este cargo ou usuário segue a cobrança padrão ou não deve ser cobrado." },
    ],
  },
  {
    id: "apps",
    label: "Apps e guia",
    route: "/apps",
    description: "Barra rápida, atalhos, tour guiado e onboarding.",
    resources: [
      { key: "apps.read", label: "Visualizar apps", description: "Permite abrir a central de apps." },
      { key: "apps.quick_bar", label: "Configurar barra rápida", description: "Permite alterar atalhos, posição, cor e estilo." },
      { key: "apps.guided_tour", label: "Tour guiado", description: "Permite iniciar ou repetir guias da plataforma." },
      { key: "onboarding.read", label: "Ver onboarding", description: "Permite consultar estado de onboarding." },
      { key: "onboarding.write", label: "Concluir onboarding", description: "Permite salvar etapas concluídas." },
    ],
  },
  {
    id: "support",
    label: "Suporte",
    route: "/settings e /contact",
    description: "Chamados, ideias, contato e acompanhamento.",
    resources: [
      { key: "support.read", label: "Visualizar suporte", description: "Permite ver chamados e canais de contato." },
      { key: "support.write", label: "Abrir chamado", description: "Permite enviar suporte ou ideia." },
      { key: "support.delete", label: "Excluir chamado", description: "Permite remover chamados quando autorizado." },
    ],
  },
  {
    id: "notifications",
    label: "Notificações",
    route: "Header e alertas",
    description: "Central de notificações e alertas do usuário.",
    resources: [
      { key: "notifications.read", label: "Visualizar notificações", description: "Permite listar notificações." },
      { key: "notifications.write", label: "Atualizar notificações", description: "Permite marcar como lidas ou apagar alertas." },
    ],
  },
  {
    id: "admin",
    label: "Administração",
    route: "/admin",
    description: "Usuários, suporte, restauração, métricas, auditoria e permissões.",
    resources: [
      { key: "admin.users.read", label: "Usuários · visualizar", description: "Permite ver base de usuários." },
      { key: "admin.users.write", label: "Usuários · editar", description: "Permite alterar plano, status, cargo e pagamento." },
      { key: "admin.users.delete", label: "Usuários · excluir", description: "Permite arquivar, resetar ou excluir usuários quando autorizado." },
      { key: "admin.support.read", label: "Suporte · visualizar", description: "Permite ver chamados e ideias." },
      { key: "admin.support.write", label: "Suporte · editar", description: "Permite alterar status, prioridade e responsável." },
      { key: "admin.support.delete", label: "Suporte · excluir", description: "Permite remover chamados quando autorizado." },
      { key: "admin.restore.read", label: "Restauração · visualizar", description: "Permite ver contas excluídas e arquivadas." },
      { key: "admin.restore.write", label: "Restauração · restaurar", description: "Permite restaurar conta com ou sem dados." },
      { key: "admin.restore.delete", label: "Restauração · excluir permanente", description: "Permite exclusão permanente quando autorizado." },
      { key: "admin.plans.read", label: "Planos · visualizar", description: "Permite ver configuração de planos." },
      { key: "admin.plans.write", label: "Planos · editar", description: "Permite alterar planos e links de cobrança." },
      { key: "admin.metrics.read", label: "Métricas", description: "Permite ver métricas operacionais." },
      { key: "admin.audit.read", label: "Auditoria", description: "Permite consultar logs administrativos." },
      { key: "admin.export", label: "Exportações", description: "Permite exportar CSVs administrativos." },
      { key: "admin.impersonation", label: "Impersonação", description: "Permite solicitar acesso assistido à conta do cliente." },
      { key: "admin.health", label: "Health checks e jobs", description: "Permite acompanhar saúde e rotinas operacionais." },
      { key: "admin.billing_jobs", label: "Jobs de cobrança", description: "Permite rodar conciliação manual de cobrança." },
      { key: "admin.retention_jobs", label: "Jobs de retenção", description: "Permite rodar rotinas de retenção e limpeza definitiva." },
      { key: "admin.permissions.read", label: "Permissões · visualizar", description: "Permite ver matriz de permissões." },
      { key: "admin.permissions.write", label: "Permissões · editar", description: "Permite alterar cargos e acessos." },
      { key: "admin.permissions.delete", label: "Permissões · excluir", description: "Permite remover regras e cargos customizados." },
    ],
  },
];

export const ACCESS_RESOURCE_DEFINITIONS = ACCESS_SCREENS.flatMap((screen) =>
  screen.resources.map((resource) => ({ ...resource, screenId: screen.id, screenLabel: screen.label }))
);

export const ACCESS_RESOURCE_LABEL_BY_KEY = ACCESS_RESOURCE_DEFINITIONS.reduce((acc, resource) => {
  acc[resource.key] = resource.label;
  return acc;
}, {} as Record<AccessResourceKey, string>);

const ACCESS_RESOURCE_SET = new Set<string>(ACCESS_RESOURCE_KEYS);
const ACCESS_LEVEL_SET = new Set<string>(["none", "read", "write", "full"]);
const ACCESS_SUBJECT_SET = new Set<string>(["global", "plan", "role", "user"]);

type AccessContext = {
  uid?: string | null;
  plan: UserPlan;
  role: string;
};

function sanitizeKey(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]/g, "");
}

function sanitizeLabel(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 120) : "";
}

function isValidDate(value: string | null | undefined) {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
}

function isRuleActiveNow(rule: Pick<AccessControlRule, "active" | "startsAt" | "endsAt">, now = new Date()) {
  if (!rule.active) return false;
  const nowMs = now.getTime();
  if (isValidDate(rule.startsAt) && new Date(rule.startsAt as string).getTime() > nowMs) return false;
  if (isValidDate(rule.endsAt) && new Date(rule.endsAt as string).getTime() < nowMs) return false;
  return true;
}

function normalizeRoleDefinition(entry: unknown): AccessRoleDefinition | null {
  if (!entry || typeof entry !== "object") return null;
  const role = entry as Record<string, unknown>;
  const key = sanitizeKey(role.key);
  if (!key) return null;

  return {
    id: String(role.id || `role-${key}`).trim(),
    key,
    name: sanitizeLabel(role.name) || key,
    description: sanitizeLabel(role.description),
    active: role.active !== false,
    system: Boolean(role.system),
  };
}

function normalizeRule(entry: unknown): AccessControlRule | null {
  if (!entry || typeof entry !== "object") return null;
  const rule = entry as Record<string, unknown>;
  const subjectType = sanitizeKey(rule.subjectType) as AccessSubjectType;
  const resource = sanitizeKey(rule.resource) as AccessResourceKey;
  const level = sanitizeKey(rule.level) as AccessPermissionLevel;
  if (!ACCESS_SUBJECT_SET.has(subjectType)) return null;
  if (!ACCESS_RESOURCE_SET.has(resource)) return null;
  if (!ACCESS_LEVEL_SET.has(level)) return null;

  const subjectId = subjectType === "global" ? "all" : String(rule.subjectId || "").trim();
  if (!subjectId) return null;

  return {
    id: String(rule.id || crypto.randomUUID()).trim(),
    subjectType,
    subjectId,
    resource,
    level,
    label: sanitizeLabel(rule.label),
    active: rule.active !== false,
    startsAt: typeof rule.startsAt === "string" && rule.startsAt ? rule.startsAt : null,
    endsAt: typeof rule.endsAt === "string" && rule.endsAt ? rule.endsAt : null,
  };
}

export function normalizeAccessControlConfig(value: unknown): AccessControlConfig {
  if (!value || typeof value !== "object") return DEFAULT_ACCESS_CONTROL_CONFIG;
  const raw = value as { roles?: unknown; rules?: unknown };
  const incomingRoles = Array.isArray(raw.roles) ? raw.roles.flatMap((entry) => normalizeRoleDefinition(entry) ?? []) : [];
  const incomingRules = Array.isArray(raw.rules) ? raw.rules.flatMap((entry) => normalizeRule(entry) ?? []) : [];

  const roleByKey = new Map<string, AccessRoleDefinition>();
  for (const role of DEFAULT_ACCESS_CONTROL_CONFIG.roles) roleByKey.set(role.key, role);
  for (const role of incomingRoles) {
    const current = roleByKey.get(role.key);
    roleByKey.set(role.key, current?.system ? { ...role, system: true } : role);
  }

  const ruleById = new Map<string, AccessControlRule>();
  for (const rule of DEFAULT_ACCESS_CONTROL_CONFIG.rules) ruleById.set(rule.id, rule);
  for (const rule of incomingRules) ruleById.set(rule.id, rule);

  return {
    roles: Array.from(roleByKey.values()),
    rules: Array.from(ruleById.values()),
  };
}

export function canAccessLevel(level: AccessPermissionLevel, minimum: AccessPermissionLevel = "read") {
  return ACCESS_LEVEL_RANK[level] >= ACCESS_LEVEL_RANK[minimum];
}

function getSubjectIdForContext(subjectType: AccessSubjectType, context: AccessContext) {
  if (subjectType === "global") return "all";
  if (subjectType === "plan") return context.plan;
  if (subjectType === "role") return context.role;
  return context.uid || "";
}

export function resolveSubjectAccessLevel(
  config: AccessControlConfig,
  context: AccessContext,
  resource: AccessResourceKey,
  subjectType: AccessSubjectType,
  now = new Date()
): AccessPermissionLevel | null {
  const subjectId = getSubjectIdForContext(subjectType, context);
  if (!subjectId) return null;

  const matches = config.rules.filter(
    (rule) =>
      rule.subjectType === subjectType &&
      rule.subjectId === subjectId &&
      rule.resource === resource &&
      isRuleActiveNow(rule, now)
  );
  if (matches.length === 0) return null;
  return matches[matches.length - 1].level;
}

export function resolveAccessLevel(
  config: AccessControlConfig,
  context: AccessContext,
  resource: AccessResourceKey,
  now = new Date()
): AccessPermissionLevel {
  const userLevel = resolveSubjectAccessLevel(config, context, resource, "user", now);
  if (userLevel) return userLevel;

  const roleLevel = resolveSubjectAccessLevel(config, context, resource, "role", now);
  if (roleLevel) return roleLevel;

  const planLevel = resolveSubjectAccessLevel(config, context, resource, "plan", now);
  if (planLevel) return planLevel;

  const globalLevel = resolveSubjectAccessLevel(config, context, resource, "global", now);
  if (globalLevel) return globalLevel;

  return "none";
}

export function hasAccess(
  config: AccessControlConfig,
  context: AccessContext,
  resource: AccessResourceKey,
  minimum: AccessPermissionLevel = "read",
  now = new Date()
) {
  return canAccessLevel(resolveAccessLevel(config, context, resource, now), minimum);
}

export function hasBillingExemption(
  config: AccessControlConfig,
  context: Pick<AccessContext, "uid" | "role">,
  now = new Date()
) {
  const accessContext = { uid: context.uid, role: context.role, plan: "free" as UserPlan };
  const userLevel = resolveSubjectAccessLevel(config, accessContext, "billing.exempt", "user", now);
  if (userLevel && canAccessLevel(userLevel, "read")) return true;

  const roleLevel = resolveSubjectAccessLevel(config, accessContext, "billing.exempt", "role", now);
  return Boolean(roleLevel && canAccessLevel(roleLevel, "read"));
}

export const MANAGED_FEATURE_ACCESS_RESOURCE: Record<ManagedFeatureKey, AccessResourceKey> = {
  installments: "transactions.installments",
  monthlyForecast: "dashboard.monthly_forecast",
  smartDailyLimit: "dashboard.smart_daily_limit",
};

const MANAGED_FEATURE_MINIMUM_LEVEL: Record<ManagedFeatureKey, AccessPermissionLevel> = {
  installments: "write",
  monthlyForecast: "read",
  smartDailyLimit: "read",
};

export function buildEffectiveFeatureAccessConfig(
  accessControl: AccessControlConfig,
  context: AccessContext,
  now = new Date()
): FeatureAccessConfig {
  const effective: Partial<Record<ManagedFeatureKey, boolean>> = {};

  for (const [feature, resource] of Object.entries(MANAGED_FEATURE_ACCESS_RESOURCE) as Array<[ManagedFeatureKey, AccessResourceKey]>) {
    effective[feature] = hasAccess(accessControl, context, resource, MANAGED_FEATURE_MINIMUM_LEVEL[feature], now);
  }

  return { effective };
}
