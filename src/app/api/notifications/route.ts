import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { isArchivedJsonRecord } from "@/lib/account-archive/server";
import { supabaseDeleteByFilters, supabaseSelect, supabaseSelectPaged, supabaseUpsertRows } from "@/services/supabase/admin";

type NotificationItem = {
  id: string;
  uid: string;
  kind: string;
  title: string;
  message: string;
  href: string | null;
  isRead: boolean;
  createdAt: string | null;
};

function isMissingNotificationsTableError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.message.includes("notifications") && (error.message.includes("42P01") || error.message.includes("does not exist"));
}

function toNotification(row: Record<string, unknown>): NotificationItem {
  return {
    id: String(row.id || ""),
    uid: String(row.uid || ""),
    kind: String(row.kind || "system"),
    title: String(row.title || ""),
    message: String(row.message || ""),
    href: typeof row.href === "string" ? row.href : null,
    isRead: Boolean(row.is_read),
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:notifications:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || "20")));
    let rows: Array<Record<string, unknown>> = [];
    let total = 0;
    let unreadCount = 0;
    try {
      const paged = await supabaseSelectPaged("notifications", {
        select: "id,uid,kind,title,message,href,is_read,created_at",
        filters: { uid },
        order: "created_at.desc.nullslast",
        page,
        limit,
      });
      rows = paged.data;
      total = paged.total;

      const unreadPaged = await supabaseSelectPaged("notifications", {
        select: "id",
        filters: { uid, is_read: false },
        page: 1,
        limit: 1,
      });
      unreadCount = unreadPaged.total;
    } catch (error) {
      if (!isMissingNotificationsTableError(error)) throw error;
      rows = [];
      total = 0;
      unreadCount = 0;
    }

    const items = rows.filter((row) => !isArchivedJsonRecord(row, "meta")).map(toNotification);

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, items, unreadCount, total, page, limit }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "notifications_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:notifications:patch", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;
    const body = (await request.json()) as { id?: string; markAllRead?: boolean };

    let rows: Array<Record<string, unknown>> = [];
    try {
      rows = await supabaseSelect("notifications", {
        select: "id,uid,kind,title,message,href,is_read,meta,created_at",
        filters: { uid },
        order: "created_at.desc.nullslast",
        limit: 100,
      });
    } catch (error) {
      if (!isMissingNotificationsTableError(error)) throw error;
      rows = [];
    }

    const visibleRows = rows.filter((row) => !isArchivedJsonRecord(row, "meta"));
    const targetRows = body.markAllRead
      ? visibleRows.filter((row) => !Boolean(row.is_read))
      : visibleRows.filter((row) => String(row.id || "") === String(body.id || "").trim());

    if (targetRows.length > 0) {
      const now = new Date().toISOString();
      await supabaseUpsertRows(
        "notifications",
        targetRows.map((row) => ({
          id: String(row.id || ""),
          uid,
          kind: String(row.kind || "system"),
          title: String(row.title || ""),
          message: String(row.message || ""),
          href: typeof row.href === "string" ? row.href : null,
          is_read: true,
          meta: (row.meta as Record<string, unknown> | null) ?? {},
          created_at: row.created_at,
          updated_at: now,
        })),
        { onConflict: "id" }
      );
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true, updated: targetRows.length }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "notifications_patch_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  let uid: string | null = null;
  try {
    const rate = await checkRateLimit(request, { key: "api:notifications:delete", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    await verifyRequestAuth(request);
    const acting = await resolveActingContext(request);
    uid = acting.actingUid;

    try {
      await supabaseDeleteByFilters("notifications", { uid });
    } catch (error) {
      if (!isMissingNotificationsTableError(error)) throw error;
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : 500;
    apiLogger.error({
      message: "notifications_delete_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { uid, error: message },
    });
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
