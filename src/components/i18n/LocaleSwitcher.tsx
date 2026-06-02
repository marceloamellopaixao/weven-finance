"use client";

import { Globe2 } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALE_LABELS, Locale } from "@/i18n/config";

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={className}>
      <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
        <SelectTrigger aria-label="Idioma" className="h-9 rounded-full border-border/70 bg-background/70 text-xs">
          <Globe2 className="mr-2 h-3.5 w-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="pt-BR">{LOCALE_LABELS["pt-BR"]}</SelectItem>
          <SelectItem value="en-US">{LOCALE_LABELS["en-US"]}</SelectItem>
          <SelectItem value="es">{LOCALE_LABELS.es}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
