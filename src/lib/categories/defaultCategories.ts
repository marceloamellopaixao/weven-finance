import type { Locale } from "@/i18n/config";
import {
  getCategoryRoot,
  getSubcategoryName,
  isLegacySubcategory,
  isLinkedSubcategory,
} from "@/lib/category-utils";
import type { BusinessOrganizationKind, WorkspaceType } from "@/types/workspace";

export const CATEGORY_PATH_SEPARATOR = "::";

export type DefaultCategoryType = "income" | "expense" | "both";

export type DefaultCategoryPreset = {
  name: string;
  type: DefaultCategoryType;
  color: string;
  aliases?: string[];
};

const COLORS = {
  incomeGreen: "bg-green-500/10 text-green-600 border-green-200/50 dark:text-green-400 dark:border-green-800/50",
  incomeTeal: "bg-teal-500/10 text-teal-600 border-teal-200/50 dark:text-teal-400 dark:border-teal-800/50",
  expenseBlue: "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:text-blue-400 dark:border-blue-800/50",
  expenseOrange: "bg-orange-500/10 text-orange-600 border-orange-200/50 dark:text-orange-400 dark:border-orange-800/50",
  expenseViolet: "bg-violet-500/10 text-violet-600 border-violet-200/50 dark:text-violet-400 dark:border-violet-800/50",
  expenseEmerald: "bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:text-emerald-400 dark:border-emerald-800/50",
  expensePink: "bg-pink-500/10 text-pink-600 border-pink-200/50 dark:text-pink-400 dark:border-pink-800/50",
  expenseIndigo: "bg-indigo-500/10 text-indigo-600 border-indigo-200/50 dark:text-indigo-400 dark:border-indigo-800/50",
  neutral: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
};

const COMMON_DEFAULT_CATEGORIES: DefaultCategoryPreset[] = [
  { name: "Outros", type: "both", color: COLORS.neutral },
];

