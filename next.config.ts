import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
  },
  turbopack: {
    root: process.cwd(),
  },
  async redirects() {
    return [
      {
        source: "/account-context",
        destination: "/account-profile",
        permanent: true,
      },
      {
        source: "/controle-financeiro-simples",
        destination: "/controle-financeiro",
        permanent: true,
      },
      {
        source: "/porquinho/novo",
        destination: "/piggy-bank/new",
        permanent: true,
      },
      {
        source: "/porquinho/:slug",
        destination: "/piggy-bank/:slug",
        permanent: true,
      },
      {
        source: "/porquinho",
        destination: "/piggy-bank",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
