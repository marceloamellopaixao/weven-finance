import type { MetadataRoute } from "next";

import { getSiteUrl, SITE_NAME } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} - controle financeiro simples`,
    short_name: SITE_NAME,
    description: "Saiba quanto você pode gastar hoje sem comprometer o fim do mês.",
    start_url: getSiteUrl(),
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/wevenfinance.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/wevenfinance.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
