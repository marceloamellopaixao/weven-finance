"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AppDock } from "@/components/layout/AppDock";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

const MARKETING_ROUTES = new Set(["/", "/contact", "/security", "/terms"]);
const AUTH_ROUTES = new Set([
  "/login",
  "/register",
  "/forgot-password",
  "/first-access",
  "/verify-email",
  "/goodbye",
  "/blocked",
]);

function isAuthRoute(pathname: string) {
  return AUTH_ROUTES.has(pathname);
}

function isBillingRoute(pathname: string) {
  return pathname.startsWith("/billing");
}

type AppChromeProps = {
  children: ReactNode;
};

export function AppChrome({ children }: AppChromeProps) {
  const pathname = usePathname() || "/";
  const isMarketingRoute = MARKETING_ROUTES.has(pathname);
  const isAuthLikeRoute = isAuthRoute(pathname) || isBillingRoute(pathname);
  const showFooter = isMarketingRoute;
  const showDock = !isMarketingRoute && !isAuthLikeRoute;

  return (
    <div className="app-shell flex min-h-100svh flex-col overflow-x-hidden bg-background font-sans transition-all duration-800">
      <Header />
      <main className={showDock ? "min-w-0 flex-1 pb-[calc(env(safe-area-inset-bottom)+6.75rem)] md:pb-28" : "min-w-0 flex-1"}>
        {children}
      </main>
      {showFooter ? <Footer /> : null}
      {showDock ? <AppDock /> : null}
    </div>
  );
}
