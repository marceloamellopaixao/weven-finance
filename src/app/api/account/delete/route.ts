import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { setArchivedStateForUserData } from "@/lib/account-archive/server";
import { computePermanentDeleteAt } from "@/lib/account-deletion/policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:account-delete:post", max: 5, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const decoded = await verifyRequestAuth(request);
    uid = decoded.uid;
    const deletedAt = new Date().toISOString();
    const permanentDeleteAt = computePermanentDeleteAt(deletedAt);

    await setArchivedStateForUserData(uid, true);

    const profileRows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    const profileRaw = ((profileRows[0]?.raw as Record<string, unknown> | undefined) ?? {});

    const billing = {
      source: "system",
      lastSyncAt: new Date().toISOString(),
      pendingPreapprovalId: null,
      pendingPlan: null,
      pendingCheckoutAt: null,
      lastError: null,
    };

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          status: "deleted",
          role: "client",
          plan: "free",
          payment_status: "canceled",
          block_reason: "Conta excluída pelo usuário",
          deleted_at: deletedAt,
          billing,
          raw: {
            ...profileRaw,
            status: "deleted",
            role: "client",
            plan: "free",
            paymentStatus: "canceled",
            blockReason: "Conta excluída pelo usuário",
            deletedAt,
            permanentDeleteAt,
            isArchived: true,
            authUserId: decoded.rawUid,
            billing,
          },
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "uid" }
    );

    await supabaseUpsertRows(
      "billing_events",
      [
        {
          id: `account_delete_${uid}_${Date.now()}`,
          uid,
          event_type: "account_delete",
          action: "self_delete",
          provider: "system",
          raw: {
            topic: "account_delete",
            action: "self_delete",
            resourceId: uid,
            uid,
            status: "processed",
            processedAt: new Date().toISOString(),
          },
          created_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "account_delete_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json(
      { ok: false, error: message },
      { status }
    );
  }
}

