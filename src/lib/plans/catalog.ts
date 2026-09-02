import type { FinancialProfileType } from "@/types/workspace";
import type { UserPlan } from "@/types/user";
import type { PlanDetails, PlansConfig } from "@/types/system";

export type BillingInterval = "monthly" | "yearly";

export type PlanCatalogItem = {
  id: UserPlan;
  publicName: string;
  shortName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number | null;
  allowedProfileTypes: FinancialProfileType[];
  badge?: string;
  cta: string;
  active: boolean;
  founderCampaignOnly?: boolean;
  limits: {
    monthlyTransactions: number | null;
    cards: number | null;
    goals: number | null;
    familyMembers: number | null;
    professionalProfiles: number | null;
  };
  features: {
    familyProfile: boolean;
    businessProfile: boolean;
    cnpj: boolean;
    advancedReports: boolean;
    exports: boolean;
    unlimitedExports: boolean;
    collaborators: boolean;
    businessCategories: boolean;
    prioritySupport: boolean;
    installments: boolean;
    monthlyForecast: boolean;
    smartDailyLimit: boolean;
  };
  benefits: string[];
};

export const PLAN_ORDER: UserPlan[] = ["free", "founder", "premium", "pro", "family", "business"];
export const PAID_PLAN_IDS: Exclude<UserPlan, "free">[] = ["founder", "premium", "pro", "family", "business"];

