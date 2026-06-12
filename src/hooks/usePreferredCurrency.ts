"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { getDefaultCurrencyForLocale, normalizeCurrency, type CurrencyCode } from "@/lib/money/formatMoney";
import { subscribeToUserSettings } from "@/services/transactionService";

export function usePreferredCurrency() {
  const { user } = useAuth();
  const { locale } = useI18n();
  const [currency, setCurrency] = useState<CurrencyCode>(() => getDefaultCurrencyForLocale(locale));

  useEffect(() => {
    setCurrency(getDefaultCurrencyForLocale(locale));
  }, [locale]);

  useEffect(() => {
    if (!user) return;

    return subscribeToUserSettings(
      user.uid,
      (settings) => {
        setCurrency(normalizeCurrency(settings.currency ?? getDefaultCurrencyForLocale(settings.locale ?? locale)));
      },
      () => {
        setCurrency(getDefaultCurrencyForLocale(locale));
      },
    );
  }, [locale, user]);

  return currency;
}
