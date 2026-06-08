"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, Locale, detectBrowserLocale, normalizeLocale } from "@/i18n/config";
import { translate, TranslationKey, TranslationValues } from "@/i18n/getDictionary";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, values?: TranslationValues) => string;
};

const STORAGE_KEY = "wevenfinance:locale:v1";
const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLocale() {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored) return normalizeLocale(stored);

  const detected = detectBrowserLocale(window.navigator.language);
  window.localStorage.setItem(STORAGE_KEY, detected);
  return detected;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  const setLocale = useCallback((nextLocale: Locale) => {
    const normalized = normalizeLocale(nextLocale);
    setLocaleState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, normalized);
      document.documentElement.lang = normalized;
    }
  }, []);

  useEffect(() => {
    const initialLocale = readInitialLocale();
    document.documentElement.lang = initialLocale;
    const timeout = window.setTimeout(() => setLocaleState(initialLocale), 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key, values) => translate(locale, key, values),
    }),
    [locale, setLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
