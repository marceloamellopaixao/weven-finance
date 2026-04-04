import { NextRequest, NextResponse } from "next/server";
import { ensureImpersonationWriteApproval, resolveActingContext } from "@/lib/impersonation/server";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:profile-me:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const rows = await supabaseSelect("profiles", {
      filters: { uid },
      limit: 1,
    });
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, profile: null }, { status: 200 });
    }
    const row = rows[0];
    const raw = (row.raw as Record<string, unknown> | null) ?? {};
    const authProviders = Array.isArray(raw.authProviders)
      ? raw.authProviders.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json(
      {
        ok: true,
        profile: {
          uid,
          email: row.email ?? raw.email ?? "",
          displayName: row.display_name ?? raw.displayName ?? raw.completeName ?? "Usuário",
          completeName: row.complete_name ?? raw.completeName ?? "",
          phone: row.phone ?? raw.phone ?? "",
          photoURL: row.photo_url ?? raw.photoURL ?? "",
          role: row.role ?? raw.role ?? "client",
          plan: row.plan ?? raw.plan ?? "free",
          status: row.status ?? raw.status ?? "active",
          blockReason: row.block_reason ?? raw.blockReason ?? "",
          paymentStatus: row.payment_status ?? raw.paymentStatus ?? "pending",
          transactionCount: row.transaction_count ?? raw.transactionCount ?? 0,
          billing: row.billing ?? raw.billing ?? {},
          verifiedEmail: row.verified_email ?? raw.verifiedEmail ?? false,
          authProviders,
          needsPasswordSetup: raw.needsPasswordSetup ?? false,
          deletedAt: row.deleted_at ?? raw.deletedAt ?? undefined,
          createdAt: row.created_at ?? raw.createdAt ?? new Date().toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    apiLogger.error({
      message: "profile_me_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:profile-me:put", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const approval = await ensureImpersonationWriteApproval({
      request,
      acting,
      actionType: "profile:update",
      actionLabel: "Editar perfil do usuario",
    });
    if (!approval.allowed) {
      return NextResponse.json({ ok: false, error: "impersonation_write_confirmation_required", actionRequestId: approval.actionRequestId }, { status: 409 });
    }

    const body = (await request.json()) as {
      displayName?: string;
      completeName?: string;
      phone?: string;
    };
    const existing = await supabaseSelect("profiles", { filters: { uid }, limit: 1 });
    const raw = ((existing[0]?.raw as Record<string, unknown> | undefined) || {});
    raw.displayName = body.displayName ?? "";
    raw.completeName = body.completeName ?? "";
    raw.phone = body.phone ?? "";

    await supabaseUpsertRows(
      "profiles",
      [
        {
          uid,
          display_name: body.displayName ?? "",
          complete_name: body.completeName ?? "",
          phone: body.phone ?? "",
          raw,
        },
      ],
      { onConflict: "uid" }
    );
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = resolveApiErrorStatus(message);
    apiLogger.error({
      message: "profile_me_put_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}


