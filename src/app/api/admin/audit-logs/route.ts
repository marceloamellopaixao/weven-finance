import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { supabaseSelect } from "@/services/supabase/admin";

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

    const rows = await supabaseSelect("admin_audit_logs", {
      select: "id,actor_uid,action,target_uid,request_id,route,method,ip,user_agent,details,created_at",
      order: "created_at.desc.nullslast",
      limit: 500,
    });

    const filtered = rows.filter((row) => {
      if (action && String(row.action || "") !== action) return false;
      if (actorUid && String(row.actor_uid || "") !== actorUid) return false;
      if (targetUid && String(row.target_uid || "") !== targetUid) return false;
      if (from && typeof row.created_at === "string" && row.created_at < `${from}T00:00:00.000Z`) return false;
      if (to && typeof row.created_at === "string" && row.created_at > `${to}T23:59:59.999Z`) return false;
      if (q) {
        const blob = JSON.stringify({
          action: row.action,
          actor_uid: row.actor_uid,
          target_uid: row.target_uid,
          route: row.route,
          method: row.method,
          details: row.details,
        }).toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const data = filtered.slice(start, start + limit).map((row) => ({
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

    return NextResponse.json({ ok: true, page, limit, total, data }, { status: 200 });
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
