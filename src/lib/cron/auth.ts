import { NextRequest } from "next/server";

function extractBearer(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  return trimmed.slice(7).trim();
}

export function isValidCronRequest(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const fromHeader = request.headers.get("x-cron-secret")?.trim();
  const fromBearer = extractBearer(request.headers.get("authorization"));
  const fromQuery = request.nextUrl.searchParams.get("secret")?.trim();

  return fromHeader === secret || fromBearer === secret || fromQuery === secret;
}

