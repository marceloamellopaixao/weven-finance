import { NextRequest, NextResponse } from "next/server";

import { getServerAccessControlConfig, isAccessAllowed } from "@/lib/access-control/server";
import { checkRateLimit, rateLimitResponse } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { resolveApiErrorStatus } from "@/lib/api/error";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { getSupportAuthContext, requireSupportStaffMfa } from "@/lib/support/auth.server";
import { canReadSupportAttachment } from "@/lib/support/report";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

const SUPPORT_EVIDENCE_BUCKET = "support-evidence";
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:support:attachment:get", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      return rateLimitResponse(rate);
    }

    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim() || "";
    const attachmentIds = request.nextUrl.searchParams.get("attachmentIds")
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean) || [];
    const action = request.nextUrl.searchParams.get("action") === "download" ? "download" : "view";
    const requestedIds = attachmentIds.length > 0 ? [...new Set(attachmentIds)].slice(0, 3) : [attachmentId];
    const isBatch = attachmentIds.length > 0;
    if (requestedIds.length === 0 || requestedIds.some((id) => !UUID_REGEX.test(id)) || (isBatch && action === "download")) {
      return NextResponse.json({ ok: false, error: "invalid_attachment_id" }, { status: 400 });
    }

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const supabase = getSupabaseServiceClient();
    const { data: attachmentRows, error: attachmentError } = await supabase
      .from("support_request_attachments")
      .select("id,ticket_id,owner_uid,storage_path,mime_type,size_bytes,width,height,scan_status,visibility,created_at")
      .in("id", requestedIds);
    if (attachmentError) throw new Error("support_attachment_read_failed");
    if (!attachmentRows || attachmentRows.length !== requestedIds.length) {
      return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    }

    const ticketIds = [...new Set(attachmentRows.map((attachment) => String(attachment.ticket_id)))];
    const { data: ticketRows, error: ticketError } = await supabase
      .from("support_requests")
      .select("id,uid")
      .in("id", ticketIds);
    if (ticketError) throw new Error("support_ticket_read_failed");
    if (!ticketRows || ticketRows.length !== ticketIds.length) {
      return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    }

    const canReadStaff = isAccessAllowed(auth, accessControl, "admin.support.read", "read");
    if (canReadStaff && ticketRows.some((ticket) => String(ticket.uid) !== auth.uid)) {
      requireSupportStaffMfa(auth);
    }
    const ticketById = new Map(ticketRows.map((ticket) => [String(ticket.id), ticket]));
    for (const attachment of attachmentRows) {
      const ticket = ticketById.get(String(attachment.ticket_id));
      if (
        !ticket ||
        (attachment.visibility === "internal" && !canReadStaff) ||
        !canReadSupportAttachment({
          authUid: auth.uid,
          ticketUid: String(ticket.uid),
          ownerUid: String(attachment.owner_uid),
          canReadStaff,
        })
      ) {
        return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
      }
    }

    const signedUrlTtl = process.env.NODE_ENV !== "production" && process.env.PLAYWRIGHT_TEST === "1"
      ? Math.max(1, Math.min(SIGNED_URL_TTL_SECONDS, Number(request.headers.get("x-e2e-signed-url-ttl") || SIGNED_URL_TTL_SECONDS)))
      : SIGNED_URL_TTL_SECONDS;
    const orderedAttachments = requestedIds.map((id) => attachmentRows.find((item) => String(item.id) === id)!);
    const { data: signedRows, error: signedError } = await supabase.storage
      .from(SUPPORT_EVIDENCE_BUCKET)
      .createSignedUrls(
        orderedAttachments.map((attachment) => String(attachment.storage_path)),
        signedUrlTtl,
        action === "download" ? { download: true } : undefined,
      );
    if (signedError || !signedRows || signedRows.some((signed) => !signed.signedUrl)) {
      throw new Error("support_attachment_sign_failed");
    }

    const signedUrlByPath = new Map(signedRows.map((signed) => [String(signed.path), signed.signedUrl as string]));
    const responseAttachments = orderedAttachments.map((attachment, index) => ({
      id: String(attachment.id),
      ticketId: String(attachment.ticket_id),
      mimeType: String(attachment.mime_type),
      sizeBytes: Number(attachment.size_bytes),
      width: Number(attachment.width),
      height: Number(attachment.height),
      scanStatus: String(attachment.scan_status),
      createdAt: String(attachment.created_at),
      url: signedUrlByPath.get(String(attachment.storage_path)) || signedRows[index]?.signedUrl || "",
      expiresIn: signedUrlTtl,
    }));

    await writeAdminAuditLog({
      actorUid: auth.requesterUid,
      action: action === "download" ? "support.evidence.downloaded" : "support.evidence.viewed",
      targetUid: String(ticketById.get(String(orderedAttachments[0].ticket_id))?.uid || ""),
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: {
        ticketIds,
        attachmentIds: requestedIds,
        batch: isBatch,
        impersonating: auth.isImpersonating,
      },
    });

    return NextResponse.json(isBatch
      ? { ok: true, attachments: responseAttachments }
      : { ok: true, attachment: responseAttachments[0] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:support:attachment:delete", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return rateLimitResponse(rate);
    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim() || "";
    if (!UUID_REGEX.test(attachmentId)) return NextResponse.json({ ok: false, error: "invalid_attachment_id" }, { status: 400 });

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const canWriteStaff = isAccessAllowed(auth, accessControl, "admin.support.write", "write") && !auth.isImpersonating;
    const supabase = getSupabaseServiceClient();
    const { data: attachment, error: attachmentError } = await supabase.from("support_request_attachments")
      .select("id,ticket_id,owner_uid,storage_path,visibility,retention_until").eq("id", attachmentId).maybeSingle();
    if (attachmentError) throw new Error("support_attachment_read_failed");
    if (!attachment) return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    const { data: ticket, error: ticketError } = await supabase.from("support_requests").select("id,uid,ticket_status").eq("id", attachment.ticket_id).maybeSingle();
    if (ticketError) throw new Error("support_ticket_read_failed");
    if (!ticket) return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    const isOwner = auth.uid === String(ticket.uid) && auth.uid === String(attachment.owner_uid) && !auth.isImpersonating;
    const retentionExpired = attachment.retention_until && new Date(String(attachment.retention_until)).getTime() <= Date.now();
    if ((!isOwner && !canWriteStaff) || (isOwner && attachment.visibility === "internal") || retentionExpired) return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    if (!isOwner) requireSupportStaffMfa(auth);

    const { error: storageError } = await supabase.storage.from(SUPPORT_EVIDENCE_BUCKET).remove([String(attachment.storage_path)]);
    if (storageError) throw new Error("support_attachment_delete_failed");
    const { error: deleteError } = await supabase.from("support_request_attachments").delete().eq("id", attachmentId).eq("ticket_id", ticket.id);
    if (deleteError) throw new Error("support_attachment_delete_failed");
    await supabase.from("support_request_events").insert({ id: crypto.randomUUID(), ticket_id: ticket.id, actor_uid: auth.requesterUid, event_type: "attachment_removed", visibility: "public", metadata: { attachmentId }, created_at: new Date().toISOString() });
    await writeAdminAuditLog({ actorUid: auth.requesterUid, action: "support.evidence.deleted", targetUid: String(ticket.uid), requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId: String(ticket.id), attachmentId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "forbidden" ? 403 : resolveApiErrorStatus(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
