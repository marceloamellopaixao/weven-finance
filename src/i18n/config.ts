export const SUPPORTED_LOCALES = ["pt-BR", "en-US", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt-BR";

export const LOCALE_LABELS: Record<Locale, string> = {
  "pt-BR": "Português Brasil",
  "en-US": "English",
  es: "Español",
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && SUPPORTED_LOCALES.includes(value as Locale);
}

export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function detectBrowserLocale(language?: string): Locale {
  const candidate = String(language || "").toLowerCase();
  if (candidate.startsWith("en")) return "en-US";
  if (candidate.startsWith("es")) return "es";
  return DEFAULT_LOCALE;
}
