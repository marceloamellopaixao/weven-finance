export interface PlanDetails {
  name: string;
  price: number;
  description: string;
  paymentLink: string;
  features: string[];
  limit?: number;
  highlight?: boolean;
  active: boolean;
}

export interface PlansConfig {
  free: PlanDetails;
  premium: PlanDetails;
  pro: PlanDetails;
}

export type ManagedFeatureKey = "installments" | "monthlyForecast" | "smartDailyLimit";

export interface FeatureAccessConfig {
  effective?: Partial<Record<ManagedFeatureKey, boolean>>;
}

export type AccessPermissionLevel = "none" | "read" | "write" | "full";
export type AccessSubjectType = "global" | "plan" | "role" | "user";
export type AccessResourceKey =
  | "dashboard.read"
  | "dashboard.monthly_forecast"
  | "dashboard.smart_daily_limit"
  | "dashboard.privacy_toggle"
  | "transactions.read"
  | "transactions.create"
  | "transactions.edit"
  | "transactions.delete"
  | "transactions.installments"
  | "transactions.recurring"
  | "transactions.categories"
  | "transactions.bulk_actions"
  | "cards.read"
  | "cards.write"
  | "cards.delete"
  | "cards.identify_bank"
  | "cards.limit_rules"
  | "piggy_bank.read"
  | "piggy_bank.write"
  | "piggy_bank.delete"
  | "piggy_bank.card_limit"
  | "piggy_bank.history"
  | "settings.read"
  | "settings.write"
  | "settings.appearance"
  | "settings.navigation"
  | "settings.security"
  | "settings.account_delete"
  | "billing.read"
  | "billing.manage"
  | "billing.checkout"
  | "billing.cancel"
  | "apps.read"
  | "apps.quick_bar"
  | "apps.guided_tour"
  | "notifications.read"
  | "notifications.write"
  | "onboarding.read"
  | "onboarding.write"
  | "support.read"
  | "support.write"
  | "support.delete"
  | "admin.users.read"
  | "admin.users.write"
  | "admin.users.delete"
  | "admin.support.read"
  | "admin.support.write"
  | "admin.support.delete"
  | "admin.restore.read"
  | "admin.restore.write"
  | "admin.restore.delete"
  | "admin.plans.read"
  | "admin.plans.write"
  | "admin.metrics.read"
  | "admin.audit.read"
  | "admin.export"
  | "admin.impersonation"
  | "admin.health"
  | "admin.billing_jobs"
  | "admin.retention_jobs"
  | "admin.permissions.read"
  | "admin.permissions.write"
  | "admin.permissions.delete";

export interface AccessRoleDefinition {
  id: string;
  key: string;
  name: string;
  description?: string;
  active: boolean;
  system?: boolean;
}

export interface AccessControlRule {
  id: string;
  subjectType: AccessSubjectType;
  subjectId: string;
  resource: AccessResourceKey;
  level: AccessPermissionLevel;
  label?: string;
  active: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
}

export interface AccessControlConfig {
  roles: AccessRoleDefinition[];
  rules: AccessControlRule[];
}

export const DEFAULT_PLANS_CONFIG: PlansConfig = {
  free: {
    name: "Free",
    price: 0,
    description: "Para sair do caos e registrar o essencial do mês.",
    paymentLink: "",
    features: [
      "Até 20 lançamentos por mês",
      "1 cartão para acompanhar gastos",
      "1 meta ativa no porquinho",
      "Visão mensal básica do fluxo financeiro",
    ],
    limit: 20,
    active: true,
  },
  premium: {
    name: "Premium",
    price: 19.9,
    description: "Para organizar cartões, vencimentos, parcelas e metas com clareza.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=018bc64fcdfa44e384fc7d74c430be10",
    features: [
      "Lançamentos ilimitados",
      "Até 5 cartões para limites e faturas",
      "Até 5 metas ativas no porquinho",
      "Parcelamentos, vencimentos e projeção do mês",
    ],
    highlight: true,
    active: true,
  },
  pro: {
    name: "Pro",
    price: 49.9,
    description: "Para decidir melhor todos os dias com mais orientação.",
    paymentLink: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_plan_id=cc495aef2c0043c5a272ad5f8594d78e",
    features: [
      "Tudo do Premium",
      "Cartões e metas sem limite",
      "Limite diário inteligente no dashboard",
      "Camada extra de orientação financeira",
    ],
    highlight: false,
    active: true,
  },
};

