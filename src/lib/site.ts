export const SITE_NAME = "WevenFinance";
export const DEFAULT_SITE_URL = "https://weven-finance.vercel.app";

export function getSiteUrl() {
  const value =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    DEFAULT_SITE_URL;
  const normalized = value.startsWith("http") ? value : `https://${value}`;
  return normalized.replace(/\/+$/, "");
}
