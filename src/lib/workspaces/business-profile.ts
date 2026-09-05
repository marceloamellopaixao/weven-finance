import type { BusinessOrganizationKind, BusinessTeamSize } from "@/types/workspace";

export const BUSINESS_ORGANIZATION_KINDS: BusinessOrganizationKind[] = [
  "self_employed", "company", "services", "church", "nonprofit", "project", "other",
];

export const BUSINESS_TEAM_SIZES: BusinessTeamSize[] = ["solo", "2_5", "6_20", "21_100", "100_plus"];

export const BUSINESS_ORGANIZATION_LABELS: Record<BusinessOrganizationKind, string> = {
  self_employed: "MEI ou autônomo",
  company: "Empresa ou comércio",
  services: "Prestador de serviços",
  church: "Igreja ou ministério",
  nonprofit: "Associação ou ONG",
  project: "Projeto ou equipe",
  other: "Outro tipo de organização",
};

export const BUSINESS_ORGANIZATION_DESCRIPTIONS: Record<BusinessOrganizationKind, string> = {
  self_employed: "Trabalho individual, serviços e obrigações do MEI.",
  company: "Vendas, estoque, fornecedores, equipe e operação.",
  services: "Clientes, contratos, ferramentas e prestação de serviços.",
  church: "Dízimos, ofertas, doações, ministérios e eventos.",
  nonprofit: "Doações, projetos, repasses e despesas administrativas.",
  project: "Um projeto profissional ou uma equipe com orçamento próprio.",
  other: "Configuração empresarial genérica que você pode personalizar.",
};

export const BUSINESS_TEAM_SIZE_LABELS: Record<BusinessTeamSize, string> = {
  solo: "Somente eu",
  "2_5": "2 a 5 pessoas",
  "6_20": "6 a 20 pessoas",
  "21_100": "21 a 100 pessoas",
  "100_plus": "Mais de 100 pessoas",
};

export function normalizeBusinessOrganizationKind(value: unknown): BusinessOrganizationKind {
  return BUSINESS_ORGANIZATION_KINDS.includes(value as BusinessOrganizationKind)
    ? value as BusinessOrganizationKind
    : "company";
}

export function normalizeBusinessTeamSize(value: unknown): BusinessTeamSize {
  return BUSINESS_TEAM_SIZES.includes(value as BusinessTeamSize) ? value as BusinessTeamSize : "solo";
}

export function getBusinessPeopleNoun(kind: BusinessOrganizationKind | undefined) {
  if (kind === "church") return "pessoas da equipe";
  if (kind === "nonprofit") return "integrantes da equipe";
  return "pessoas da equipe";
}
