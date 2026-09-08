import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { apiLogger } from "@/lib/observability/logger";
import { writeApiMetric } from "@/lib/observability/metrics";
import { pushNotification, pushNotifications } from "@/lib/notifications/server";
import { decryptServerPayload } from "@/lib/secure-store/server";
import {
  getServerAccessControlConfig,
  isAccessAllowed,
} from "@/lib/access-control/server";
import { supabaseDeleteByFilters, supabaseSelect, supabaseSelectPaged, supabaseUpsertRows } from "@/services/supabase/admin";
import { createSupportReport } from "@/lib/support/create-report.server";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";
import { getSupportAuthContext } from "@/lib/support/auth.server";
import { computeSupportEvidenceRetentionUntil } from "@/lib/support/report";
import { writeAdminAuditLog } from "@/lib/audit/admin";

const FINAL_STATUSES = new Set(["resolved", "implemented", "rejected"]);

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

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const canReadAdminSupport = isAccessAllowed(auth, accessControl, "admin.support.read", "read");

    const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || "1"));
    const limit = Math.max(1, Math.min(100, Number(request.nextUrl.searchParams.get("limit") || "20")));
    const typeFilter = request.nextUrl.searchParams.get("type")?.trim();
    const statusFilter = request.nextUrl.searchParams.get("status")?.trim();
    const priorityFilter = request.nextUrl.searchParams.get("priority")?.trim();
    const assignedToFilter = request.nextUrl.searchParams.get("assignedTo")?.trim();
    const routeFilter = request.nextUrl.searchParams.get("route")?.trim();
    const versionFilter = request.nextUrl.searchParams.get("appVersion")?.trim();
    const browserFilter = request.nextUrl.searchParams.get("browser")?.trim();
    const planFilter = request.nextUrl.searchParams.get("plan")?.trim();
    const workspaceFilter = request.nextUrl.searchParams.get("workspaceId")?.trim();
    const scope = request.nextUrl.searchParams.get("scope")?.trim();
    const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    const filters: Record<string, string | undefined> = {};
    if (typeFilter && typeFilter !== "all") filters.ticket_type = typeFilter;
    if (statusFilter && statusFilter !== "all") filters.ticket_status = statusFilter;
    if (assignedToFilter && assignedToFilter !== "all" && assignedToFilter !== "unassigned") filters.assigned_to = assignedToFilter;
    if (routeFilter && routeFilter !== "all") filters.report_route = routeFilter;
    if (versionFilter && versionFilter !== "all") filters.app_version = versionFilter;
    if (browserFilter && browserFilter !== "all") filters.browser = browserFilter;
    if (planFilter && planFilter !== "all") filters.effective_plan = planFilter;
    if (workspaceFilter && workspaceFilter !== "all") filters.workspace_id = workspaceFilter;
    if (scope === "mine" || !canReadAdminSupport) {
      filters.uid = auth.uid;
    }

    const baseSelect =
      "id,uid,email,name,title,message,protocol,workspace_id,workspace_type,effective_plan,report_route,app_version,browser,ticket_type,ticket_status,assigned_to,assigned_to_name,staff_seen_by,votes,created_at,updated_at,raw";
    const conditions: Record<string, string> = {};
    if (priorityFilter && priorityFilter !== "all") {
      conditions.raw = `cs.${JSON.stringify({ priority: priorityFilter })}`;
    }
    if (assignedToFilter === "unassigned") conditions.assigned_to = "is.null";
    const safeQ = escapeIlike(q);
    const or = safeQ
      ? `protocol.ilike.*${safeQ}*,title.ilike.*${safeQ}*,name.ilike.*${safeQ}*,email.ilike.*${safeQ}*`
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
      canReadAdminSupport
        ? paged.data
        : paged.data.filter((row) => {
            const raw = (row.raw as Record<string, unknown> | null) ?? {};
            return !Boolean(raw.isArchived);
          });

    const tickets = rows
      .map((row) => {
        const raw = (row.raw as Record<string, unknown> | null) ?? {};
        const report = (raw.report as Record<string, unknown> | null) ?? {};
        const reporter = (raw.reporter as Record<string, unknown> | null) ?? {};
        const secure = decryptServerPayload<{
          email?: string;
          name?: string;
          title?: string;
          message?: string;
          stepsToReproduce?: string;
          expectedResult?: string;
          actualResult?: string;
        }>(raw.secureSupport) ?? {};
        return {
          id: String(row.id || ""),
          uid: String(row.uid || raw.uid || ""),
          email: String(row.email || secure.email || raw.email || ""),
          name: String(row.name || secure.name || raw.name || ""),
          protocol: String(row.protocol || raw.protocol || row.title || ""),
          title: String(report.title || secure.title || row.title || raw.protocol || ""),
          message: String(row.message || secure.message || raw.message || ""),
          type: String(row.ticket_type || raw.type || "support"),
          supportKind: typeof raw.supportKind === "string" ? raw.supportKind : undefined,
          wantsData: typeof raw.wantsData === "boolean" ? raw.wantsData : undefined,
          status: String(row.ticket_status || raw.status || "pending"),
          priority: String(raw.priority || "medium"),
          assignedTo: canReadAdminSupport ? (row.assigned_to ?? raw.assignedTo ?? null) : null,
          assignedToName: canReadAdminSupport
            ? (row.assigned_to_name ?? raw.assignedToName ?? null)
            : (row.assigned_to || raw.assignedTo ? "Equipe de suporte" : null),
          staffSeenBy: canReadAdminSupport && Array.isArray(row.staff_seen_by)
            ? row.staff_seen_by
            : canReadAdminSupport && Array.isArray(raw.staffSeenBy)
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
          stepsToReproduce: String(report.stepsToReproduce || secure.stepsToReproduce || "") || undefined,
          expectedResult: String(report.expectedResult || secure.expectedResult || "") || undefined,
          actualResult: String(report.actualResult || secure.actualResult || "") || undefined,
          technicalContext: raw.technicalContext && typeof raw.technicalContext === "object" ? raw.technicalContext : undefined,
          workspaceId: String(row.workspace_id || "") || undefined,
          workspaceType: String(row.workspace_type || "") || undefined,
          effectivePlan: String(row.effective_plan || auth.plan || "") || undefined,
          reportRoute: String(row.report_route || "") || undefined,
          appVersion: String(row.app_version || "") || undefined,
          browser: String(row.browser || "") || undefined,
          reportedDuringImpersonation: Boolean(reporter.isImpersonating),
          createdAt: String(row.created_at || raw.createdAt || ""),
          updatedAt: String(row.updated_at || raw.updatedAt || ""),
        };
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const total = paged.total;
    const attachmentByTicket = new Map<string, Array<Record<string, unknown>>>();
    const ticketIds = tickets.map((ticket) => ticket.id).filter(Boolean);
    if (ticketIds.length > 0) {
      const supabase = getSupabaseServiceClient();
      const { data: attachments, error: attachmentsError } = await supabase
        .from("support_request_attachments")
        .select("id,ticket_id,mime_type,size_bytes,width,height,scan_status,visibility,created_at")
        .in("ticket_id", ticketIds)
        .order("created_at", { ascending: true });
      if (attachmentsError) throw new Error("support_attachments_list_failed");
      for (const attachment of attachments || []) {
        if (!canReadAdminSupport && attachment.visibility === "internal") continue;
        const ticketId = String(attachment.ticket_id || "");
        const current = attachmentByTicket.get(ticketId) || [];
        current.push({
          id: String(attachment.id || ""),
          ticketId,
          mimeType: String(attachment.mime_type || ""),
          sizeBytes: Number(attachment.size_bytes || 0),
          width: Number(attachment.width || 0),
          height: Number(attachment.height || 0),
          scanStatus: String(attachment.scan_status || "unavailable"),
          createdAt: String(attachment.created_at || ""),
        });
        attachmentByTicket.set(ticketId, current);
      }
    }
    const sliced = tickets.map((ticket) => ({ ...ticket, attachments: attachmentByTicket.get(ticket.id) || [] }));
    const unseenCount =
      canReadAdminSupport
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
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
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

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    if (!isAccessAllowed(auth, accessControl, "support.write", "write")) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const result = await createSupportReport(request, auth);
    const { id, protocol, type } = result;

    const [admins, moderators, supports] = await Promise.all([
      supabaseSelect("profiles", { select: "uid", filters: { role: "admin" }, limit: 200 }),
      supabaseSelect("profiles", { select: "uid", filters: { role: "moderator" }, limit: 200 }),
      supabaseSelect("profiles", { select: "uid", filters: { role: "support" }, limit: 200 }),
    ]);
    const staffUids = Array.from(
      new Set([...admins, ...moderators, ...supports].map((row) => String(row.uid || "").trim()).filter(Boolean))
    );
    if (!result.duplicated) await pushNotifications(
      staffUids.map((staffUid) => ({
        uid: staffUid,
        kind: "support" as const,
        title: type === "feature" ? "Nova ideia recebida" : type === "bug" ? "Novo bug relatado" : "Novo chamado de suporte",
        message: `${auth.name} abriu uma nova solicitação.`,
        href: "/admin?tab=support",
        meta: { ticketId: id, ticketType: type, fromUid: auth.uid },
      }))
    );

    const responseStatus = result.duplicated ? 200 : 201;
    await writeApiMetric({ route: meta.route, method: meta.method, status: responseStatus, durationMs: Date.now() - startedAt, requestId: meta.requestId, uid: auth.uid });
    return NextResponse.json({ ok: true, id, protocol, duplicated: result.duplicated }, { status: responseStatus });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    apiLogger.error({
      message: "support_requests_post_failed",
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      meta: { error: message },
    });
    const badRequestErrors = new Set([
      "description_too_short", "title_required", "invalid_payload", "invalid_client_request_id",
      "invalid_technical_context", "too_many_attachments", "empty_file", "file_too_large",
      "invalid_file_name", "unsupported_file_type", "file_type_mismatch", "invalid_image_dimensions",
    ]);
    const status = message === "missing_auth_token"
      ? 401
      : message === "forbidden"
        ? 403
        : message === "daily_attachment_quota_exceeded"
          ? 429
          : badRequestErrors.has(message)
            ? 400
            : 500;
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

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const body = (await request.json()) as {
      action?: "markSeen";
      ticketIds?: string[];
      ticketId?: string;
      updates?: Record<string, unknown>;
    };

    const allRows = await supabaseSelect("support_requests", {
      select: "id,uid,assigned_to,assigned_to_name,staff_seen_by,raw,ticket_status,ticket_type",
    });

    if (body.action === "markSeen") {
      if (!isAccessAllowed(auth, accessControl, "admin.support.read", "read")) {
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
        await writeAdminAuditLog({ actorUid: auth.requesterUid, action: "support.tickets.viewed", requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketIds: upserts.map((item) => item.id), impersonating: auth.isImpersonating } });
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

    const canWriteAdminSupport = isAccessAllowed(auth, accessControl, "admin.support.write", "write");
    if (!canWriteAdminSupport) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const allowedStatuses = String(row.ticket_type || "support") === "feature"
      ? new Set(["pending", "under_review", "approved", "rejected", "implemented"])
      : new Set(["pending", "in_progress", "resolved", "rejected"]);
    const safeUpdates: Record<string, unknown> = {};
    if (typeof body.updates.status === "string" && allowedStatuses.has(body.updates.status)) {
      safeUpdates.status = body.updates.status;
    }
    if (typeof body.updates.priority === "string" && ["low", "medium", "high", "urgent"].includes(body.updates.priority)) {
      safeUpdates.priority = body.updates.priority;
    }
    if (body.updates.assignedTo === null || typeof body.updates.assignedTo === "string") {
      safeUpdates.assignedTo = typeof body.updates.assignedTo === "string" ? body.updates.assignedTo.trim().slice(0, 160) : null;
    }
    if (body.updates.assignedToName === null || typeof body.updates.assignedToName === "string") {
      safeUpdates.assignedToName = typeof body.updates.assignedToName === "string" ? body.updates.assignedToName.trim().slice(0, 160) : null;
    }
    if (Object.keys(safeUpdates).length === 0) {
      return NextResponse.json({ ok: false, error: "invalid_updates" }, { status: 400 });
    }

    const raw = ((row.raw as Record<string, unknown> | null) ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...raw, ...safeUpdates, updatedAt: new Date().toISOString() };
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

    const previousStatus = String(row.ticket_status || raw.status || "pending");
    const previousAssignedTo = row.assigned_to ? String(row.assigned_to) : null;
    const eventClient = getSupabaseServiceClient();
    const events: Array<Record<string, unknown>> = [];
    if (typeof safeUpdates.status === "string" && previousStatus !== nextStatus) {
      events.push({ id: crypto.randomUUID(), ticket_id: ticketId, actor_uid: auth.requesterUid, event_type: "status_changed", visibility: "public", metadata: { from: previousStatus, to: nextStatus }, created_at: new Date().toISOString() });
    }
    if (Object.hasOwn(safeUpdates, "assignedTo") && previousAssignedTo !== (safeUpdates.assignedTo || null)) {
      events.push({ id: crypto.randomUUID(), ticket_id: ticketId, actor_uid: auth.requesterUid, event_type: "assigned", visibility: "public", metadata: { assigned: Boolean(safeUpdates.assignedTo) }, created_at: new Date().toISOString() });
    }
    if (typeof safeUpdates.priority === "string" && safeUpdates.priority !== raw.priority) {
      events.push({ id: crypto.randomUUID(), ticket_id: ticketId, actor_uid: auth.requesterUid, event_type: "priority_changed", visibility: "internal", metadata: { from: raw.priority || "medium", to: safeUpdates.priority }, created_at: new Date().toISOString() });
    }
    if (events.length > 0) {
      const { error: eventError } = await eventClient.from("support_request_events").insert(events);
      if (eventError) throw new Error("support_event_write_failed");
    }
    await writeAdminAuditLog({ actorUid: auth.requesterUid, action: "support.ticket.updated", targetUid: ticketData.uid, requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId, fields: Object.keys(safeUpdates), previousStatus, nextStatus, impersonating: auth.isImpersonating } });

    if (typeof safeUpdates.status === "string") {
      const retentionClient = getSupabaseServiceClient();
      const { error: retentionError } = await retentionClient
        .from("support_request_attachments")
        .update({ retention_until: FINAL_STATUSES.has(nextStatus) ? computeSupportEvidenceRetentionUntil() : null })
        .eq("ticket_id", ticketId);
      if (retentionError) throw new Error("support_attachment_retention_update_failed");
    }

    if (typeof safeUpdates.status === "string" && previousStatus !== nextStatus && ticketData.uid) {
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
        title: FINAL_STATUSES.has(nextStatus) ? `Protocolo ${protocol} finalizado` : `Protocolo ${protocol} atualizado`,
        message: FINAL_STATUSES.has(nextStatus) ? `Seu chamado foi finalizado com status: ${statusLabel}.` : `O status do seu chamado mudou para ${nextStatus}.`,
        href: `/settings?tab=help&ticket=${encodeURIComponent(ticketId)}`,
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
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
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

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    if (!isAccessAllowed(auth, accessControl, "admin.support.delete", "write")) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const ticketId = request.nextUrl.searchParams.get("ticketId")?.trim();
    if (!ticketId) {
      return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    const storageClient = getSupabaseServiceClient();
    const { data: attachments, error: attachmentsError } = await storageClient
      .from("support_request_attachments")
      .select("storage_path")
      .eq("ticket_id", ticketId);
    if (attachmentsError) throw new Error("support_attachments_cleanup_lookup_failed");
    const storagePaths = (attachments || []).map((item) => String(item.storage_path || "")).filter(Boolean);
    if (storagePaths.length > 0) {
      const { error: storageError } = await storageClient.storage.from("support-evidence").remove(storagePaths);
      if (storageError) throw new Error("support_attachments_cleanup_failed");
    }
    await supabaseDeleteByFilters("support_requests", { id: ticketId });
    await writeAdminAuditLog({ actorUid: auth.requesterUid, action: "support.ticket.deleted", requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId, impersonating: auth.isImpersonating } });
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
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    await writeApiMetric({ route: meta.route, method: meta.method, status, durationMs: Date.now() - startedAt, requestId: meta.requestId, errorCode: message });
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

