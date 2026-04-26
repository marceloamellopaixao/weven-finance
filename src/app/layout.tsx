import type { Metadata } from "next";
import type { Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { AuthProvider } from "@/hooks/useAuth";
import { PlatformExperienceProvider } from "@/hooks/usePlatformExperience";
import { BlockedGuard } from "@/components/guards/BlockedGuard";
import { ToastContainer } from "react-toastify";
import { ImpersonationConsentModal } from "@/components/impersonation/ImpersonationConsentModal";
import { ImpersonationActionApprovalModal } from "@/components/impersonation/ImpersonationActionApprovalModal";
import { AppChrome } from "@/components/layout/AppChrome";
import { getSiteUrl, SITE_NAME } from "@/lib/site";

const inter = Inter({ subsets: ["latin"] });
const siteUrl = getSiteUrl();
const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}/wevenfinance.png`,
    sameAs: [
      "https://www.instagram.com/weventech/",
      "https://www.linkedin.com/company/weventech/",
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url: siteUrl,
    image: `${siteUrl}/wevenfinance.png`,
    offers: [
      {
        "@type": "Offer",
        name: "Free",
        price: "0",
        priceCurrency: "BRL",
      },
      {
        "@type": "Offer",
        name: "Premium",
        price: "19.90",
        priceCurrency: "BRL",
      },
      {
        "@type": "Offer",
        name: "Pro",
        price: "49.90",
        priceCurrency: "BRL",
      },
    ],
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: "WevenFinance | Controle financeiro pessoal com clareza",
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Organize gastos, cartões, parcelamentos, vencimentos e metas em um painel simples para entender seu mês sem planilha e sem ansiedade.",
  keywords: [
    "controle financeiro pessoal",
    "organização financeira",
    "finanças pessoais",
    "controle de cartões",
    "parcelamentos",
    "metas financeiras",
    "WevenFinance",
  ],
  authors: [{ name: "Weven Tech", url: "https://weven.tech" }],
  creator: "Weven Tech",
  publisher: "Weven Tech",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: SITE_NAME,
    title: "WevenFinance | Controle financeiro pessoal com clareza",
    description:
      "Organize gastos, cartões, parcelamentos, vencimentos e metas em um painel simples para entender seu mês sem planilha e sem ansiedade.",
    images: [
      {
        url: "/wevenfinance.png",
        alt: "WevenFinance",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WevenFinance | Controle financeiro pessoal com clareza",
    description:
      "Organize gastos, cartões, parcelamentos, vencimentos e metas em um painel simples para entender seu mês sem planilha e sem ansiedade.",
    images: ["/wevenfinance.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: "/wevenfinance.svg",
    shortcut: "/wevenfinance.svg",
    apple: "/wevenfinance.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <AuthProvider>
          <PlatformExperienceProvider>
            <BlockedGuard>
              <AppChrome>
                {children}
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
              </AppChrome>
            </BlockedGuard>
          </PlatformExperienceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
