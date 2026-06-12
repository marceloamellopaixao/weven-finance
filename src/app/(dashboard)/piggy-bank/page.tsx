import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";

import { PiggyBankClient } from "./PiggyBankClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.piggyBank.metadata.title,
    description: dictionary.piggyBank.metadata.description,
  };
}

export default function PiggyBankPage() {
  return <PiggyBankClient />;
}