export const DEFAULT_FEATURE_ACCESS_CONFIG: FeatureAccessConfig = {
  effective: {},
};

export const DEFAULT_ACCESS_CONTROL_CONFIG: AccessControlConfig = {
  roles: [
    { id: "role-client", key: "client", name: "Cliente", description: "Usuário final do SaaS.", active: true, system: true },
    { id: "role-support", key: "support", name: "Suporte", description: "Atendimento e acompanhamento de chamados.", active: true, system: true },
    { id: "role-moderator", key: "moderator", name: "Moderador", description: "Operação avançada sem exclusões permanentes.", active: true, system: true },
    { id: "role-admin", key: "admin", name: "Admin", description: "Administração da plataforma.", active: true, system: true },
  ],
  rules: [
    { id: "global-dashboard-read", subjectType: "global", subjectId: "all", resource: "dashboard.read", level: "read", active: true },
    { id: "global-dashboard-privacy", subjectType: "global", subjectId: "all", resource: "dashboard.privacy_toggle", level: "write", active: true },
    { id: "global-transactions-read", subjectType: "global", subjectId: "all", resource: "transactions.read", level: "read", active: true },
    { id: "global-transactions-create", subjectType: "global", subjectId: "all", resource: "transactions.create", level: "write", active: true },
    { id: "global-transactions-edit", subjectType: "global", subjectId: "all", resource: "transactions.edit", level: "write", active: true },
    { id: "global-transactions-delete", subjectType: "global", subjectId: "all", resource: "transactions.delete", level: "write", active: true },
    { id: "global-transactions-categories", subjectType: "global", subjectId: "all", resource: "transactions.categories", level: "write", active: true },
    { id: "global-transactions-bulk", subjectType: "global", subjectId: "all", resource: "transactions.bulk_actions", level: "write", active: true },
    { id: "global-cards-read", subjectType: "global", subjectId: "all", resource: "cards.read", level: "read", active: true },
    { id: "global-cards-write", subjectType: "global", subjectId: "all", resource: "cards.write", level: "write", active: true },
    { id: "global-cards-delete", subjectType: "global", subjectId: "all", resource: "cards.delete", level: "write", active: true },
    { id: "global-cards-identify", subjectType: "global", subjectId: "all", resource: "cards.identify_bank", level: "write", active: true },
    { id: "global-cards-rules", subjectType: "global", subjectId: "all", resource: "cards.limit_rules", level: "write", active: true },
    { id: "global-piggy-read", subjectType: "global", subjectId: "all", resource: "piggy_bank.read", level: "read", active: true },
    { id: "global-piggy-write", subjectType: "global", subjectId: "all", resource: "piggy_bank.write", level: "write", active: true },
    { id: "global-piggy-delete", subjectType: "global", subjectId: "all", resource: "piggy_bank.delete", level: "write", active: true },
    { id: "global-piggy-card-limit", subjectType: "global", subjectId: "all", resource: "piggy_bank.card_limit", level: "write", active: true },
    { id: "global-piggy-history", subjectType: "global", subjectId: "all", resource: "piggy_bank.history", level: "read", active: true },
    { id: "global-settings-read", subjectType: "global", subjectId: "all", resource: "settings.read", level: "read", active: true },
    { id: "global-settings-write", subjectType: "global", subjectId: "all", resource: "settings.write", level: "write", active: true },
    { id: "global-settings-appearance", subjectType: "global", subjectId: "all", resource: "settings.appearance", level: "write", active: true },
    { id: "global-settings-navigation", subjectType: "global", subjectId: "all", resource: "settings.navigation", level: "write", active: true },
    { id: "global-settings-security", subjectType: "global", subjectId: "all", resource: "settings.security", level: "write", active: true },
    { id: "global-settings-account-delete", subjectType: "global", subjectId: "all", resource: "settings.account_delete", level: "write", active: true },
    { id: "global-billing-read", subjectType: "global", subjectId: "all", resource: "billing.read", level: "read", active: true },
    { id: "global-billing-manage", subjectType: "global", subjectId: "all", resource: "billing.manage", level: "write", active: true },
    { id: "global-billing-checkout", subjectType: "global", subjectId: "all", resource: "billing.checkout", level: "write", active: true },
    { id: "global-billing-cancel", subjectType: "global", subjectId: "all", resource: "billing.cancel", level: "write", active: true },
    { id: "global-apps-read", subjectType: "global", subjectId: "all", resource: "apps.read", level: "read", active: true },
    { id: "global-apps-quick-bar", subjectType: "global", subjectId: "all", resource: "apps.quick_bar", level: "write", active: true },
    { id: "global-apps-guided-tour", subjectType: "global", subjectId: "all", resource: "apps.guided_tour", level: "write", active: true },
    { id: "global-notifications-read", subjectType: "global", subjectId: "all", resource: "notifications.read", level: "read", active: true },
    { id: "global-notifications-write", subjectType: "global", subjectId: "all", resource: "notifications.write", level: "write", active: true },
    { id: "global-onboarding-read", subjectType: "global", subjectId: "all", resource: "onboarding.read", level: "read", active: true },
    { id: "global-onboarding-write", subjectType: "global", subjectId: "all", resource: "onboarding.write", level: "write", active: true },
    { id: "global-support-read", subjectType: "global", subjectId: "all", resource: "support.read", level: "read", active: true },
    { id: "global-support-write", subjectType: "global", subjectId: "all", resource: "support.write", level: "write", active: true },
    { id: "plan-free-installments", subjectType: "plan", subjectId: "free", resource: "transactions.installments", level: "none", active: true },
    { id: "plan-free-recurring", subjectType: "plan", subjectId: "free", resource: "transactions.recurring", level: "none", active: true },
    { id: "plan-free-forecast", subjectType: "plan", subjectId: "free", resource: "dashboard.monthly_forecast", level: "none", active: true },
    { id: "plan-free-daily-limit", subjectType: "plan", subjectId: "free", resource: "dashboard.smart_daily_limit", level: "none", active: true },
    { id: "plan-premium-installments", subjectType: "plan", subjectId: "premium", resource: "transactions.installments", level: "write", active: true },
    { id: "plan-premium-recurring", subjectType: "plan", subjectId: "premium", resource: "transactions.recurring", level: "write", active: true },
    { id: "plan-premium-forecast", subjectType: "plan", subjectId: "premium", resource: "dashboard.monthly_forecast", level: "read", active: true },
    { id: "plan-premium-daily-limit", subjectType: "plan", subjectId: "premium", resource: "dashboard.smart_daily_limit", level: "none", active: true },
    { id: "plan-pro-installments", subjectType: "plan", subjectId: "pro", resource: "transactions.installments", level: "write", active: true },
    { id: "plan-pro-recurring", subjectType: "plan", subjectId: "pro", resource: "transactions.recurring", level: "write", active: true },
    { id: "plan-pro-forecast", subjectType: "plan", subjectId: "pro", resource: "dashboard.monthly_forecast", level: "read", active: true },
    { id: "plan-pro-daily-limit", subjectType: "plan", subjectId: "pro", resource: "dashboard.smart_daily_limit", level: "read", active: true },
    { id: "role-admin-users-read", subjectType: "role", subjectId: "admin", resource: "admin.users.read", level: "read", active: true },
    { id: "role-admin-users-write", subjectType: "role", subjectId: "admin", resource: "admin.users.write", level: "write", active: true },
    { id: "role-admin-support-read", subjectType: "role", subjectId: "admin", resource: "admin.support.read", level: "read", active: true },
    { id: "role-admin-support-write", subjectType: "role", subjectId: "admin", resource: "admin.support.write", level: "write", active: true },
    { id: "role-admin-restore-read", subjectType: "role", subjectId: "admin", resource: "admin.restore.read", level: "read", active: true },
    { id: "role-admin-restore-write", subjectType: "role", subjectId: "admin", resource: "admin.restore.write", level: "write", active: true },
    { id: "role-admin-plans-read", subjectType: "role", subjectId: "admin", resource: "admin.plans.read", level: "read", active: true },
    { id: "role-admin-plans-write", subjectType: "role", subjectId: "admin", resource: "admin.plans.write", level: "write", active: true },
    { id: "role-admin-metrics-read", subjectType: "role", subjectId: "admin", resource: "admin.metrics.read", level: "read", active: true },
    { id: "role-admin-audit-read", subjectType: "role", subjectId: "admin", resource: "admin.audit.read", level: "read", active: true },
    { id: "role-admin-export", subjectType: "role", subjectId: "admin", resource: "admin.export", level: "write", active: true },
    { id: "role-admin-impersonation", subjectType: "role", subjectId: "admin", resource: "admin.impersonation", level: "write", active: true },
    { id: "role-admin-health", subjectType: "role", subjectId: "admin", resource: "admin.health", level: "read", active: true },
    { id: "role-admin-billing-jobs", subjectType: "role", subjectId: "admin", resource: "admin.billing_jobs", level: "write", active: true },
    { id: "role-admin-retention-jobs", subjectType: "role", subjectId: "admin", resource: "admin.retention_jobs", level: "write", active: true },
    { id: "role-admin-permissions-read", subjectType: "role", subjectId: "admin", resource: "admin.permissions.read", level: "read", active: true },
    { id: "role-admin-permissions-write", subjectType: "role", subjectId: "admin", resource: "admin.permissions.write", level: "write", active: true },
    { id: "role-moderator-users-read", subjectType: "role", subjectId: "moderator", resource: "admin.users.read", level: "read", active: true },
    { id: "role-moderator-users-write", subjectType: "role", subjectId: "moderator", resource: "admin.users.write", level: "write", active: true },
    { id: "role-moderator-support-read", subjectType: "role", subjectId: "moderator", resource: "admin.support.read", level: "read", active: true },
    { id: "role-moderator-support-write", subjectType: "role", subjectId: "moderator", resource: "admin.support.write", level: "write", active: true },
    { id: "role-moderator-restore-read", subjectType: "role", subjectId: "moderator", resource: "admin.restore.read", level: "read", active: true },
    { id: "role-moderator-restore-write", subjectType: "role", subjectId: "moderator", resource: "admin.restore.write", level: "write", active: true },
    { id: "role-moderator-metrics-read", subjectType: "role", subjectId: "moderator", resource: "admin.metrics.read", level: "read", active: true },
    { id: "role-moderator-audit-read", subjectType: "role", subjectId: "moderator", resource: "admin.audit.read", level: "read", active: true },
    { id: "role-moderator-export", subjectType: "role", subjectId: "moderator", resource: "admin.export", level: "write", active: true },
    { id: "role-moderator-impersonation", subjectType: "role", subjectId: "moderator", resource: "admin.impersonation", level: "write", active: true },
    { id: "role-moderator-health", subjectType: "role", subjectId: "moderator", resource: "admin.health", level: "read", active: true },
    { id: "role-moderator-billing-jobs", subjectType: "role", subjectId: "moderator", resource: "admin.billing_jobs", level: "write", active: true },
    { id: "role-support-support-read", subjectType: "role", subjectId: "support", resource: "admin.support.read", level: "read", active: true },
    { id: "role-support-support-write", subjectType: "role", subjectId: "support", resource: "admin.support.write", level: "write", active: true },
    { id: "role-support-audit-read", subjectType: "role", subjectId: "support", resource: "admin.audit.read", level: "read", active: true },
  ],
};
