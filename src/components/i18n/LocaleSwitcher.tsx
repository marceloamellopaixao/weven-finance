"use client";

import { Globe2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { LOCALE_LABELS, Locale } from "@/i18n/config";
import { getDefaultCurrencyForLocale } from "@/lib/money/formatMoney";
import { getUserSettings, updateUserRegionalPreferences } from "@/services/transactionService";

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, setLocale } = useI18n();
  const tLocale = useTranslations("locale");

  const handleLocaleChange = async (option: Locale) => {
    setLocale(option);
    if (user) {
      try {
        const settings = await getUserSettings(user.uid).catch(() => null);
        await updateUserRegionalPreferences(user.uid, {
          locale: option,
          currency: getDefaultCurrencyForLocale(option),
          country: settings?.country,
          region: settings?.region,
          regionConfigured: settings?.regionConfigured,
        });
      } catch {
        // A troca visual de idioma já foi aplicada. A persistência regional pode ser refeita em Configurações.
      }
    }
    router.refresh();
  };

  return (
    <div className={className}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label={tLocale("switcherLabel")} className="h-9 rounded-full border-border/70 bg-background/70 px-3 text-xs">
            <Globe2 className="mr-2 h-3.5 w-3.5" />
            {LOCALE_LABELS[locale]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((option) => (
            <DropdownMenuItem key={option} onClick={() => handleLocaleChange(option)} className={locale === option ? "font-semibold text-primary" : undefined}>
              {LOCALE_LABELS[option]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
