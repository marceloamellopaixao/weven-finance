import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";

import { DashboardClient } from "./DashboardClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.dashboard.metadata.title,
    description: dictionary.dashboard.metadata.description,
  };
}

export default function DashboardPage() {
  return <DashboardClient />;
}
