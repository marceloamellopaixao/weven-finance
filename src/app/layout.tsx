import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";
import { BlockedGuard } from "@/components/guards/BlockedGuard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Weven Finance | Gerenciamento Financeiro",
  description: "Gerenciamento financeiro pessoal e empresarial.",
  icons: {
    icon: "/wevenfinance.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <AuthProvider>
          <BlockedGuard>
            <div className="min-h-screen bg-zinc-200 dark:bg-zinc-950 font-sans transition-all duration-800 flex flex-col">
              <Header />
              <main className="flex-1">
                {children}
              </main>
            </div>
          </BlockedGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
