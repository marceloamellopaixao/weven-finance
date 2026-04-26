import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const host = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/contact", "/security", "/terms"],
        disallow: [
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
