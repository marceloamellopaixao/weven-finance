import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { findProfileByEmail } from "@/lib/profile/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, {
      key: "api:auth:password-access:post",
      max: 12,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await request.json()) as { email?: string };
    const email = String(body.email || "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: "missing_email" }, { status: 400 });
    }

    const profile = await findProfileByEmail(email);
    if (!profile) {
      return NextResponse.json({ ok: false, error: "email_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
