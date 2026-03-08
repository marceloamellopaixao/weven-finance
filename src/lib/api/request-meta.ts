import { NextRequest } from "next/server";

export function getRequestMeta(request: NextRequest) {
  const requestId =
    request.headers.get("x-request-id") ||
    request.headers.get("x-correlation-id") ||
    crypto.randomUUID();

  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip = (forwardedFor?.split(",")[0] || "unknown").trim();
  const userAgent = request.headers.get("user-agent") || "unknown";

  return {
    requestId,
    ip,
    userAgent,
    method: request.method,
    route: request.nextUrl.pathname,
  };
}
