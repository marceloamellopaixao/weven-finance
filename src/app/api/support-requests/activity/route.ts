import { NextRequest, NextResponse } from "next/server";

import { getServerAccessControlConfig, isAccessAllowed } from "@/lib/access-control/server";
import { checkRateLimit, rateLimitResponse, RateLimitExceededError } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { pushNotification } from "@/lib/notifications/server";
import {
  canReopenSupportTicket,
  getSupportAccess,
  normalizeSupportMessage,
  publicSupportEventMetadata,
  reopenedStatusForType,
} from "@/lib/support/activity";
import { getSupportAuthContext } from "@/lib/support/auth.server";
import { persistSupportEvidence, uploadSupportEvidence } from "@/lib/support/create-report.server";
import { normalizeSupportReportType } from "@/lib/support/report";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveTicketAccess(request: NextRequest, ticketId: string) {
  const auth = await getSupportAuthContext(request);
  const accessControl = await getServerAccessControlConfig();
  const canReadStaff = isAccessAllowed(auth, accessControl, "admin.support.read", "read");
  const canWriteStaff = isAccessAllowed(auth, accessControl, "admin.support.write", "write");
  const supabase = getSupabaseServiceClient();
  const { data: ticket, error } = await supabase
    .from("support_requests")
    .select("id,uid,protocol,ticket_type,ticket_status,assigned_to_name,raw,created_at,updated_at")
    .eq("id", ticketId)
    .maybeSingle();
  if (error) throw new Error("support_ticket_read_failed");
  if (!ticket) return null;
  const access = getSupportAccess({
    authUid: auth.uid,
    requesterUid: auth.requesterUid,
    isImpersonating: auth.isImpersonating,
    canReadStaff,
    canWriteStaff,
  }, { ticketUid: String(ticket.uid || "") });
  if (!access.canRead) return null;
  return { auth, access, ticket, supabase, canReadStaff, canWriteStaff };
}

function safeTicketId(request: NextRequest) {
  const value = request.nextUrl.searchParams.get("ticketId")?.trim() || "";
  return UUID_REGEX.test(value) ? value : "";
}

