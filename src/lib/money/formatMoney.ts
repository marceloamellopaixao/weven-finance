import { Locale, normalizeLocale } from "@/i18n/config";
import { MAX_FINANCIAL_AMOUNT } from "@/lib/money";
import { BillingCurrency } from "@/types/billing";

export type CurrencyCode = BillingCurrency;

export type MoneyConfig = {
  currency: CurrencyCode;
  locale: Locale;
};

const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  BRL: "R$",
  USD: "$",
  EUR: "€",
};

export const SUPPORTED_CURRENCIES = ["BRL", "USD", "EUR"] as const;

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && SUPPORTED_CURRENCIES.includes(value as CurrencyCode);
}

export function normalizeCurrency(value: unknown): CurrencyCode {
  return isSupportedCurrency(value) ? value : "BRL";
}

export function getDefaultCurrencyForLocale(locale: Locale): CurrencyCode {
  const normalizedLocale = normalizeLocale(locale);
  if (normalizedLocale === "en-US") return "USD";
  if (normalizedLocale === "es") return "EUR";
  return "BRL";
}

export function formatMoney(value: number | null | undefined, currency: CurrencyCode = "BRL", locale: Locale = "pt-BR") {
  const amount = normalizeMoneyValue(value);
  return new Intl.NumberFormat(normalizeLocale(locale), {
    style: "currency",
    currency: normalizeCurrency(currency),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function getCurrencySymbol(currency: CurrencyCode) {
  return CURRENCY_SYMBOLS[normalizeCurrency(currency)];
}

export function normalizeMoneyValue(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), MAX_FINANCIAL_AMOUNT);
}

export function parseMoneyInput(value: string | number | null | undefined, locale: Locale = "pt-BR") {
  if (typeof value === "number") return normalizeMoneyValue(value);

  const text = String(value || "").trim();
  if (!text) return 0;

  const normalizedLocale = normalizeLocale(locale);
  const separators =
    normalizedLocale === "en-US"
      ? { decimal: ".", group: "," }
      : { decimal: ",", group: "." };

  const normalized = text
    .replace(new RegExp(`\\${separators.group}`, "g"), "")
    .replace(separators.decimal, ".")
    .replace(/[^\d.]/g, "");

  return normalizeMoneyValue(Number(normalized));
}
