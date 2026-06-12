import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthPageShell } from "@/components/auth/AuthPageShell";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";
import { LoginClient } from "./LoginClient";

export async function generateMetadata(): Promise<Metadata> {
  const dictionary = getDictionary(await getRequestLocale());
  const metadata = dictionary.auth.login.metadata;

  return {
    title: metadata.title,
    description: metadata.description,
    icons: {
      icon: "/wevenfinance.svg",
    },
  };
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={(
        <AuthPageShell maxWidthClassName="max-w-[400px]">
          <div className="text-sm text-muted-foreground">...</div>
        </AuthPageShell>
      )}
    >
      <LoginClient />
    </Suspense>
  );
}
