import { NextRequest, NextResponse } from "next/server";
import { verifyRequestAuth } from "@/lib/auth/server";
import { resolveActingContext } from "@/lib/impersonation/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { pushNotification, pushNotifications } from "@/lib/notifications/server";
import { decryptServerPayload, encryptServerPayload } from "@/lib/secure-store/server";
import { supabaseDeleteByFilters, supabaseSelect, supabaseSelectPaged, supabaseUpsertRows } from "@/services/supabase/admin";

type SupportType = "support" | "feature";
type TicketPriority = "low" | "medium" | "high" | "urgent";

const FINAL_STATUSES = new Set(["resolved", "implemented", "rejected"]);

function formatProtocol(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `WF-${y}${m}${d}-${suffix}`;
}

function inferPriority(type: SupportType, message: string): TicketPriority {
  if (type === "feature") return "low";
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(bloquead|urgente|nao consigo|nao entra|sem acesso|pagamento|cobranca|erro 500)/.test(normalized)) {
    return "high";
  }
  if (/(travando|lento|falha|bug|problema)/.test(normalized)) {
    return "medium";
  }
  return "low";
}

function computeSlaDueAt(createdAtIso: string, type: SupportType, priority: TicketPriority) {
  const createdAt = new Date(createdAtIso).getTime();
  const oneHour = 60 * 60 * 1000;
  const supportHours: Record<TicketPriority, number> = {
    urgent: 4,
    high: 8,
    medium: 24,
    low: 48,
  };
  const featureHours: Record<TicketPriority, number> = {
    urgent: 24,
    high: 48,
    medium: 72,
    low: 96,
  };
  const hours = type === "feature" ? featureHours[priority] : supportHours[priority];
  return new Date(createdAt + hours * oneHour).toISOString();
}

