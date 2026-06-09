import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";
import { AppsClient } from "./AppsClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.apps.metadata.title,
    description: dictionary.apps.metadata.description,
  };
}

export default function AppsPage() {
  return <AppsClient />;
}
