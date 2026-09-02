import type { Metadata, Viewport } from "next";
import "./globals.css";

import { AuthProvider } from "@/hooks/useAuth";
import { PlatformExperienceProvider } from "@/hooks/usePlatformExperience";
import { BlockedGuard } from "@/components/guards/BlockedGuard";
import { ToastContainer } from "react-toastify";
import { ImpersonationConsentModal } from "@/components/impersonation/ImpersonationConsentModal";
import { ImpersonationActionApprovalModal } from "@/components/impersonation/ImpersonationActionApprovalModal";
import { AppChrome } from "@/components/layout/AppChrome";
import { WorkspaceInvitationModal } from "@/components/workspaces/WorkspaceInvitationModal";
import { I18nProvider } from "@/i18n/I18nProvider";
import { getDictionary } from "@/i18n/getDictionary";
import { getRequestLocale } from "@/i18n/server";
import { getSiteUrl, SITE_NAME } from "@/lib/site";
import { StoreProvider } from "@/store/provider";

const siteUrl = getSiteUrl();
const appearanceBootScript = `
(() => {
  try {
    const root = document.documentElement;
    const cached = window.localStorage.getItem("wevenfinance:appearance-preferences");
    const preferences = cached ? JSON.parse(cached) : {};
    const requestedTheme = ["light", "dark", "system"].includes(preferences.themeMode)
      ? preferences.themeMode
      : "system";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = requestedTheme === "system"
      ? (prefersDark ? "dark" : "light")
      : requestedTheme;
    const accents = ["violet", "indigo", "fuchsia", "emerald", "amber"];
    const accent = accents.includes(preferences.accent) ? preferences.accent : "violet";

    root.classList.toggle("dark", resolvedTheme === "dark");
    root.dataset.appTheme = requestedTheme;
    root.dataset.appResolvedTheme = resolvedTheme;
    root.dataset.appAccent = accent;
    root.style.colorScheme = resolvedTheme;
  } catch {
    const root = document.documentElement;
    const fallbackDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", fallbackDark);
    root.dataset.appTheme = "system";
    root.dataset.appResolvedTheme = fallbackDark ? "dark" : "light";
    root.dataset.appAccent = "violet";
    root.style.colorScheme = fallbackDark ? "dark" : "light";
  }
})();`;
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
        price: "29.90",
        priceCurrency: "BRL",
      },
      {
        "@type": "Offer",
        name: "Family",
        price: "39.90",
        priceCurrency: "BRL",
      },
      {
        "@type": "Offer",
        name: "Corporativo/PJ",
        price: "49.90",
        priceCurrency: "BRL",
      }
    ],
  },
];

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const dictionary = getDictionary(locale);
  const metadata = dictionary.seo.default.metadata;

  return {
    metadataBase: new URL(siteUrl),
    applicationName: SITE_NAME,
    title: {
      default: metadata.title,
      template: `%s`,
    },
    description: metadata.description,
    keywords: [...metadata.keywords],
    authors: [{ name: "Weven Tech", url: "https://weven.tech" }],
    creator: "Weven Tech",
    publisher: "Weven Tech",
    alternates: {
      canonical: "/",
      languages: {
        "pt-BR": "/",
        "en-US": "/",
        es: "/",
      },
    },
    openGraph: {
      type: "website",
      locale: locale === "pt-BR" ? "pt_BR" : locale,
      url: "/",
      siteName: SITE_NAME,
      title: metadata.title,
      description: metadata.description,
      images: [
        {
          url: "/wevenfinance.png",
          alt: "WevenFinance",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: metadata.title,
      description: metadata.description,
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
}

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
      </head>
      <body className="bg-background font-sans">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <I18nProvider>
          <StoreProvider>
            <AuthProvider>
            <PlatformExperienceProvider>
              <BlockedGuard>
                <AppChrome>
                  {children}
                  {/* Onboarding regional desativado enquanto o SaaS opera somente em pt-BR. */}
                  <ImpersonationConsentModal />
                  <ImpersonationActionApprovalModal />
                  <WorkspaceInvitationModal />
                  {/* Tradução automática preservada para uma futura retomada do i18n. */}
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
          </StoreProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
