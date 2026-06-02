import { Locale, detectBrowserLocale } from "@/i18n/config";
import { CurrencyCode } from "@/lib/money/formatMoney";

export type CountryCode = "BR" | "US" | "ES" | "OTHER";

export type RegionOption = {
  code: string;
  name: string;
};

export const COUNTRY_OPTIONS: Array<{ value: CountryCode; label: string; defaultLocale: Locale; defaultCurrency: CurrencyCode }> = [
  { value: "BR", label: "Brasil", defaultLocale: "pt-BR", defaultCurrency: "BRL" },
  { value: "US", label: "United States", defaultLocale: "en-US", defaultCurrency: "USD" },
  { value: "ES", label: "España", defaultLocale: "es", defaultCurrency: "EUR" },
  { value: "OTHER", label: "Outro país", defaultLocale: "en-US", defaultCurrency: "USD" },
];

export const REGION_OPTIONS: Partial<Record<CountryCode, RegionOption[]>> = {
  BR: [
    { code: "AC", name: "Acre" },
    { code: "AL", name: "Alagoas" },
    { code: "AP", name: "Amapá" },
    { code: "AM", name: "Amazonas" },
    { code: "BA", name: "Bahia" },
    { code: "CE", name: "Ceará" },
    { code: "DF", name: "Distrito Federal" },
    { code: "ES", name: "Espírito Santo" },
    { code: "GO", name: "Goiás" },
    { code: "MA", name: "Maranhão" },
    { code: "MT", name: "Mato Grosso" },
    { code: "MS", name: "Mato Grosso do Sul" },
    { code: "MG", name: "Minas Gerais" },
    { code: "PA", name: "Pará" },
    { code: "PB", name: "Paraíba" },
    { code: "PR", name: "Paraná" },
    { code: "PE", name: "Pernambuco" },
    { code: "PI", name: "Piauí" },
    { code: "RJ", name: "Rio de Janeiro" },
    { code: "RN", name: "Rio Grande do Norte" },
    { code: "RS", name: "Rio Grande do Sul" },
    { code: "RO", name: "Rondônia" },
    { code: "RR", name: "Roraima" },
    { code: "SC", name: "Santa Catarina" },
    { code: "SP", name: "São Paulo" },
    { code: "SE", name: "Sergipe" },
    { code: "TO", name: "Tocantins" },
  ],
  US: [
    { code: "CA", name: "California" },
    { code: "FL", name: "Florida" },
    { code: "NY", name: "New York" },
    { code: "TX", name: "Texas" },
    { code: "WA", name: "Washington" },
  ],
  ES: [
    { code: "AN", name: "Andalucía" },
    { code: "CT", name: "Cataluña" },
    { code: "MD", name: "Madrid" },
    { code: "VC", name: "Comunidad Valenciana" },
  ],
};

export function normalizeCountry(value: unknown): CountryCode {
  if (value === "BR" || value === "US" || value === "ES" || value === "OTHER") return value;
  return "BR";
}

export function inferCountryFromLocale(language?: string): CountryCode {
  const normalized = String(language || "").toLowerCase();
  if (normalized.includes("pt-br")) return "BR";
  if (normalized.includes("en-us")) return "US";
  if (normalized.startsWith("es")) return "ES";
  return detectBrowserLocale(language) === "pt-BR" ?"BR" : "OTHER";
}

export function getCountryDefaults(country: CountryCode) {
  return COUNTRY_OPTIONS.find((option) => option.value === country) ?? COUNTRY_OPTIONS[0];
}

export function normalizeRegion(country: CountryCode, value: unknown) {
  const text = typeof value === "string" ?value.trim() : "";
  if (!text) return "";
  const options = REGION_OPTIONS[country] ?? [];
  if (options.length === 0) return text.slice(0, 80);
  return options.some((option) => option.code === text) ? text : "";
}
