import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const host = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/contact",
          "/security",
          "/terms",
          "/quanto-posso-gastar-hoje",
          "/calculadora/quanto-posso-gastar-hoje",
          "/controle-financeiro-simples",
          "/organizar-cartao-de-credito",
          "/app-para-sair-das-dividas",
        ],
        disallow: [
          "/account-context",
          "/account-profile",
          "/admin",
          "/api",
          "/apps",
          "/billing",
          "/blocked",
          "/cards",
          "/dashboard",
          "/first-access",
          "/forgot-password",
          "/goodbye",
          "/login",
          "/piggy-bank",
          "/reports",
          "/register",
          "/settings",
          "/swagger",
          "/transactions",
          "/verify-email",
        ],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  };
}
