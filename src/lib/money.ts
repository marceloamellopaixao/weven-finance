export const MAX_FINANCIAL_AMOUNT = 999999999999999.99;
const MAX_FINANCIAL_DIGITS = 17;

function clampAmount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, MAX_FINANCIAL_AMOUNT);
}

function extractDigits(value: string | number | null | undefined) {
  return String(value || "").replace(/\D/g, "").slice(0, MAX_FINANCIAL_DIGITS);
}

function splitCurrencyDigits(digits: string) {
  const safeDigits = digits || "";
  const padded = safeDigits.padStart(3, "0");
  const integerDigits = padded.slice(0, -2).replace(/^0+(?=\d)/, "") || "0";
  const cents = padded.slice(-2);
  return { integerDigits, cents };
}

export function formatCurrencyInput(value: string | number | null | undefined) {
  const digits = extractDigits(value);
  if (!digits) return "";

  const { integerDigits, cents } = splitCurrencyDigits(digits);
  const numericValue = clampAmount(Number(`${integerDigits}.${cents}`));

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function parseCurrencyInput(value: string | number | null | undefined) {
  const digits = extractDigits(value);
  if (!digits) return 0;

  const { integerDigits, cents } = splitCurrencyDigits(digits);
  return clampAmount(Number(`${integerDigits}.${cents}`));
}

export function exceedsFinancialAmount(value: string | number | null | undefined) {
  const digits = extractDigits(value);
  if (!digits) return false;

  const { integerDigits, cents } = splitCurrencyDigits(digits);
  const numericValue = Number(`${integerDigits}.${cents}`);
  return numericValue > MAX_FINANCIAL_AMOUNT;
}