export const PLAN_CATALOG: Record<UserPlan, PlanCatalogItem> = {
  free: {
    id: "free",
    publicName: "Free",
    shortName: "Free",
    description: "Para experimentar o WevenFinance com uso pessoal básico.",
    monthlyPrice: 0,
    yearlyPrice: null,
    allowedProfileTypes: ["personal"],
    cta: "Começar grátis",
    active: true,
    limits: { monthlyTransactions: 20, cards: 1, goals: 1, familyMembers: null, professionalProfiles: 0 },
    features: {
      familyProfile: false,
      businessProfile: false,
      cnpj: false,
      advancedReports: false,
      exports: false,
      unlimitedExports: false,
      collaborators: false,
      businessCategories: false,
      prioritySupport: false,
      installments: false,
      monthlyForecast: false,
      smartDailyLimit: false,
    },
    benefits: [
      "Uso pessoal básico",
      "Limite de transações mensais",
      "Limite de cartões",
      "Relatórios simples",
      "Sem exportação avançada",
      "Sem perfil Família ou Business/PJ",
    ],
  },
  founder: {
    id: "founder",
    publicName: "Fundador",
    shortName: "Fundador",
    description: "Preço especial por 12 meses para os primeiros usuários.",
    monthlyPrice: 9.9,
    yearlyPrice: null,
    allowedProfileTypes: ["personal"],
    badge: "Oferta limitada",
    cta: "Garantir preço fundador",
    active: process.env.NEXT_PUBLIC_FOUNDER_PLAN_ACTIVE === "true",
    founderCampaignOnly: true,
    limits: { monthlyTransactions: null, cards: 5, goals: 5, familyMembers: null, professionalProfiles: 1 },
    features: {
      familyProfile: false,
      businessProfile: false,
      cnpj: false,
      advancedReports: true,
      exports: true,
      unlimitedExports: false,
      collaborators: false,
      businessCategories: false,
      prioritySupport: false,
      installments: true,
      monthlyForecast: true,
      smartDailyLimit: false,
    },
    benefits: [
      "R$ 9,90 por mês por 12 meses",
      "Limitado aos primeiros usuários",
      "Recursos pessoais avançados",
      "Não é o preço oficial permanente",
    ],
  },
  premium: {
    id: "premium",
    publicName: "Premium Individual",
    shortName: "Premium",
    description: "Para organizar a vida financeira pessoal.",
    monthlyPrice: 19.9,
    yearlyPrice: 199.9,
    allowedProfileTypes: ["personal"],
    badge: "Mais escolhido",
    cta: "Escolher Premium",
    active: true,
    limits: { monthlyTransactions: null, cards: 5, goals: 5, familyMembers: null, professionalProfiles: 1 },
    features: {
      familyProfile: false,
      businessProfile: false,
      cnpj: false,
      advancedReports: true,
      exports: true,
      unlimitedExports: false,
      collaborators: false,
      businessCategories: false,
      prioritySupport: false,
      installments: true,
      monthlyForecast: true,
      smartDailyLimit: false,
    },
    benefits: [
      "Transações ilimitadas",
      "Cartões",
      "Categorias",
      "Metas/porquinhos",
      "Relatórios completos",
      "Exportação PDF/Excel",
      "Limites e alertas",
    ],
  },
  pro: {
    id: "pro",
    publicName: "Pro",
    shortName: "Pro",
    description: "Para quem quer controle financeiro pessoal mais completo.",
    monthlyPrice: 29.9,
    yearlyPrice: 299.9,
    allowedProfileTypes: ["personal"],
    badge: "Melhor custo-benefício",
    cta: "Escolher Pro",
    active: true,
    limits: { monthlyTransactions: null, cards: null, goals: null, familyMembers: null, professionalProfiles: 3 },
    features: {
      familyProfile: false,
      businessProfile: false,
      cnpj: false,
      advancedReports: true,
      exports: true,
      unlimitedExports: true,
      collaborators: false,
      businessCategories: false,
      prioritySupport: false,
      installments: true,
      monthlyForecast: true,
      smartDailyLimit: true,
    },
    benefits: [
      "Tudo do Premium Individual",
      "Mais perfis pessoais",
      "Histórico completo",
      "Relatórios avançados",
      "Exportações ilimitadas",
      "Mais personalização",
    ],
  },
  family: {
    id: "family",
    publicName: "Família",
    shortName: "Família",
    description: "Para casais e famílias organizarem o dinheiro juntos.",
    monthlyPrice: 39.9,
    yearlyPrice: 399.9,
    allowedProfileTypes: ["family"],
    badge: "Melhor para famílias",
    cta: "Escolher Família",
    active: true,
    limits: { monthlyTransactions: null, cards: null, goals: null, familyMembers: 4, professionalProfiles: 0 },
    features: {
      familyProfile: true,
      businessProfile: false,
      cnpj: false,
      advancedReports: true,
      exports: true,
      unlimitedExports: false,
      collaborators: true,
      businessCategories: false,
      prioritySupport: false,
      installments: true,
      monthlyForecast: true,
      smartDailyLimit: true,
    },
    benefits: [
      "Perfil financeiro familiar",
      "Até 4 pessoas incluídas",
      "Assentos adicionais opcionais",
      "Permissões simples",
      "Metas familiares",
      "Relatórios da família",
      "Controle de gastos compartilhados",
    ],
  },
  business: {
    id: "business",
    publicName: "Business/PJ",
    shortName: "Business/PJ",
    description: "Para MEI, autônomos, igrejas, pequenos negócios, projetos profissionais e prestadores de serviço.",
    monthlyPrice: 49.9,
    yearlyPrice: 499.9,
    allowedProfileTypes: ["business"],
    badge: "Para negócios",
    cta: "Escolher Business/PJ",
    active: true,
    limits: { monthlyTransactions: null, cards: null, goals: null, familyMembers: null, professionalProfiles: null },
    features: {
      familyProfile: false,
      businessProfile: true,
      cnpj: true,
      advancedReports: true,
      exports: true,
      unlimitedExports: true,
      collaborators: true,
      businessCategories: true,
      prioritySupport: true,
      installments: true,
      monthlyForecast: true,
      smartDailyLimit: true,
    },
    benefits: [
      "Cadastro de CNPJ opcional",
      "Perfil financeiro profissional",
      "Até 5 usuários incluídos",
      "Assentos adicionais para funcionários",
      "Receitas e despesas do negócio",
      "Categorias empresariais",
      "Relatórios em PDF/Excel",
      "Controle por contexto",
      "Suporte prioritário",
    ],
  },
};

export function isUserPlan(value: unknown): value is UserPlan {
  return typeof value === "string" && value in PLAN_CATALOG;
}

export function parseUserPlan(value: unknown, fallback: UserPlan = "free"): UserPlan {
  return isUserPlan(value) ? value : fallback;
}

export function isPaidPlan(value: unknown): value is Exclude<UserPlan, "free"> {
  return isUserPlan(value) && value !== "free";
}

export function getPublicPlans() {
  return PLAN_ORDER.map((id) => PLAN_CATALOG[id]).filter(
    (plan) => plan.active && (!plan.founderCampaignOnly || process.env.NEXT_PUBLIC_FOUNDER_PLAN_ACTIVE === "true")
  );
}