export const DEFAULT_CATEGORY_PRESETS_BY_WORKSPACE: Record<WorkspaceType, DefaultCategoryPreset[]> = {
  personal: [
    { name: "Salário", type: "income", color: COLORS.incomeGreen },
    { name: "Freelance", type: "income", color: COLORS.incomeTeal },
    { name: "Reembolso", type: "income", color: COLORS.incomeTeal },
    { name: "Investimentos", type: "income", color: COLORS.incomeGreen },
    { name: "Rendimento", type: "income", color: COLORS.incomeGreen },
    { name: "Casa", type: "expense", color: COLORS.expenseBlue },
    { name: "Moradia", type: "expense", color: COLORS.expenseBlue },
    { name: "Alimentação", type: "expense", color: COLORS.expenseOrange },
    { name: "Mercado", type: "expense", color: COLORS.expenseOrange },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
    { name: "Saúde", type: "expense", color: COLORS.expenseEmerald },
    { name: "Educação", type: "expense", color: COLORS.expenseViolet },
    { name: "Lazer", type: "expense", color: COLORS.expensePink },
    { name: "Compras", type: "expense", color: COLORS.expensePink },
    { name: "Assinaturas", type: "expense", color: COLORS.expenseIndigo },
    { name: "Investimento", type: "expense", color: COLORS.expenseEmerald },
  ],
  professional: [
    { name: "Cliente", type: "income", color: COLORS.incomeTeal },
    { name: "Projeto", type: "income", color: COLORS.incomeTeal },
    { name: "Serviço recorrente", type: "income", color: COLORS.incomeTeal },
    { name: "Comissão", type: "income", color: COLORS.incomeGreen },
    { name: "Serviços", type: "income", color: COLORS.incomeTeal },
    { name: "Ferramentas", type: "expense", color: COLORS.expenseViolet },
    { name: "Internet", type: "expense", color: COLORS.expenseBlue },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
    { name: "Marketing", type: "expense", color: COLORS.expensePink },
    { name: "Impostos", type: "expense", color: COLORS.expenseOrange },
    { name: "Equipamentos", type: "expense", color: COLORS.expenseIndigo },
    { name: "Contabilidade", type: "expense", color: COLORS.expenseEmerald },
  ],
  church: [
    { name: "Dízimo de irmão", type: "income", color: COLORS.incomeGreen },
    { name: "Dízimo da própria igreja", type: "expense", color: COLORS.expenseViolet },
    { name: "Oferta do culto", type: "income", color: COLORS.incomeGreen },
    { name: "Missões", type: "income", color: COLORS.incomeTeal },
    { name: "Jovens", type: "income", color: COLORS.incomeTeal },
    { name: "Crianças", type: "income", color: COLORS.incomeTeal },
    { name: "Irmãs", type: "income", color: COLORS.incomeTeal },
    { name: "Irmãos", type: "income", color: COLORS.incomeTeal },
    { name: "Cantina", type: "income", color: COLORS.incomeTeal },
    { name: "Eventos", type: "income", color: COLORS.incomeTeal },
    { name: "Doações", type: "income", color: COLORS.incomeGreen },
    { name: "Aluguel", type: "expense", color: COLORS.expenseBlue },
    { name: "Energia", type: "expense", color: COLORS.expenseOrange },
    { name: "Água", type: "expense", color: COLORS.expenseBlue },
    { name: "Som e mídia", type: "expense", color: COLORS.expenseIndigo },
    { name: "Cesta básica", type: "expense", color: COLORS.expenseOrange },
    { name: "Manutenção", type: "expense", color: COLORS.expenseBlue },
  ],
  family: [
    { name: "Salário principal", type: "income", color: COLORS.incomeGreen },
    { name: "Salário secundário", type: "income", color: COLORS.incomeGreen },
    { name: "Ajuda familiar", type: "income", color: COLORS.incomeTeal },
    { name: "Mercado", type: "expense", color: COLORS.expenseOrange },
    { name: "Aluguel/Financiamento", type: "expense", color: COLORS.expenseBlue },
    { name: "Luz", type: "expense", color: COLORS.expenseOrange },
    { name: "Água", type: "expense", color: COLORS.expenseBlue },
    { name: "Internet", type: "expense", color: COLORS.expenseBlue },
    { name: "Escola", type: "expense", color: COLORS.expenseViolet },
    { name: "Saúde", type: "expense", color: COLORS.expenseEmerald },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
    { name: "Lazer familiar", type: "expense", color: COLORS.expensePink },
  ],
  business: [
    { name: "Vendas", type: "income", color: COLORS.incomeTeal },
    { name: "Serviços", type: "income", color: COLORS.incomeTeal },
    { name: "Mensalidades", type: "income", color: COLORS.incomeGreen },
    { name: "Repasses", type: "income", color: COLORS.incomeTeal },
    { name: "Fornecedores", type: "expense", color: COLORS.expenseOrange },
    { name: "Estoque", type: "expense", color: COLORS.expenseEmerald },
    { name: "Marketing", type: "expense", color: COLORS.expensePink },
    { name: "Taxas", type: "expense", color: COLORS.expenseOrange },
    { name: "Plataforma", type: "expense", color: COLORS.expenseIndigo },
    { name: "Impostos", type: "expense", color: COLORS.expenseOrange },
    { name: "Operacional", type: "expense", color: COLORS.expenseBlue },
  ],
};

