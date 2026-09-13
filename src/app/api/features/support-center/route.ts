import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { getSupportCenterDecision } from "@/lib/features/support-center.server";
import { getSupportAuthContext } from "@/lib/support/auth.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rate = await checkRateLimit(request, { key: "api:features:support-center", max: 60, windowMs: 60_000 });
  if (!rate.allowed) return rateLimitResponse(rate);
  try {
    await getSupportAuthContext(request, { skipFeatureGate: true });
    const decision = await getSupportCenterDecision();
    return NextResponse.json({ enabled: decision.enabled }, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 403;
    return NextResponse.json({ enabled: false }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
  }
}