export function getConfiguredPublicPlans(config: PlansConfig): PlanCatalogItem[] {
  return getPublicPlans()
    .map((catalogPlan) => {
      const configured = config[catalogPlan.id];
      return {
        ...catalogPlan,
        publicName: configured.name || catalogPlan.publicName,
        description: configured.description || catalogPlan.description,
        monthlyPrice: Number.isFinite(configured.price) ? configured.price : catalogPlan.monthlyPrice,
        yearlyPrice: configured.yearlyPrice === undefined ? catalogPlan.yearlyPrice : configured.yearlyPrice,
        benefits: configured.features?.length ? configured.features : catalogPlan.benefits,
        badge: configured.badge || catalogPlan.badge,
        cta: configured.cta || catalogPlan.cta,
        active: configured.active,
      };
    })
    .filter((plan) => plan.active);
}

export function getPlanPriceAmount(plan: UserPlan, interval: BillingInterval) {
  const item = PLAN_CATALOG[plan];
  if (interval === "yearly" && item.yearlyPrice !== null) return item.yearlyPrice;
  return item.monthlyPrice;
}

export function getEquivalentMonthlyPrice(plan: UserPlan) {
  const yearly = PLAN_CATALOG[plan].yearlyPrice;
  return yearly === null ? null : yearly / 12;
}

export function canPlanUseProfile(plan: UserPlan, profileType: FinancialProfileType) {
  return PLAN_CATALOG[plan].allowedProfileTypes.includes(profileType);
}

export function planCatalogToDetails(plan: PlanCatalogItem): PlanDetails {
  const isFamily = plan.id === "family";
  const isBusiness = plan.id === "business";
  return {
    name: plan.publicName,
    price: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    description: plan.description,
    features: plan.benefits,
    limit: plan.limits.monthlyTransactions ?? undefined,
    includedSeats: isFamily ? 4 : isBusiness ? 5 : null,
    additionalSeatPrice: null,
    additionalSeatYearlyPrice: null,
    maxAdditionalSeats: isFamily ? 6 : isBusiness ? 45 : null,
    allowedProfileTypes: plan.allowedProfileTypes,
    cta: plan.cta,
    badge: plan.badge,
    highlight: plan.id === "premium",
    active: plan.active,
  };
}

export function normalizePlansConfig(value: unknown, fallback?: PlansConfig): PlansConfig {
  const data = value && typeof value === "object" ? (value as Partial<Record<UserPlan, Partial<PlanDetails>>>) : {};
  const base: PlansConfig = fallback ?? {
    free: planCatalogToDetails(PLAN_CATALOG.free),
    founder: planCatalogToDetails(PLAN_CATALOG.founder),
    premium: planCatalogToDetails(PLAN_CATALOG.premium),
    pro: planCatalogToDetails(PLAN_CATALOG.pro),
    family: planCatalogToDetails(PLAN_CATALOG.family),
    business: planCatalogToDetails(PLAN_CATALOG.business),
  };
  const merge = (plan: UserPlan): PlanDetails => {
    const merged = { ...base[plan], ...(data[plan] || {}) };
    const supportsSeats = plan === "family" || plan === "business";
    if (!supportsSeats) return merged;
    const includedSeats = Math.max(1, Math.floor(Number(merged.includedSeats || (plan === "family" ? 4 : 5))));
    const maxAdditionalSeats = merged.maxAdditionalSeats == null
      ? null
      : Math.max(0, Math.floor(Number(merged.maxAdditionalSeats) || 0));
    const normalizeSeatPrice = (price: unknown) => {
      if (price === null || price === undefined || price === "") return null;
      const parsed = Number(price);
      return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
    };
    return {
      ...merged,
      includedSeats,
      maxAdditionalSeats,
      additionalSeatPrice: normalizeSeatPrice(merged.additionalSeatPrice),
      additionalSeatYearlyPrice: normalizeSeatPrice(merged.additionalSeatYearlyPrice),
    };
  };
  return {
    free: merge("free"),
    founder: merge("founder"),
    premium: merge("premium"),
    pro: merge("pro"),
    family: merge("family"),
    business: merge("business"),
  };
}
