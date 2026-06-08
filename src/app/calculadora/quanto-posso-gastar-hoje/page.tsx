import type { Metadata } from "next";

import { DailyLimitCalculator } from "@/components/marketing/DailyLimitCalculator";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.dailySpendCalculator;

  return {
    title: page.metadata.title,
    description: page.metadata.description,
    alternates: { canonical: "/calculadora/quanto-posso-gastar-hoje" },
  };
}

export default async function Page() {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.dailySpendCalculator;

  return (
    <main className="bg-transparent px-4 py-16 sm:px-6 sm:py-24">
      <div className="container mx-auto max-w-5xl space-y-10">
        <section className="space-y-4 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{page.eyebrow}</p>
          <h1 className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl">
            {page.title}
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            {page.description}
          </p>
        </section>
        <DailyLimitCalculator />
      </div>
    </main>
  );
}