async function recordEvent(input: {
  ticketId: string;
  actorUid: string;
  eventType: string;
  visibility: "public" | "internal";
  metadata?: Record<string, unknown>;
}) {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("support_request_events").insert({
    id: crypto.randomUUID(),
    ticket_id: input.ticketId,
    actor_uid: input.actorUid,
    event_type: input.eventType,
    visibility: input.visibility,
    metadata: input.metadata || {},
    created_at: new Date().toISOString(),
  });
  if (error) throw new Error("support_event_write_failed");
}

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { key: "api:support:activity:get", max: 120, windowMs: 60_000 });
    if (!rate.allowed) return rateLimitResponse(rate);
    const ticketId = safeTicketId(request);
    if (!ticketId) return NextResponse.json({ ok: false, error: "invalid_ticket_id" }, { status: 400 });
    const context = await resolveTicketAccess(request, ticketId);
    if (!context) return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });

    const [messagesResult, eventsResult, attachmentsResult] = await Promise.all([
      context.supabase.from("support_request_messages").select("id,author_uid,author_kind,visibility,message,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      context.supabase.from("support_request_events").select("id,actor_uid,event_type,visibility,metadata,created_at").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
      context.supabase.from("support_request_attachments").select("id,ticket_id,mime_type,size_bytes,width,height,scan_status,visibility,created_at,retention_until").eq("ticket_id", ticketId).order("created_at", { ascending: true }),
    ]);
    if (messagesResult.error || eventsResult.error || attachmentsResult.error) throw new Error("support_activity_read_failed");

    const includeInternal = context.canReadStaff && !context.auth.isImpersonating;
    const messages = (messagesResult.data || [])
      .filter((item) => includeInternal || item.visibility === "public")
      .map((item) => ({
        id: String(item.id),
        visibility: item.visibility,
        message: String(item.message),
        author: String(item.author_uid) === context.auth.uid ? "you" : item.author_kind === "staff" ? "support" : "client",
        createdAt: String(item.created_at),
      }));
    const raw = (context.ticket.raw as Record<string, unknown> | null) || {};
    const events = (eventsResult.data || [])
      .filter((item) => includeInternal || item.visibility === "public")
      .map((item) => ({
        id: String(item.id),
        type: String(item.event_type),
        visibility: item.visibility,
        metadata: includeInternal
          ? ((item.metadata as Record<string, unknown> | null) || {})
          : publicSupportEventMetadata(String(item.event_type), (item.metadata as Record<string, unknown> | null) || {}),
        actor: String(item.actor_uid) === context.auth.uid ? "you" : "support",
        createdAt: String(item.created_at),
      }));
    if (!events.some((item) => item.type === "created")) {
      events.unshift({
        id: `created-${ticketId}`,
        type: "created",
        visibility: "public",
        metadata: { protocol: context.ticket.protocol || raw.protocol, type: context.ticket.ticket_type },
        actor: context.access.isOwner ? "you" : "support",
        createdAt: String(context.ticket.created_at),
      });
    }
    const resolvedAt = typeof raw.resolvedAt === "string" ? raw.resolvedAt : null;

    return NextResponse.json({
      ok: true,
      activity: {
        ticketId,
        protocol: String(context.ticket.protocol || raw.protocol || `#${ticketId.slice(0, 8)}`),
        status: String(context.ticket.ticket_status || raw.status || "pending"),
        assignedToName: context.ticket.assigned_to_name ? "Equipe de suporte" : null,
        updatedAt: context.ticket.updated_at,
        messages,
        events,
        attachments: (attachmentsResult.data || []).filter((item) => includeInternal || item.visibility === "public").map((item) => ({
          id: String(item.id),
          ticketId: String(item.ticket_id),
          mimeType: String(item.mime_type),
          sizeBytes: Number(item.size_bytes || 0),
          width: Number(item.width || 0),
          height: Number(item.height || 0),
          scanStatus: String(item.scan_status || "unavailable"),
          createdAt: String(item.created_at),
        })),
        canReply: context.access.canReplyPublic,
        canWriteInternal: context.access.canWriteInternal,
        canRequestAccess: context.canWriteStaff && !context.auth.isImpersonating,
        canReopen: context.access.isOwner && !context.auth.isImpersonating && canReopenSupportTicket({ status: String(context.ticket.ticket_status), resolvedAt }),
        reopenWindowDays: 14,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const form = await request.formData();
    const ticketId = String(form.get("ticketId") || "").trim();
    const action = String(form.get("action") || "reply").trim();
    const clientRequestId = String(form.get("clientRequestId") || request.headers.get("idempotency-key") || "").trim();
    if (!UUID_REGEX.test(ticketId)) return NextResponse.json({ ok: false, error: "invalid_ticket_id" }, { status: 400 });
    const context = await resolveTicketAccess(request, ticketId);
    if (!context) return NextResponse.json({ ok: false, error: "ticket_not_found" }, { status: 404 });
    const rate = await checkRateLimit(request, { key: "api:support:activity:post", max: Number(process.env.RATE_LIMIT_SUPPORT_RESPONSES_PER_MINUTE || 12), windowMs: 60_000, identity: { userId: context.auth.requesterUid, tenantId: String(context.ticket.uid) }, critical: true });
    if (!rate.allowed) return rateLimitResponse(rate);

    if (action === "reopen") {
      if (!context.access.isOwner || context.auth.isImpersonating) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      const raw = (context.ticket.raw as Record<string, unknown> | null) || {};
      if (!canReopenSupportTicket({ status: String(context.ticket.ticket_status), resolvedAt: typeof raw.resolvedAt === "string" ? raw.resolvedAt : null })) {
        return NextResponse.json({ ok: false, error: "reopen_window_expired" }, { status: 409 });
      }
      const nextStatus = reopenedStatusForType(normalizeSupportReportType(context.ticket.ticket_type));
      const nextRaw = { ...raw, status: nextStatus, resolvedAt: null, updatedAt: new Date().toISOString() };
      const { error: retentionError } = await context.supabase.from("support_request_attachments").update({ retention_until: null }).eq("ticket_id", ticketId);
      if (retentionError) throw new Error("support_reopen_failed");
      const { error } = await context.supabase.from("support_requests").update({ ticket_status: nextStatus, raw: nextRaw, updated_at: new Date().toISOString() }).eq("id", ticketId);
      if (error) throw new Error("support_reopen_failed");
      await recordEvent({ ticketId, actorUid: context.auth.uid, eventType: "reopened", visibility: "public", metadata: { from: context.ticket.ticket_status, to: nextStatus } });
      await writeAdminAuditLog({ actorUid: context.auth.requesterUid, action: "support.ticket.reopened", targetUid: context.auth.uid, requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId } });
      return NextResponse.json({ ok: true, status: nextStatus });
    }

    if (!UUID_REGEX.test(clientRequestId)) return NextResponse.json({ ok: false, error: "invalid_client_request_id" }, { status: 400 });
    const { data: duplicate, error: duplicateError } = await context.supabase.from("support_request_messages").select("id").eq("ticket_id", ticketId).eq("client_request_id", clientRequestId).maybeSingle();
    if (duplicateError) throw new Error("support_idempotency_lookup_failed");
    if (duplicate) return NextResponse.json({ ok: true, duplicated: true });

    const visibility = action === "internal_note" ? "internal" : "public";
    if (visibility === "internal" && !context.access.canWriteInternal) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    if (visibility === "public" && !context.access.canReplyPublic) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    const message = normalizeSupportMessage(form.get("message"));
    const files = form.getAll("attachments").filter((item): item is File => typeof item !== "string");
    const { count } = await context.supabase.from("support_request_attachments").select("id", { count: "exact", head: true }).eq("ticket_id", ticketId);
    if ((count || 0) + files.length > 3) return NextResponse.json({ ok: false, error: "too_many_attachments" }, { status: 400 });
    const uploaded = await uploadSupportEvidence({ ownerUid: String(context.ticket.uid), ticketId, files, request, requesterUid: context.auth.requesterUid });

    const nowIso = new Date().toISOString();
    const messageId = crypto.randomUUID();
    const { error: messageError } = await context.supabase.from("support_request_messages").insert({
      id: messageId, ticket_id: ticketId, author_uid: context.auth.requesterUid,
      author_kind: context.canWriteStaff && !context.auth.isImpersonating ? "staff" : "client",
      visibility, client_request_id: clientRequestId, message, created_at: nowIso, updated_at: nowIso,
    });
    if (messageError) {
      if (uploaded.length) await context.supabase.storage.from("support-evidence").remove(uploaded.map((item) => item.storagePath));
      if (messageError.code === "23505") return NextResponse.json({ ok: true, duplicated: true });
      throw new Error("support_message_write_failed");
    }
    try {
      await persistSupportEvidence({ ownerUid: String(context.ticket.uid), ticketId, uploaded, visibility });
    } catch (cause) {
      await context.supabase.from("support_request_messages").delete().eq("id", messageId).eq("ticket_id", ticketId);
      if (uploaded.length) await context.supabase.storage.from("support-evidence").remove(uploaded.map((item) => item.storagePath));
      throw cause;
    }
    const eventType = action === "request_info" ? "information_requested" : visibility === "internal" ? "internal_note" : "public_reply";
    await recordEvent({ ticketId, actorUid: context.auth.requesterUid, eventType, visibility, metadata: { attachmentIds: uploaded.map((item) => item.id) } });
    if (uploaded.length) await recordEvent({ ticketId, actorUid: context.auth.requesterUid, eventType: "attachment_added", visibility, metadata: { attachmentIds: uploaded.map((item) => item.id) } });
    const currentRaw = (context.ticket.raw as Record<string, unknown> | null) || {};
    const isStaffPublicReply = context.canWriteStaff && !context.auth.isImpersonating && visibility === "public";
    const nextStatus = isStaffPublicReply && String(context.ticket.ticket_status) === "pending" ? "in_progress" : String(context.ticket.ticket_status);
    const nextRaw = {
      ...currentRaw,
      ...(isStaffPublicReply && !currentRaw.firstResponseAt ? { firstResponseAt: nowIso } : {}),
      status: nextStatus,
      updatedAt: nowIso,
    };
    await context.supabase.from("support_requests").update({ ticket_status: nextStatus, raw: nextRaw, updated_at: nowIso }).eq("id", ticketId);
    if (nextStatus !== String(context.ticket.ticket_status)) {
      await recordEvent({ ticketId, actorUid: context.auth.requesterUid, eventType: "status_changed", visibility: "public", metadata: { from: context.ticket.ticket_status, to: nextStatus } });
    }

    if (!context.access.isOwner && visibility === "public") {
      await pushNotification({ uid: String(context.ticket.uid), kind: "support", title: action === "request_info" ? "O suporte pediu mais informações" : "Nova resposta no seu chamado", message: `Protocolo ${String(context.ticket.protocol || currentRaw.protocol || "")}`, href: `/settings?tab=help&ticket=${encodeURIComponent(ticketId)}`, meta: { ticketId }, dedupeKey: `support-reply:${ticketId}:${clientRequestId}` });
    }
    await writeAdminAuditLog({ actorUid: context.auth.requesterUid, action: `support.${eventType}`, targetUid: String(context.ticket.uid), requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId, visibility, attachments: uploaded.length, impersonating: context.auth.isImpersonating } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof RateLimitExceededError) return rateLimitResponse(error.result);
    const message = error instanceof Error ? error.message : "unknown_error";
    const bad = new Set(["invalid_message", "too_many_attachments", "empty_file", "file_too_large", "invalid_file_name", "unsupported_file_type", "file_type_mismatch"]);
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : bad.has(message) ? 400 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