async function getAuthContext(request: NextRequest) {
  const decoded = await verifyRequestAuth(request);
  const acting = await resolveActingContext(request);
  const requesterRows = await supabaseSelect("profiles", {
    filters: { uid: decoded.uid },
    limit: 1,
  });
  const actingRows = await supabaseSelect("profiles", {
    filters: { uid: acting.actingUid },
    limit: 1,
  });
  if (actingRows.length === 0) throw new Error("user_not_found");
  const row = actingRows[0];
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  const requesterRoleRaw = ((requesterRows[0]?.raw as Record<string, unknown> | null) ?? {});
  const requesterRole = String(requesterRows[0]?.role || requesterRoleRaw.role || "client");
  const effectiveRole = acting.isImpersonating ? "client" : requesterRole;
  return {
    uid: acting.actingUid,
    email: String(row.email || raw.email || decoded.email || ""),
    name: String(row.display_name || raw.displayName || raw.completeName || decoded.email || "Usuário"),
    role: effectiveRole,
  };
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
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:support:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || "20")));
    const typeFilter = request.nextUrl.searchParams.get("type")?.trim();
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim();
    const priorityFilter = request.nextUrl.searchParams.get("priority")?.trim();
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    const filters: Record<string, string | undefined> = {};
    if (typeFilter && typeFilter !== "all") filters.ticket_type = typeFilter;
    if (statusFilter && statusFilter !== "all") filters.ticket_status = statusFilter;
    if (auth.role === "support") {
      filters.assigned_to = auth.uid;
    } else if (auth.role !== "admin" && auth.role !== "moderator") {
      filters.uid = auth.uid;
    }

    const baseSelect =
      "id,uid,email,name,title,message,ticket_type,ticket_status,assigned_to,assigned_to_name,staff_seen_by,votes,created_at,updated_at,raw";
    const conditions: Record<string, string> = {};
    if (priorityFilter && priorityFilter !== "all") {
      conditions.raw = `cs.${JSON.stringify({ priority: priorityFilter })}`;
    }
    const safeQ = escapeIlike(q);
    const or = safeQ
      ? `title.ilike.*${safeQ}*,message.ilike.*${safeQ}*,name.ilike.*${safeQ}*,email.ilike.*${safeQ}*`
      : undefined;
    const paged = await supabaseSelectPaged("support_requests", {
      select: baseSelect,
      order: "created_at.desc.nullslast",
      page,
      limit,
      filters,
      conditions,
      or,
    });
    const rows =
      auth.role === "admin" || auth.role === "moderator" || auth.role === "support"
        ? paged.data
        : paged.data.filter((row) => {
            const raw = (row.raw as Record<string, unknown> | null) ?? {};
            return !Boolean(raw.isArchived);
          });

    const tickets = rows
      .map((row) => {
        const raw = (row.raw as Record<string, unknown> | null) ?? {};
        const secure = decryptServerPayload<{ email?: string; name?: string; message?: string }>(raw.secureSupport) ?? {};
        return {
          id: String(row.id || ""),
          uid: String(row.uid || raw.uid || ""),
          email: String(row.email || secure.email || raw.email || ""),
          name: String(row.name || secure.name || raw.name || ""),
          protocol: String(raw.protocol || row.title || ""),
          message: String(row.message || secure.message || raw.message || ""),
          type: String(row.ticket_type || raw.type || "support"),
          supportKind: typeof raw.supportKind === "string" ? raw.supportKind : undefined,
          wantsData: typeof raw.wantsData === "boolean" ? raw.wantsData : undefined,
          status: String(row.ticket_status || raw.status || "pending"),
          priority: String(raw.priority || "medium"),
          assignedTo: row.assigned_to ?? raw.assignedTo ?? null,
          assignedToName: row.assigned_to_name ?? raw.assignedToName ?? null,
          staffSeenBy: Array.isArray(row.staff_seen_by)
            ? row.staff_seen_by
            : Array.isArray(raw.staffSeenBy)
              ? raw.staffSeenBy
              : [],
          firstResponseAt: typeof raw.firstResponseAt === "string" ? raw.firstResponseAt : null,
          resolvedAt: typeof raw.resolvedAt === "string" ? raw.resolvedAt : null,
          slaDueAt: typeof raw.slaDueAt === "string" ? raw.slaDueAt : null,
          slaBreached:
            typeof raw.slaDueAt === "string" &&
            !FINAL_STATUSES.has(String(row.ticket_status || raw.status || "pending").toLowerCase()) &&
            new Date(raw.slaDueAt).getTime() < Date.now(),
          votes: typeof row.votes === "number" ? row.votes : typeof raw.votes === "number" ? raw.votes : 0,
          platform: String(raw.platform || "web"),
          createdAt: String(row.created_at || raw.createdAt || ""),
          updatedAt: String(row.updated_at || raw.updatedAt || ""),
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const total = paged.total;
    const sliced = tickets;
    const unseenCount =
      auth.role === "admin" || auth.role === "moderator" || auth.role === "support"
        ? sliced.filter((ticket) => !Array.isArray(ticket.staffSeenBy) || !ticket.staffSeenBy.includes(auth.uid)).length
        : 0;

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, tickets: sliced, page, limit, total, unseenCount }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "support_requests_get_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:support:post", max: 40, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      type?: SupportType;
      message?: string;
      status?: string;
      platform?: string;
    };

    const type = body.type === "feature" ? "feature" : "support";
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const nowIso = new Date().toISOString();
    const id = crypto.randomUUID();
    const protocol = formatProtocol(new Date(nowIso));
    const priority = inferPriority(type, message);
    const slaDueAt = computeSlaDueAt(nowIso, type, priority);
    const raw: Record<string, unknown> = {
      uid: auth.uid,
      protocol,
      type,
      status: body.status || "pending",
      priority,
      slaDueAt,
      firstResponseAt: null,
      resolvedAt: null,
      staffSeenBy: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      platform: body.platform || "web",
      secureSupport: encryptServerPayload({
        email: auth.email,
        name: auth.name,
        message,
      }),
      ...(type === "feature" ? { votes: 0 } : {}),
    };

    await supabaseUpsertRows("support_requests", [
      {
        id,
        uid: auth.uid,
        email: auth.email,
        name: auth.name,
        title: protocol,
        message,
        ticket_type: type,
        ticket_status: body.status || "pending",
        staff_seen_by: [],
        votes: type === "feature" ? 0 : null,
        created_at: nowIso,
        updated_at: nowIso,
        raw,
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
        kind: "support" as const,
        title: type === "feature" ? "Nova ideia recebida" : "Novo chamado de suporte",
        message: `${auth.name} abriu uma nova solicitação.`,
        href: "/admin?tab=support",
        meta: { ticketId: id, ticketType: type, fromUid: auth.uid },
      }))
    );

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, id, protocol }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "support_requests_post_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:support:patch", max: 80, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    const body = (await request.json()) as {
      action?: "markSeen";
      ticketIds?: string[];
      ticketId?: string;
      updates?: Record<string, unknown>;
    };

    const allRows = await supabaseSelect("support_requests", {
      select: "id,uid,assigned_to,assigned_to_name,staff_seen_by,raw,ticket_status",
    });

    if (body.action === "markSeen") {
      if (auth.role !== "admin" && auth.role !== "moderator" && auth.role !== "support") {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }
      const ids = Array.isArray(body.ticketIds)
        ? body.ticketIds.map((id) => String(id || "").trim()).filter(Boolean)
        : [];
      if (ids.length === 0) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return NextResponse.json({ ok: true, updated: 0 }, { status: 200 });
      }

      const upserts: Array<Record<string, unknown>> = [];
      for (const id of ids) {
        const row = allRows.find((entry) => String(entry.id || "") === id);
        if (!row) continue;
        const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
        const seen = Array.isArray(row.staff_seen_by)
          ? row.staff_seen_by.map((item) => String(item))
          : Array.isArray(raw.staffSeenBy)
            ? raw.staffSeenBy.map((item) => String(item))
            : [];
        if (!seen.includes(auth.uid)) seen.push(auth.uid);
        raw.staffSeenBy = seen;

        upserts.push({
          id,
          staff_seen_by: seen,
          raw,
          updated_at: new Date().toISOString(),
        });
      }

      if (upserts.length > 0) {
        await supabaseUpsertRows("support_requests", upserts, { onConflict: "id" });
      }
      await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
      return NextResponse.json({ ok: true, updated: upserts.length }, { status: 200 });
    }

    const ticketId = body.ticketId?.trim();
    if (!ticketId || !body.updates) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const row = allRows.find((entry) => String(entry.id || "") === ticketId);
    if (!row) {
      return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    }

    const ticketData = {
      uid: String(row.uid || ""),
      assignedTo: row.assigned_to ? String(row.assigned_to) : "",
    };

    const isManager = auth.role === "admin" || auth.role === "moderator";
    const isSupportSelfAssignment =
      auth.role === "support" &&
      (ticketData.assignedTo === auth.uid || body.updates.assignedTo === auth.uid);
    const isOwner = ticketData.uid === auth.uid;

    if (!isManager && !isSupportSelfAssignment && !isOwner) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...raw, ...body.updates, updatedAt: new Date().toISOString() };
    const nextStatus = String(merged["status"] || row["ticket_status"] || raw.status || "").toLowerCase();

    if (!raw.firstResponseAt && (nextStatus === "in_progress" || FINAL_STATUSES.has(nextStatus))) {
      merged.firstResponseAt = new Date().toISOString();
    }
    if (FINAL_STATUSES.has(nextStatus)) {
      merged.resolvedAt = new Date().toISOString();
    } else {
      merged.resolvedAt = null;
    }

    await supabaseUpsertRows(
      "support_requests",
      [
        {
          id: ticketId,
          assigned_to: merged["assignedTo"] ?? row.assigned_to ?? null,
          assigned_to_name: merged["assignedToName"] ?? row.assigned_to_name ?? null,
          ticket_status: merged["status"] ?? null,
          raw: merged,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: "id" }
    );

    if (FINAL_STATUSES.has(nextStatus) && ticketData.uid) {
      const protocol = typeof merged.protocol === "string" ? merged.protocol : `#${ticketId.slice(0, 8)}`;
      const statusLabel =
        nextStatus === "resolved"
          ? "Resolvido"
          : nextStatus === "implemented"
            ? "Implementado"
            : "Rejeitado";
      await pushNotification({
        uid: ticketData.uid,
        kind: "support",
        title: `Protocolo ${protocol} finalizado`,
        message: `Seu chamado foi finalizado com status: ${statusLabel}.`,
        href: "/settings?tab=help",
        meta: { ticketId, status: nextStatus, protocol },
      });
    }

    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "support_requests_patch_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  const startedAt = Date.now();
  try {
    const rate = await checkRateLimit(request, { key: "api:support:delete", max: 30, windowMs: 60_000 });
    if (!rate.allowed) {
      await writeApiMetric({ route: meta.route, method: meta.method, status: 429, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: "rate_limited" });
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const auth = await getAuthContext(request);
    if (auth.role !== "admin") {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
    if (!ticketId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await supabaseDeleteByFilters("support_requests", { id: ticketId });
    await writeApiMetric({ route: meta.route, method: meta.method, status: 200, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "support_requests_delete_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const status = message === "missing_auth_token" ? 401 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

