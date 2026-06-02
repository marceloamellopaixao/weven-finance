import { DEFAULT_LOCALE, Locale, normalizeLocale } from "@/i18n/config";
import ptBR from "@/i18n/dictionaries/pt-BR.json";
import enUS from "@/i18n/dictionaries/en-US.json";
import es from "@/i18n/dictionaries/es.json";

type Dictionary = typeof ptBR;
type TranslationKey = keyof Dictionary;

const dictionaries: Record<Locale, Partial<Dictionary>> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  es,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE) {
  const normalized = normalizeLocale(locale);
  return dictionaries[normalized];
}

export function translate(locale: Locale, key: TranslationKey) {
  const dictionary = getDictionary(locale);
  return dictionary[key] ?? ptBR[key] ?? key;
}

export type { Dictionary, TranslationKey };
