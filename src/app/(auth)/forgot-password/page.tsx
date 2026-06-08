import type { Metadata } from "next";

import ForgotPasswordPage from "./ForgotPassword";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.auth.forgotPassword.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function PageForgotPassword() {
  return <ForgotPasswordPage />;
}
