import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";
import { RegisterClient } from "./RegisterClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.auth.register.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={(
        <AuthPageShell maxWidthClassName="max-w-[440px]">
          <div className="text-sm text-muted-foreground">...</div>
        </AuthPageShell>
      )}
    >
      <RegisterClient />
    </Suspense>
  );
}
