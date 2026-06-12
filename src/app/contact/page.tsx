import Link from "next/link";
import type { Metadata } from "next";
import { Headset, LifeBuoy, Mail, MessageCircle } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const description = translate(locale, "contact.metadata.description");

  return {
    title: translate(locale, "contact.metadata.title"),
    description,
    alternates: {
      canonical: "/contact",
    },
    openGraph: {
      title: translate(locale, "contact.metadata.openGraphTitle"),
      description,
      url: "/contact",
    },
  };
}

const CONTACT_OPTIONS = [
  {
    icon: Headset,
    titleKey: "contact.options.inApp.title",
    descriptionKey: "contact.options.inApp.description",
  },
  {
    icon: Mail,
    titleKey: "contact.options.institutional.title",
    descriptionKey: "contact.options.institutional.description",
  },
  {
    icon: MessageCircle,
    titleKey: "contact.options.feedback.title",
    descriptionKey: "contact.options.feedback.description",
  },
];

export default async function ContactPage() {
  const locale = await getRequestLocale();
  const t = (key: string) => translate(locale, key);

  return (
    <div className="bg-transparent px-4 py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-3 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">{t("contact.eyebrow")}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">{t("contact.title")}</h1>
          <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
            {t("contact.description")}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {CONTACT_OPTIONS.map((item) => {
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
            <CardTitle className="flex items-center gap-2 text-foreground">
              <LifeBuoy className="h-5 w-5 text-primary" />
              {t("contact.nextStep")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href="/settings?tab=help" className="w-full sm:w-auto">
              <Button className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                {t("contact.openHelp")}
              </Button>
            </Link>
            <a href="https://weven.tech" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full rounded-xl">
                {t("contact.visitWevenTech")}
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
