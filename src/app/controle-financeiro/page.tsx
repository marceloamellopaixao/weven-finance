import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.financialControl;

  return {
    title: page.metadata.title,
    description: page.metadata.description,
    alternates: { canonical: "/controle-financeiro" },
  };
}

export default async function Page() {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.financialControl;

  return (
    <SeoLandingPage
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
      keyword={page.keyword}
      benefits={[...page.benefits]}
      sections={[...page.sections]}
    />
  );
}
