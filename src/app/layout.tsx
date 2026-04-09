import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/hooks/useAuth";
import { PlatformExperienceProvider } from "@/hooks/usePlatformExperience";
import { Header } from "@/components/layout/Header";
import { BlockedGuard } from "@/components/guards/BlockedGuard";
import { ToastContainer } from "react-toastify";
import { Footer } from "@/components/layout/Footer";
import { ImpersonationConsentModal } from "@/components/impersonation/ImpersonationConsentModal";
import { ImpersonationActionApprovalModal } from "@/components/impersonation/ImpersonationActionApprovalModal";
import { AppDock, AppDockSpacer } from "@/components/layout/AppDock";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WevenFinance | Gerenciamento Financeiro",
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
          <PlatformExperienceProvider>
            <BlockedGuard>
              <div className="min-h-screen bg-zinc-200 dark:bg-zinc-950 font-sans transition-all duration-800 flex flex-col">
                <Header />
                <main className="flex-1">
                  {children}
                  <AppDockSpacer />
                  <ImpersonationConsentModal />
                  <ImpersonationActionApprovalModal />
                  <div aria-live="polite" aria-atomic="true">
                    <ToastContainer
                      position="top-right"
                      autoClose={3000}
                      hideProgressBar={false}
                      newestOnTop={false}
                      closeOnClick
                      rtl={false}
                      pauseOnFocusLoss
                      draggable
                      pauseOnHover
                      theme="colored"
                    />
                  </div>
                </main>
                <Footer />
                <AppDock />
              </div>
            </BlockedGuard>
          </PlatformExperienceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
