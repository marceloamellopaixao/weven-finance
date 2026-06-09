import type { Metadata } from "next";

import AdminClient from "./AdminClient";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.admin.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function AdminPage() {
  return <AdminClient />;
}
