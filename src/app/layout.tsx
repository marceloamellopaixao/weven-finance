import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/hooks/useAuth";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Weven Finance",
  description: "Gerenciamento financeiro",
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
          <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 font-sans transition-all duration-800">
            <Header />
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}