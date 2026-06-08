import type { Metadata } from "next";

import { AccountProfileClient } from "./AccountProfileClient";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.accountProfile.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function AccountProfilePage() {
  return <AccountProfileClient />;
}
