export const SUPPORTED_LOCALES = ["pt-BR", "en-US", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";
// Traduções ficam preservadas para a próxima etapa do produto, mas o SaaS opera
// somente em português enquanto a experiência multilíngue não estiver concluída.
export const TRANSLATIONS_ENABLED = false;
export const LOCALE_COOKIE_NAME = "wevenfinance-locale";
export const LOCALE_STORAGE_KEY = "wevenfinance:locale:v1";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português Brasil",
  "en-US": "English",
  es: "Español",
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  if (!TRANSLATIONS_ENABLED) return DEFAULT_LOCALE;
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function detectBrowserLocale(language?: string): Locale {
  if (!TRANSLATIONS_ENABLED) return DEFAULT_LOCALE;
  const candidate = String(language || "").toLowerCase();
  if (candidate.startsWith("en")) return "en-US";
  if (candidate.startsWith("es")) return "es";
  return DEFAULT_LOCALE;
}
