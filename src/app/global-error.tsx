"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE_NAME, LOCALE_STORAGE_KEY, TRANSLATIONS_ENABLED, type Locale, normalizeLocale } from "@/i18n/config";
import { translate } from "@/i18n/getDictionary";

function getClientLocale(): Locale {
  if (!TRANSLATIONS_ENABLED || typeof document === "undefined") return DEFAULT_LOCALE;

  const cookieLocale = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

  if (cookieLocale) return normalizeLocale(decodeURIComponent(cookieLocale));

  try {
    return normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [locale] = useState<Locale>(() => getClientLocale());
  const title = translate(locale, "errors.global.title");
  const description = translate(locale, "errors.global.description");
  const retry = translate(locale, "errors.global.retry");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang={locale}>
      <body>
        <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-6">
          <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4 text-center">
            <h1 className="text-xl font-bold text-zinc-900">{title}</h1>
            <p className="text-sm text-zinc-600">
              {description}
            </p>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-700"
            >
              {retry}
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
