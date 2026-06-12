"use client";

import { useCallback } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyValue, formatDateValue, formatNumberValue } from "@/i18n/format";
import { getDefaultCurrencyForLocale, type CurrencyCode } from "@/lib/money/formatMoney";

export function useFormatters(currency?: CurrencyCode) {
  const { locale } = useI18n();
  const resolvedCurrency = currency ?? getDefaultCurrencyForLocale(locale);

  const money = useCallback(
    (value: number | null | undefined, overrideCurrency?: CurrencyCode) =>
      formatCurrencyValue(value, overrideCurrency ?? resolvedCurrency, locale),
    [locale, resolvedCurrency],
  );

  const date = useCallback(
    (value: string | number | Date, options?: Intl.DateTimeFormatOptions) =>
      formatDateValue(value, locale, options),
    [locale],
  );

  const number = useCallback(
    (value: number | null | undefined, options?: Intl.NumberFormatOptions) =>
      formatNumberValue(value, locale, options),
    [locale],
  );

  return { date, locale, money, number };
}
