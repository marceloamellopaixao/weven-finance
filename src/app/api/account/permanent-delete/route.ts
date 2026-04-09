import { NextRequest, NextResponse } from "next/server";

import { verifyRequestAuth } from "@/lib/auth/server";
import { permanentlyDeleteUserData } from "@/lib/account-archive/server";
import { getRequestMeta } from "@/lib/api/request-meta";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { readSecureProfilePayload } from "@/lib/secure-store/profile";
import { deleteSupabaseAuthUser, isUuid, resolveSupabaseAuthUserId } from "@/services/supabase/service-client";
import { supabaseSelect } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;

  try {
    const rate = await checkRateLimit(request, { key: "api:account-permanent-delete:post", max: 3, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await verifyRequestAuth(request);
    uid = auth.uid;

    const profileRows = await supabaseSelect("profiles", {
      select: "uid,email,status,raw",
      filters: { uid },
      limit: 1,
    });

    if (profileRows.length === 0) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const profile = profileRows[0];
    const raw = readSecureProfilePayload(profile.raw);
    const status = String(profile.status || raw.status || "active");
    if (status !== "deleted") {
      return NextResponse.json({ ok: false, error: "account_not_deleted" }, { status: 409 });
    }

    const email = String(profile.email || raw.email || auth.email || "").trim().toLowerCase();
    const rawAuthUserId = typeof raw.authUserId === "string" && isUuid(raw.authUserId) ? raw.authUserId : null;
    const authUserId =
      rawAuthUserId ||
      (await resolveSupabaseAuthUserId({ rawUid: auth.rawUid, uid, email }));

    await permanentlyDeleteUserData(uid, { email });

    if (authUserId) {
      await deleteSupabaseAuthUser(authUserId);
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "account_permanent_delete_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
