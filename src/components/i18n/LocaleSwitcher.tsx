"use client";

import { Globe2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n/I18nProvider";
import { LOCALE_LABELS, Locale } from "@/i18n/config";

type LocaleSwitcherProps = {
  className?: string;
};

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale } = useI18n();

  return (
    <div className={className}>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" aria-label="Idioma" className="h-9 rounded-full border-border/70 bg-background/70 px-3 text-xs">
            <Globe2 className="mr-2 h-3.5 w-3.5" />
            {LOCALE_LABELS[locale]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(LOCALE_LABELS) as Locale[]).map((option) => (
            <DropdownMenuItem key={option} onClick={() => setLocale(option)} className={locale === option ? "font-semibold text-primary" : undefined}>
              {LOCALE_LABELS[option]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
