import type { Metadata } from "next";
import { Database, EyeOff, Lock, ShieldCheck } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { translate } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const description = translate(locale, "security.metadata.description");

  return {
    title: translate(locale, "security.metadata.title"),
    description,
    alternates: {
      canonical: "/security",
    },
    openGraph: {
      title: translate(locale, "security.metadata.openGraphTitle"),
      description,
      url: "/security",
    },
  };
}

const ITEMS = [
  {
    icon: ShieldCheck,
    titleKey: "security.items.layered.title",
    descriptionKey: "security.items.layered.description",
  },
  {
    icon: Lock,
    titleKey: "security.items.accountAccess.title",
    descriptionKey: "security.items.accountAccess.description",
  },
  {
    icon: EyeOff,
    titleKey: "security.items.privacy.title",
    descriptionKey: "security.items.privacy.description",
  },
  {
    icon: Database,
    titleKey: "security.items.storage.title",
    descriptionKey: "security.items.storage.description",
  },
];

export default async function SecurityPage() {
  const locale = await getRequestLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{t("security.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">{t("security.title")}</h1>
          <p className="mx-auto max-w-3xl text-base leading-7 text-muted-foreground">
            {t("security.description")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.titleKey} className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-foreground">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    {t(item.titleKey)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm leading-6 text-muted-foreground">
                    {t(item.descriptionKey)}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="app-panel-soft rounded-3xl border-color:var(--app-panel-border) shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">{t("security.important.title")}</CardTitle>
            <CardDescription className="text-muted-foreground">
              {t("security.important.description")}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
