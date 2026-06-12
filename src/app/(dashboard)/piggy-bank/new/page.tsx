import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";

import { NewPiggyBankClient } from "./NewPiggyBankClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.piggyBank.new.metadata.title,
    description: dictionary.piggyBank.new.metadata.description,
  };
}

export default function NewPiggyBankPage() {
  return <NewPiggyBankClient />;
}
