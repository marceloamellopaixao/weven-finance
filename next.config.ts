import type { NextConfig } from "next";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION || packageJson.version,
  },
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ...(process.env.NODE_ENV === "production"
        ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
        : []),
    ];
    return [{ source: "/(.*)", headers: securityHeaders }];
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
