import type { Metadata } from "next";

import { SeoLandingPage } from "@/components/marketing/SeoLandingPage";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.creditCardOrganization;

  return {
    title: page.metadata.title,
    description: page.metadata.description,
    alternates: { canonical: "/organizar-cartao-de-credito" },
  };
}

export default async function Page() {
  const dictionary = getDictionary(await getRequestLocale());
  const page = dictionary.seo.pages.creditCardOrganization;
  const landing = dictionary.seo.landingPage;
  return (
    <SeoLandingPage
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
      keyword={page.keyword}
      benefits={[...page.benefits]}
      sections={[...page.sections]}
      primaryCta={landing.primaryCta}
      secondaryCta={landing.secondaryCta}
      finalTitle={landing.finalTitle.replace("{keyword}", page.keyword)}
      finalDescription={landing.finalDescription}
      finalCta={landing.finalCta}
    />
  );
}
