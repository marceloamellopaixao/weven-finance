import { NextRequest, NextResponse } from "next/server";

import { resetUserFinancialData } from "@/lib/account-data/reset.server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { getRequestMeta } from "@/lib/api/request-meta";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { verifyRequestAuth } from "@/lib/auth/server";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { apiLogger } from "@/lib/observability/logger";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  let uid: string | null = null;

  try {
    const auth = await verifyRequestAuth(request);
    uid = auth.uid;
    const rate = await checkRateLimit(request, {
      key: "api:account-reset-data:post",
      max: 3,
      windowMs: 60 * 60 * 1000,
      identity: { userId: uid, tenantId: uid },
      critical: true,
    });
    if (!rate.allowed) return rateLimitResponse(rate);

    if (request.headers.has("x-impersonate-uid")) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const { data: factors, error: factorsError } = await getSupabaseServiceClient().auth.admin.mfa.listFactors({
      userId: auth.rawUid,
    });
    if (factorsError) throw new Error("auth_service_unavailable");
    if (factors.factors.some((factor) => factor.status === "verified") && auth.aal !== "aal2") {
      throw new Error("mfa_required");
    }

    const body = (await request.json()) as { confirmation?: unknown };
    if (body.confirmation !== "RESETAR") {
      return NextResponse.json({ ok: false, error: "invalid_confirmation" }, { status: 400 });
    }

    const deleted = await resetUserFinancialData(uid);
    await writeAdminAuditLog({
      actorUid: uid,
      action: "account.financial_data.reset",
      targetUid: uid,
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: { deletedTransactions: deleted },
    });

    return NextResponse.json({ ok: true, deleted }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "account_reset_data_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      uid: uid || undefined,
      meta: { error: message },
    });
    return NextResponse.json({ ok: false, error: message }, { status: resolveApiErrorStatus(message) });
  }
}
