import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { pushNotifications } from "@/lib/notifications/server";
import { encryptServerPayload } from "@/lib/secure-store/server";
import { isDeletionWindowExpired, resolvePermanentDeleteAt } from "@/lib/account-deletion/policy";
import { supabaseSelect, supabaseUpsertRows } from "@/services/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatProtocol(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `WF-${y}${m}${d}-${suffix}`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:account-restore-request:post", max: 10, windowMs: 60 * 60 * 1000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const body = (await request.json()) as {
      email?: string;
      name?: string;
      wantsData?: boolean;
      message?: string;
    };

    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim().slice(0, 80);
    const message = String(body.message || "").trim().slice(0, 1500);
    const wantsData = body.wantsData !== false;

    if (!email || !isValidEmail(email) || !name) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();
    const protocol = formatProtocol(new Date(nowIso));
    const profileRows = await supabaseSelect("profiles", {
      select: "uid,status,deleted_at,raw",
      filters: { email },
      limit: 1,
    });
    const matchedProfile = profileRows[0];
    const matchedRaw = (matchedProfile?.raw as Record<string, unknown> | null) ?? {};

    if (matchedProfile?.status && String(matchedProfile.status) !== "deleted") {
      return NextResponse.json({ ok: false, error: "account_not_deleted" }, { status: 409 });
    }

    if (matchedProfile && isDeletionWindowExpired(String(matchedProfile.deleted_at || ""), matchedRaw)) {
      return NextResponse.json({ ok: false, error: "restore_window_expired" }, { status: 410 });
    }

    const fullMessage = [
      wantsData
        ? "O usuário quer reativar a conta com os dados arquivados."
        : "O usuário quer reativar a conta sem restaurar os dados antigos.",
      message,
    ]
      .filter(Boolean)
      .join("\n\n");

    const raw: Record<string, unknown> = {
      protocol,
      type: "support",
      status: "pending",
      priority: "high",
      platform: "public_restore",
      supportKind: "account_restore",
      wantsData,
      targetUid: matchedProfile?.uid ? String(matchedProfile.uid) : null,
      targetStatus: matchedProfile?.status ? String(matchedProfile.status) : null,
      deletedAt: matchedProfile?.deleted_at ? String(matchedProfile.deleted_at) : null,
      permanentDeleteAt: resolvePermanentDeleteAt(String(matchedProfile?.deleted_at || ""), matchedRaw),
      createdAt: nowIso,
      updatedAt: nowIso,
      secureSupport: encryptServerPayload({
        email,
        name,
        message: fullMessage,
      }),
    };

    await supabaseUpsertRows("support_requests", [
      {
        id,
        uid: matchedProfile?.uid ? String(matchedProfile.uid) : null,
        email,
        name,
        title: protocol,
        message: fullMessage,
        ticket_type: "support",
        ticket_status: "pending",
        staff_seen_by: [],
        raw,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ]);

    const [admins, moderators, supports] = await Promise.all([
      supabaseSelect("profiles", { select: "uid", filters: { role: "admin" }, limit: 200 }),
      supabaseSelect("profiles", { select: "uid", filters: { role: "moderator" }, limit: 200 }),
      supabaseSelect("profiles", { select: "uid", filters: { role: "support" }, limit: 200 }),
    ]);
    const staffUids = Array.from(
      new Set([...admins, ...moderators, ...supports].map((row) => String(row.uid || "").trim()).filter(Boolean))
    );

    await pushNotifications(
      staffUids.map((staffUid) => ({
        uid: staffUid,
        kind: "support",
        title: "Pedido de restauração de conta",
        message: `${name} solicitou retorno da conta (${wantsData ? "com dados" : "sem dados"}).`,
        href: "/admin?tab=support",
        meta: { ticketId: id, protocol, supportKind: "account_restore", targetUid: matchedProfile?.uid ?? null },
      }))
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId });
    return NextResponse.json({ ok: true, protocol }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "account_restore_request_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status: 500, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
