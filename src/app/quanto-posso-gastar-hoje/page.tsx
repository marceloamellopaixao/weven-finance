import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";
import { DEFAULT_LOCALE } from "@/i18n/config";
import { getDictionary } from "@/i18n/getDictionary";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(DEFAULT_LOCALE);
  const page = dictionary.seo.pages.dailySpend;

  return {
    title: page.metadata.title,
    description: page.metadata.description,
    alternates: { canonical: "/quanto-posso-gastar-hoje" },
  };
}

export default function Page() {
  const dictionary = getDictionary(DEFAULT_LOCALE);
  const page = dictionary.seo.pages.dailySpend;

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
