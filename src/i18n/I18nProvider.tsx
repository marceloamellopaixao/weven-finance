"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, Locale, TRANSLATIONS_ENABLED, detectBrowserLocale, normalizeLocale } from "@/i18n/config";
import { translate, TranslationKey, TranslationValues } from "@/i18n/getDictionary";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, values?: TranslationValues) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function writeLocaleCookie(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function readLocaleCookie() {
  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`));

  return match ? normalizeLocale(decodeURIComponent(match.split("=").slice(1).join("="))) : null;
}

function readInitialLocale() {
  if (!TRANSLATIONS_ENABLED) return DEFAULT_LOCALE;
  const cookieLocale = readLocaleCookie();
  if (cookieLocale) {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, cookieLocale);
    return cookieLocale;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    const storedLocale = normalizeLocale(stored);
    writeLocaleCookie(storedLocale);
    return storedLocale;
  }

  const detected = detectBrowserLocale(window.navigator.language);
  window.localStorage.setItem(LOCALE_STORAGE_KEY, detected);
  writeLocaleCookie(detected);
  return detected;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  const setLocale = useCallback((nextLocale: Locale) => {
    const normalized = TRANSLATIONS_ENABLED ? normalizeLocale(nextLocale) : DEFAULT_LOCALE;
    setLocaleState(normalized);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, normalized);
      writeLocaleCookie(normalized);
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
