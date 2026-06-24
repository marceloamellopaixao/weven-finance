import type { Metadata } from "next";
import { Calculator, CreditCard, Lock, ShieldCheck, Smartphone } from "lucide-react";

import { MarketingCtas } from "@/components/marketing/MarketingCtas";
import { PricingPlans } from "@/components/marketing/PricingPlans";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return {
    title: translate(locale, "seo.pages.home.metadata.title"),
    description: translate(locale, "seo.pages.home.metadata.description"),
    alternates: {
      canonical: "/",
      languages: {
        "pt-BR": "/",
        "en-US": "/",
        es: "/",
      },
    },
  };
}

const featureCards = [
  { icon: Calculator, key: "dailyLimit" },
  { icon: CreditCard, key: "cards" },
  { icon: Smartphone, key: "realLife" },
] as const;

const trustCards = [
  { icon: Lock, key: "data" },
  { icon: ShieldCheck, key: "privacy" },
  { icon: CreditCard, key: "payment" },
] as const;

export default async function LandingPage() {
  const locale = await getRequestLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="flex min-h-screen flex-col bg-transparent font-sans text-foreground selection:bg-primary/15 selection:text-foreground">
      <section className="relative overflow-hidden px-4 pb-12 pt-24 sm:px-6 sm:pb-20 sm:pt-32 lg:pb-24 lg:pt-40">
        <div className="absolute left-1/2 top-20 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

        <div className="container mx-auto max-w-4xl space-y-6 text-center sm:space-y-8">
          <Badge variant="outline" className="max-w-full whitespace-normal rounded-full border-primary/20 bg-primary/10 px-4 py-1.5 text-center text-xs font-medium leading-relaxed text-primary shadow-sm backdrop-blur-md sm:text-sm">
            {t("landing.badge")}
          </Badge>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-7xl">
            {t("landing.hero.title")}{" "}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              {t("landing.hero.highlight")}
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
            {t("landing.hero.description")}
          </p>

          <MarketingCtas variant="hero" />

          <div className="flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground sm:flex-row sm:gap-3">
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">{t("landing.chips.dailySpend")}</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">{t("landing.chips.cardsInstallments")}</span>
            <span className="rounded-full border border-color:var(--app-panel-border) bg-card/70 px-4 py-2 backdrop-blur">{t("landing.chips.goalsNoSpreadsheet")}</span>
          </div>

          <div className="group relative mx-auto mt-8 aspect-[1.45/1] max-w-5xl overflow-hidden rounded-2xl border border-color:var(--app-panel-border) bg-card/50 shadow-2xl shadow-primary/10 backdrop-blur-sm sm:mt-12 sm:aspect-video">
            <div className="absolute inset-0 z-10 bg-linear-to-t from-background via-transparent to-transparent" />
            <div className="absolute inset-4 grid grid-cols-[0.85fr_1.15fr] gap-3 opacity-70 sm:inset-6 sm:grid-cols-3 sm:gap-6">
              <div className="grid min-h-0 grid-rows-[0.8fr_0.8fr_1.2fr] gap-3 sm:col-span-1 sm:gap-4">
                <div className="min-h-0 rounded-xl border border-emerald-300/50 bg-emerald-500/15" />
                <div className="min-h-0 rounded-xl border border-red-300/40 bg-red-500/10" />
                <div className="min-h-0 rounded-xl border border-amber-300/40 bg-amber-500/10" />
              </div>
              <div className="grid min-h-0 grid-rows-[1.45fr_0.75fr] gap-3 sm:col-span-2 sm:gap-4">
                <div className="flex min-h-0 items-center justify-center rounded-xl border border-color:var(--app-panel-border) bg-muted/60 text-xs font-semibold text-primary sm:text-sm">
                  <span className="hidden sm:inline">{t("landing.preview.safeSpend")}</span>
                </div>
                <div className="min-h-0 rounded-xl border border-color:var(--app-panel-border) bg-primary/10" />
              </div>
            </div>
            <div className="absolute bottom-4 left-1/2 z-20 w-full max-w-[calc(100%-2rem)] -translate-x-1/2 sm:bottom-10 sm:w-auto sm:max-w-none">
              <p className="rounded-full border border-color:var(--app-panel-border) bg-card/80 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-md sm:px-4 sm:text-sm">
                {t("landing.preview.balanceWarning")}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border/70 bg-muted/30 py-20 sm:py-24" id="features">
        <div className="container mx-auto px-6">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-foreground md:text-4xl">{t("landing.features.title")}</h2>
            <p className="text-muted-foreground">{t("landing.features.description")}</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 md:gap-8">
            {featureCards.map(({ icon: Icon, key }) => (
              <Card key={key} className="app-panel-soft group border-color:var(--app-panel-border) shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-foreground">{t(`landing.features.${key}.title`)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="leading-relaxed text-muted-foreground">{t(`landing.features.${key}.text`)}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 sm:py-24">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Badge className="mb-3 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">{t("landing.trust.badge")}</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{t("landing.trust.title")}</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {trustCards.map(({ icon: Icon, key }) => (
              <Card key={key} className="app-panel-subtle rounded-2xl border-color:var(--app-panel-border)">
                <CardHeader>
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{t(`landing.trust.${key}.title`)}</CardTitle>
                  <CardDescription>{t(`landing.trust.${key}.text`)}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="relative px-4 py-20 sm:px-6 sm:py-24" id="pricing">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-16 space-y-4 text-center">
            <Badge className="mb-2 border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/15">{t("landing.pricing.badge")}</Badge>
            <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{t("landing.pricing.title")}</h2>
            <p className="text-lg text-muted-foreground">{t("landing.pricing.description")}</p>
          </div>

          <PricingPlans />
        </div>
      </section>
    </div>
  );
}
