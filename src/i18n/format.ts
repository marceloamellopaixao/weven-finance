import type { Locale } from "@/i18n/config";
import { normalizeLocale } from "@/i18n/config";
import { formatMoney } from "@/lib/money/formatMoney";
import type { CurrencyCode } from "@/lib/money/formatMoney";

export function formatCurrencyValue(
  value: number | null | undefined,
  currency: CurrencyCode,
  locale: Locale,
) {
  return formatMoney(value, currency, locale);
}

export function formatDateValue(
  value: string | number | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" },
) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(normalizeLocale(locale), options).format(date);
}

export function formatNumberValue(
  value: number | null | undefined,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
) {
  const numericValue = Number.isFinite(value) ? Number(value) : 0;
  return new Intl.NumberFormat(normalizeLocale(locale), options).format(numericValue);
}
