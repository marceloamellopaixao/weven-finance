import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";
import { CardsClient } from "./CardsClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.cards.metadata.title,
    description: dictionary.cards.metadata.description,
  };
}

export default function CardsPage() {
  return <CardsClient />;
}
