import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { supabaseSelect, supabaseSelectPaged } from "@/services/supabase/admin";

type StaffRole = "admin" | "moderator" | "support" | "client";

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const rows = await supabaseSelect("profiles", { filters: { uid: decoded.uid }, limit: 1 });
  if (rows.length === 0) throw new Error("user_not_found");
  const row = rows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const role = String(row.role || raw.role || "client") as StaffRole;
  return { uid: decoded.uid, role };
}

function isStaff(role: StaffRole) {
  return role === "admin" || role === "moderator" || role === "support";
}

function escapeIlike(value: string) {
  return String(value || "")
    .replaceAll("%", "")
    .replaceAll(",", " ")
    .replaceAll("(", " ")
    .replaceAll(")", " ")
    .trim();
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:admin-audit:get", max: 80, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    if (!isStaff(auth.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const page = Math.max(Number(request.nextUrl.searchParams.get("page") || "1"), 1);
    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || "20"), 1), 100);
    const action = request.nextUrl.searchParams.get("action")?.trim();
    const actorUid = request.nextUrl.searchParams.get("actorUid")?.trim();
    const targetUid = request.nextUrl.searchParams.get("targetUid")?.trim();
    const from = request.nextUrl.searchParams.get("from")?.trim();
    const to = request.nextUrl.searchParams.get("to")?.trim();
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();

    const filters: Record<string, string | undefined> = {};
    const conditions: Record<string, string | string[]> = {};
    if (action) filters.action = action;
    if (actorUid) filters.actor_uid = actorUid;
    if (targetUid) filters.target_uid = targetUid;
    if (from || to) {
      const dateConditions: string[] = [];
      if (from) dateConditions.push(`gte.${from}T00:00:00.000Z`);
      if (to) dateConditions.push(`lte.${to}T23:59:59.999Z`);
      conditions.created_at = dateConditions;
    }

    const safeQ = escapeIlike(q || "");
    const or = safeQ
      ? `action.ilike.*${safeQ}*,actor_uid.ilike.*${safeQ}*,target_uid.ilike.*${safeQ}*,route.ilike.*${safeQ}*,method.ilike.*${safeQ}*`
      : undefined;

    const paged = await supabaseSelectPaged("admin_audit_logs", {
      select: "id,actor_uid,action,target_uid,request_id,route,method,ip,user_agent,details,created_at",
      order: "created_at.desc.nullslast",
      page,
      limit,
      filters,
      conditions,
      or,
    });

    const data = paged.data.map((row) => ({
      id: String(row.id || ""),
      actorUid: String(row.actor_uid || ""),
      action: String(row.action || ""),
      targetUid: row.target_uid ? String(row.target_uid) : null,
      requestId: row.request_id ? String(row.request_id) : null,
      route: row.route ? String(row.route) : null,
      method: row.method ? String(row.method) : null,
      ip: row.ip ? String(row.ip) : null,
      userAgent: row.user_agent ? String(row.user_agent) : null,
      details: (row.details as Record<string, unknown> | null) ?? {},
      createdAt: row.created_at ? String(row.created_at) : null,
    }));

    return NextResponse.json({ ok: true, page, limit, total: paged.total, data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "admin_audit_logs_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
