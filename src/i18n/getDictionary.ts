import { DEFAULT_LOCALE, Locale, normalizeLocale } from "@/i18n/config";
import { ptBR } from "@/i18n/dictionaries/pt-BR";
import { enUS } from "@/i18n/dictionaries/en-US";
import { es } from "@/i18n/dictionaries/es";
import type { Dictionary } from "@/i18n/dictionaries/pt-BR";

type DotPath<T> = T extends string
  ? never
  : {
      [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPath<T[K]>}`;
    }[keyof T & string];

type TranslationKey = DotPath<Dictionary>;
type TranslationValues = Record<string, string | number>;

const dictionaries: Record<Locale, Dictionary> = {
  "pt-BR": ptBR,
  "en-US": enUS,
  es,
};

export function getDictionary(locale: Locale = DEFAULT_LOCALE) {
  const normalized = normalizeLocale(locale);
  return dictionaries[normalized];
}

function resolveDictionaryValue(dictionary: Dictionary, key: string) {
  const path = key.split(".");
  let current: unknown = dictionary;

  for (const segment of path) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "string" ? current : undefined;
}

export function hasTranslationKey(key: string): key is TranslationKey {
  return resolveDictionaryValue(ptBR, key) !== undefined;
}

const PLACEHOLDER_PATTERN = /\{([a-zA-Z0-9_]+)\}/g;

function interpolate(template: string, values?: TranslationValues) {
  if (!values) return template;
  return template.replace(PLACEHOLDER_PATTERN, (match, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : match
  );
}

export function translate(locale: Locale, key: TranslationKey | string, values?: TranslationValues) {
  const dictionary = getDictionary(locale);
  const message = resolveDictionaryValue(dictionary, key) ?? resolveDictionaryValue(ptBR, key) ?? key;
  return interpolate(message, values);
}

export type { Dictionary, TranslationKey, TranslationValues };
