import type { Metadata } from "next";

import { getDictionary } from "@/i18n/getDictionary";

import { ReportClient } from "./ReportClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = await getDictionary();

  return {
    title: dictionary.reports.metadata.title,
    description: dictionary.reports.metadata.description,
  };
}

export default function ReportClientPage() {
  return <ReportClient />;
}
