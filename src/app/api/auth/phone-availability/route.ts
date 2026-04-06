import { NextRequest, NextResponse } from "next/server";

import { resolveApiErrorStatus } from "@/lib/api/error";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { assertPhoneAvailable } from "@/lib/profile/server";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, {
      key: "api:auth:phone-availability:post",
      max: 20,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await request.json()) as { phone?: string };
    const normalizedPhone = normalizePhone(body.phone || "");
    if (!normalizedPhone) {
      return NextResponse.json({ ok: false, error: "missing_phone" }, { status: 400 });
    }

    await assertPhoneAvailable(normalizedPhone);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "phone_already_in_use" ? 409 : resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
