"use client";

import { useCallback } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import { formatCurrencyValue, formatDateValue, formatNumberValue } from "@/i18n/format";
import type { CurrencyCode } from "@/lib/money/formatMoney";

export function useFormatters(currency: CurrencyCode = "BRL") {
  const { locale } = useI18n();

  const money = useCallback(
    (value: number | null | undefined, overrideCurrency?: CurrencyCode) =>
      formatCurrencyValue(value, overrideCurrency ?? currency, locale),
    [currency, locale],
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
