import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";

import { PiggyBankDetailClient } from "./PiggyBankDetailClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.piggyBank.detail.metadata.title,
    description: dictionary.piggyBank.detail.metadata.description,
  };
}

export default function PiggyBankDetailPage() {
  return <PiggyBankDetailClient />;
}
