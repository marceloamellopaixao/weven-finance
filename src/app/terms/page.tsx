import type { Metadata } from "next";
import { AlertTriangle, CreditCard, FileText, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const description = translate(locale, "terms.metadata.description");

  return {
    title: translate(locale, "terms.metadata.title"),
    description,
    alternates: {
      canonical: "/terms",
    },
    openGraph: {
      title: translate(locale, "terms.metadata.openGraphTitle"),
      description,
      url: "/terms",
    },
  };
}

const SECTIONS = [
  {
    icon: FileText,
    titleKey: "terms.sections.platformUse.title",
    textKey: "terms.sections.platformUse.text",
  },
  {
    icon: ShieldCheck,
    titleKey: "terms.sections.accountAccess.title",
    textKey: "terms.sections.accountAccess.text",
  },
  {
    icon: CreditCard,
    titleKey: "terms.sections.billing.title",
    textKey: "terms.sections.billing.text",
  },
  {
    icon: AlertTriangle,
    titleKey: "terms.sections.availability.title",
    textKey: "terms.sections.availability.text",
  },
];

export default async function TermsPage() {
  const locale = await getRequestLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{t("terms.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">{t("terms.title")}</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            {t("terms.description")}
          </p>
        </div>

        <div className="grid gap-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.titleKey} className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {t(section.titleKey)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm leading-6 text-muted-foreground">
                  {t(section.textKey)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