const BUSINESS_PROFILE_CATEGORIES: DefaultCategoryPreset[] = [
  { name: "Receita de vendas", type: "income", color: COLORS.incomeTeal },
  { name: "Receita de serviços", type: "income", color: COLORS.incomeTeal },
  { name: "Fornecedores", type: "expense", color: COLORS.expenseOrange },
  { name: "Impostos", type: "expense", color: COLORS.expenseOrange },
  { name: "Taxas", type: "expense", color: COLORS.expenseOrange },
  { name: "Ferramentas", type: "expense", color: COLORS.expenseViolet },
  { name: "Marketing", type: "expense", color: COLORS.expensePink },
  { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
  { name: "Pró-labore", type: "expense", color: COLORS.expenseEmerald },
  { name: "Equipamentos", type: "expense", color: COLORS.expenseIndigo },
  { name: "Despesas operacionais", type: "expense", color: COLORS.expenseBlue },
];

const BUSINESS_CATEGORY_PRESETS_BY_KIND: Record<BusinessOrganizationKind, DefaultCategoryPreset[]> = {
  self_employed: [
    { name: "Receita de serviços", type: "income", color: COLORS.incomeTeal },
    { name: "Clientes", type: "income", color: COLORS.incomeGreen },
    { name: "DAS / MEI", type: "expense", color: COLORS.expenseOrange },
    { name: "Ferramentas", type: "expense", color: COLORS.expenseViolet },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
  ],
  company: BUSINESS_PROFILE_CATEGORIES,
  services: [
    { name: "Receita de serviços", type: "income", color: COLORS.incomeTeal },
    { name: "Contratos", type: "income", color: COLORS.incomeGreen },
    { name: "Terceirizados", type: "expense", color: COLORS.expenseOrange },
    { name: "Software e ferramentas", type: "expense", color: COLORS.expenseViolet },
    { name: "Contabilidade", type: "expense", color: COLORS.expenseEmerald },
  ],
  church: [
    { name: "Dízimos", type: "income", color: COLORS.incomeGreen },
    { name: "Ofertas", type: "income", color: COLORS.incomeGreen },
    { name: "Doações", type: "income", color: COLORS.incomeTeal },
    { name: "Missões", type: "expense", color: COLORS.expenseViolet },
    { name: "Eventos", type: "both", color: COLORS.expensePink },
    { name: "Manutenção", type: "expense", color: COLORS.expenseBlue },
  ],
  nonprofit: [
    { name: "Doações", type: "income", color: COLORS.incomeGreen },
    { name: "Repasses e convênios", type: "income", color: COLORS.incomeTeal },
    { name: "Projetos sociais", type: "expense", color: COLORS.expenseViolet },
    { name: "Despesas administrativas", type: "expense", color: COLORS.expenseBlue },
    { name: "Eventos", type: "both", color: COLORS.expensePink },
  ],
  project: [
    { name: "Aportes", type: "income", color: COLORS.incomeGreen },
    { name: "Receitas do projeto", type: "income", color: COLORS.incomeTeal },
    { name: "Equipe e terceiros", type: "expense", color: COLORS.expenseOrange },
    { name: "Ferramentas", type: "expense", color: COLORS.expenseViolet },
    { name: "Operação do projeto", type: "expense", color: COLORS.expenseBlue },
  ],
  other: BUSINESS_PROFILE_CATEGORIES,
};

const CUSTOMER_DEFAULT_CATEGORY_PRESETS_BY_WORKSPACE: Record<WorkspaceType, DefaultCategoryPreset[]> = {
  personal: [
    { name: "Moradia", type: "expense", color: COLORS.expenseBlue },
    { name: "Alimentação", type: "expense", color: COLORS.expenseOrange },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
    { name: "Saúde", type: "expense", color: COLORS.expenseEmerald },
    { name: "Educação", type: "expense", color: COLORS.expenseViolet },
    { name: "Lazer", type: "expense", color: COLORS.expensePink },
    { name: "Cartão de crédito", type: "expense", color: COLORS.expenseIndigo },
    { name: "Dívidas", type: "expense", color: COLORS.expenseOrange },
    { name: "Assinaturas", type: "expense", color: COLORS.expenseViolet },
    { name: "Investimentos", type: "income", color: COLORS.incomeGreen },
    { name: "Investimento", type: "expense", color: COLORS.expenseEmerald },
    { name: "Salário", type: "income", color: COLORS.incomeGreen },
  ],
  family: [
    { name: "Casa", type: "expense", color: COLORS.expenseBlue },
    { name: "Mercado", type: "expense", color: COLORS.expenseOrange },
    { name: "Contas da casa", type: "expense", color: COLORS.expenseBlue },
    { name: "Filhos", type: "expense", color: COLORS.expenseViolet },
    { name: "Escola", type: "expense", color: COLORS.expenseViolet },
    { name: "Saúde da família", type: "expense", color: COLORS.expenseEmerald },
    { name: "Transporte", type: "expense", color: COLORS.expenseBlue },
    { name: "Lazer em família", type: "expense", color: COLORS.expensePink },
    { name: "Reserva familiar", type: "income", color: COLORS.incomeGreen },
    { name: "Dívidas da família", type: "expense", color: COLORS.expenseOrange },
    { name: "Assinaturas", type: "expense", color: COLORS.expenseViolet },
  ],
  business: BUSINESS_PROFILE_CATEGORIES,
  professional: BUSINESS_PROFILE_CATEGORIES,
  church: BUSINESS_PROFILE_CATEGORIES,
};

const CATEGORY_TRANSLATIONS: Record<Exclude<Locale, "pt-BR">, Record<string, string>> = {
  "en-US": {
    "Ajuda familiar": "Family support",
    "Alimentação": "Food",
    "Aluguel": "Rent",
    "Aluguel/Financiamento": "Rent/Mortgage",
    "Água": "Water",
    "Assinaturas": "Subscriptions",
    "Cantina": "Cafeteria",
    "Casa": "Home",
    "Cesta básica": "Food basket",
    "Cliente": "Client",
    "Comissão": "Commission",
    "Compras": "Shopping",
    "Contabilidade": "Accounting",
    "Crianças": "Children",
    "Dízimo da própria igreja": "Church's own tithe",
    "Dízimo de irmão": "Member tithe",
    "Doações": "Donations",
    "Educação": "Education",
    "Energia": "Power",
    "Equipamentos": "Equipment",
    "Escola": "School",
    "Estoque": "Inventory",
    "Eventos": "Events",
    "Ferramentas": "Tools",
    "Fornecedores": "Suppliers",
    "Freelance": "Freelance",
    "Impostos": "Taxes",
    "Internet": "Internet",
    "Investimento": "Investment",
    "Investimentos": "Investments",
    "Irmãs": "Sisters",
    "Irmãos": "Brothers",
    "Jovens": "Youth",
    "Lazer": "Leisure",
    "Lazer familiar": "Family leisure",
    "Luz": "Electricity",
    "Manutenção": "Maintenance",
    "Marketing": "Marketing",
    "Mensalidades": "Membership fees",
    "Mercado": "Groceries",
    "Missões": "Missions",
    "Moradia": "Housing",
    "Oferta do culto": "Service offering",
    "Operacional": "Operations",
    "Outros": "Other",
    "Plataforma": "Platform",
    "Projeto": "Project",
    "Reembolso": "Refund",
    "Rendimento": "Yield",
    "Repasses": "Transfers",
    "Salário": "Salary",
    "Salário principal": "Primary salary",
    "Salário secundário": "Secondary salary",
    "Saúde": "Health",
    "Serviço recorrente": "Recurring service",
    "Serviços": "Services",
    "Som e mídia": "Sound and media",
    "Taxas": "Fees",
    "Transporte": "Transportation",
    "Vendas": "Sales",
  },
  es: {
    "Ajuda familiar": "Ayuda familiar",
    "Alimentação": "Alimentación",
    "Aluguel": "Alquiler",
    "Aluguel/Financiamento": "Alquiler/Hipoteca",
    "Água": "Agua",
    "Assinaturas": "Suscripciones",
    "Cantina": "Cafetería",
    "Casa": "Casa",
    "Cesta básica": "Canasta básica",
    "Cliente": "Cliente",
    "Comissão": "Comisión",
    "Compras": "Compras",
    "Contabilidade": "Contabilidad",
    "Crianças": "Niños",
    "Dízimo da própria igreja": "Diezmo de la propia iglesia",
    "Dízimo de irmão": "Diezmo de miembro",
    "Doações": "Donaciones",
    "Educação": "Educación",
    "Energia": "Energía",
    "Equipamentos": "Equipos",
    "Escola": "Escuela",
    "Estoque": "Inventario",
    "Eventos": "Eventos",
    "Ferramentas": "Herramientas",
    "Fornecedores": "Proveedores",
    "Freelance": "Freelance",
    "Impostos": "Impuestos",
    "Internet": "Internet",
    "Investimento": "Inversión",
    "Investimentos": "Inversiones",
    "Irmãs": "Hermanas",
    "Irmãos": "Hermanos",
    "Jovens": "Jóvenes",
    "Lazer": "Ocio",
    "Lazer familiar": "Ocio familiar",
    "Luz": "Electricidad",
    "Manutenção": "Mantenimiento",
    "Marketing": "Marketing",
    "Mensalidades": "Mensualidades",
    "Mercado": "Supermercado",
    "Missões": "Misiones",
    "Moradia": "Vivienda",
    "Oferta do culto": "Ofrenda del culto",
    "Operacional": "Operaciones",
    "Outros": "Otros",
    "Plataforma": "Plataforma",
    "Projeto": "Proyecto",
    "Reembolso": "Reembolso",
    "Rendimento": "Rendimiento",
    "Repasses": "Transferencias",
    "Salário": "Salario",
    "Salário principal": "Salario principal",
    "Salário secundário": "Salario secundario",
    "Saúde": "Salud",
    "Serviço recorrente": "Servicio recurrente",
    "Serviços": "Servicios",
    "Som e mídia": "Sonido y medios",
    "Taxas": "Tasas",
    "Transporte": "Transporte",
    "Vendas": "Ventas",
  },
};

const ALL_DEFAULT_CATEGORIES = Object.values(DEFAULT_CATEGORY_PRESETS_BY_WORKSPACE)
  .flat()
  .concat(Object.values(BUSINESS_CATEGORY_PRESETS_BY_KIND).flat(), COMMON_DEFAULT_CATEGORIES);

const CANONICAL_BY_NAME = new Map<string, string>();

for (const category of ALL_DEFAULT_CATEGORIES) {
  CANONICAL_BY_NAME.set(category.name, category.name);
  category.aliases?.forEach((alias) => CANONICAL_BY_NAME.set(alias, category.name));
}

Object.values(CATEGORY_TRANSLATIONS).forEach((dictionary) => {
  Object.entries(dictionary).forEach(([canonical, translated]) => {
    CANONICAL_BY_NAME.set(translated, canonical);
  });
});

export function getDefaultCategoriesForWorkspaceType(
  workspaceType: WorkspaceType = "personal",
  businessKind?: BusinessOrganizationKind,
) {
  const byKey = new Map<string, DefaultCategoryPreset>();
  const presets = workspaceType === "business" && businessKind
    ? BUSINESS_CATEGORY_PRESETS_BY_KIND[businessKind]
    : CUSTOMER_DEFAULT_CATEGORY_PRESETS_BY_WORKSPACE[workspaceType];
  [...presets, ...COMMON_DEFAULT_CATEGORIES].forEach((category) => {
    byKey.set(`${category.name}::${category.type}`, category);
  });
  return Array.from(byKey.values());
}

export function normalizeDefaultCategoryName(name: string) {
  return CANONICAL_BY_NAME.get(name) || name;
}

export function isKnownDefaultCategoryName(name: string) {
  return CANONICAL_BY_NAME.has(name);
}

export function translateDefaultCategoryName(name: string, locale: Locale) {
  const canonical = normalizeDefaultCategoryName(name);
  if (locale === "pt-BR") return canonical;
  return CATEGORY_TRANSLATIONS[locale][canonical] || canonical;
}

export function translateDefaultCategoryValue(value: string, locale: Locale) {
  if (isLinkedSubcategory(value)) {
    const root = getCategoryRoot(value);
    const subcategory = getSubcategoryName(value);
    return `${translateDefaultCategoryName(root, locale)} / ${translateDefaultCategoryName(subcategory, locale)}`;
  }

  if (value.includes(" / ")) {
    return value
      .split(" / ")
      .map((segment) => translateDefaultCategoryName(segment, locale))
      .join(" / ");
  }

  if (isLegacySubcategory(value)) {
    return translateDefaultCategoryName(getSubcategoryName(value), locale);
  }

  return translateDefaultCategoryName(value, locale);
}

export function slugifyDefaultCategoryName(name: string) {
  return normalizeDefaultCategoryName(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
