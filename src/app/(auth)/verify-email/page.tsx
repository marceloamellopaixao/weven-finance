import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";
import { VerifyEmailClient } from "./VerifyEmailClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.auth.verifyEmail.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
