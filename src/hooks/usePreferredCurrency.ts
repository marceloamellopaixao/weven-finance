"use client";
import { useI18n } from "@/i18n/I18nProvider";
import { getDefaultCurrencyForLocale, normalizeCurrency } from "@/lib/money/formatMoney";
import { useGetFinanceSettingsQuery } from "@/store/api/financeApi";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";
export function usePreferredCurrency() {
  const { user, userProfile } = useAuth();
  const { locale } = useI18n();
  const { activeWorkspaceId, activeWorkspace } = useWorkspaces();
  const userId = userProfile?.uid || user?.uid;
  const ownerId = activeWorkspace?.ownerUid || activeWorkspace?.uid || userId;
  const { data } = useGetFinanceSettingsQuery(
    { userId: userId || "", workspaceId: activeWorkspaceId || "", ownerId: ownerId || "" },
    { skip: !userId || !activeWorkspaceId },
  );
  return normalizeCurrency(data?.currency ?? getDefaultCurrencyForLocale(locale));
}
