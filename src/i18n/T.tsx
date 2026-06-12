"use client";

import type { ReactNode } from "react";
import { useCallback } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/getDictionary";
import { hasTranslationKey } from "@/i18n/getDictionary";
import { translateUiText } from "@/i18n/uiText";

type TranslationValues = Record<string, ReactNode>;

type TProps = {
  text?: string;
  i18nKey?: TranslationKey | string;
  values?: TranslationValues;
  className?: string;
};

function interpolate(template: string, values?: TranslationValues): ReactNode {
  if (!values) return template;

  const parts = template.split(/(\{[a-zA-Z0-9_]+\})/g);
  return parts.map((part, index) => {
    const match = part.match(/^\{([a-zA-Z0-9_]+)\}$/);
    if (!match) return part;

    const value = values[match[1]];
    return value === undefined ? part : <span key={`${match[1]}-${index}`}>{value}</span>;
  });
}

export function T({ text, i18nKey, values, className }: TProps) {
  const { locale, t } = useI18n();
  const source = i18nKey ?? text ?? "";
  const translated = interpolate(i18nKey ? t(i18nKey) : translateUiText(locale, source), values);

  if (className) {
    return <span className={className}>{translated}</span>;
  }

  return <>{translated}</>;
}

export function useUiText() {
  const { locale, t } = useI18n();

  return useCallback((text: string, values?: Record<string, string | number>) => {
    if (hasTranslationKey(text)) return t(text, values);

    const translated = translateUiText(locale, text);
    if (!values) return translated;

    return Object.entries(values).reduce(
      (current, [key, value]) => current.replaceAll(`{${key}}`, String(value)),
      translated,
    );
  }, [locale, t]);
}

export function useTranslations(namespace?: string) {
  const { t } = useI18n();

  return useCallback((key: string, values?: Record<string, string | number>) => {
    const fullKey = namespace ? `${namespace}.${key}` : key;
    return t(fullKey, values);
  }, [namespace, t]);
}
