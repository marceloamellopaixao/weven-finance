"use client";

import { useEffect, useMemo, useState } from "react";
import { Globe2, Loader2, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useI18n } from "@/i18n/I18nProvider";
import { Locale } from "@/i18n/config";
import { useTranslations } from "@/i18n/T";
import { CurrencyCode } from "@/lib/money/formatMoney";
import {
  COUNTRY_OPTIONS,
  CountryCode,
  REGION_OPTIONS,
  getCountryDefaults,
  inferCountryFromLocale,
} from "@/lib/region/preferences";
import { updateUserRegionalPreferences } from "@/services/transactionService";

export function RegionBootstrapModal() {
  const { user, loading } = useAuth();
  const t = useTranslations("components.regionBootstrap");
  const { settings, loading: settingsLoading } = useUserSettings();
  const { setLocale } = useI18n();
  const [country, setCountry] = useState<CountryCode>("BR");
  const [region, setRegion] = useState("");
  const [selectedLocale, setSelectedLocale] = useState<Locale>("pt-BR");
  const [currency, setCurrency] = useState<CurrencyCode>("BRL");
  const [saving, setSaving] = useState(false);
  const [savedThisSession, setSavedThisSession] = useState(false);

  const shouldOpen = Boolean(user && !loading && !settingsLoading && !settings.regionConfigured && !savedThisSession);
  const regionOptions = useMemo(() => REGION_OPTIONS[country] ?? [], [country]);

  useEffect(() => {
    if (!shouldOpen) return;
    const inferredCountry = settings.country || inferCountryFromLocale(navigator.language);
    const defaults = getCountryDefaults(inferredCountry);
    setCountry(inferredCountry);
    setRegion(settings.region || "");
    setSelectedLocale(settings.locale || defaults.defaultLocale);
    setCurrency(settings.currency || defaults.defaultCurrency);
  }, [settings.country, settings.currency, settings.locale, settings.region, shouldOpen]);

  const handleCountryChange = (value: string) => {
    const nextCountry = value as CountryCode;
    const defaults = getCountryDefaults(nextCountry);
    setCountry(nextCountry);
    setRegion("");
    setSelectedLocale(defaults.defaultLocale);
    setCurrency(defaults.defaultCurrency);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserRegionalPreferences(user.uid, {
        locale: selectedLocale,
        currency,
        country,
        region,
        regionConfigured: true,
      });
      setLocale(selectedLocale);
      setSavedThisSession(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={shouldOpen}>
      <DialogContent className="rounded-3xl border border-border/70 bg-card sm:max-w-[520px]" showCloseButton={false}>
        <DialogHeader>
          <div className="mb-2 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Globe2 className="h-5 w-5" />
          </div>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="space-y-2">
            <Label>{t("country")}</Label>
            <Select value={country} onValueChange={handleCountryChange}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{t(`countries.${option.value}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("region")}</Label>
            <Select value={region || "__none"} onValueChange={(value) => setRegion(value === "__none" ? "" : value)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("selectLater")}</SelectItem>
                {regionOptions.map((option) => (
                  <SelectItem key={option.code} value={option.code}>{option.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("language")}</Label>
              <Select value={selectedLocale} onValueChange={(value) => setSelectedLocale(value as Locale)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português Brasil</SelectItem>
                  <SelectItem value="en-US">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("currency")}</Label>
              <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">BRL</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            <div className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("currencyWarning")}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving} className="h-11 w-full rounded-xl">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("continue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
