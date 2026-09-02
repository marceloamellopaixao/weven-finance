import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, Locale, TRANSLATIONS_ENABLED, normalizeLocale } from "@/i18n/config";

export async function getRequestLocale(): Promise<Locale> {
  if (!TRANSLATIONS_ENABLED) return DEFAULT_LOCALE;
  try {
    const cookieStore = await cookies();
    return normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}
