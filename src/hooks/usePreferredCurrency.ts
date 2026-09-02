"use client";
import { useI18n } from "@/i18n/I18nProvider";
import { getDefaultCurrencyForLocale, normalizeCurrency } from "@/lib/money/formatMoney";
import { useGetFinanceSettingsQuery } from "@/store/api/financeApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
export function usePreferredCurrency() {
  const { user, userProfile } = useAuth();
  const { locale } = useI18n();
  const { activeWorkspaceId } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const { data } = useGetFinanceSettingsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "" },
    { skip: !userId || !activeWorkspaceId },
  );
  return normalizeCurrency(data?.currency ?? getDefaultCurrencyForLocale(locale));
}
