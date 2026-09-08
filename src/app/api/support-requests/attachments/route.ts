import { NextRequest, NextResponse } from "next/server";

import { getServerAccessControlConfig, isAccessAllowed } from "@/lib/access-control/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getRequestMeta } from "@/lib/api/request-meta";
import { writeAdminAuditLog } from "@/lib/audit/admin";
import { getSupportAuthContext } from "@/lib/support/auth.server";
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
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim() || "";
    const action = request.nextUrl.searchParams.get("action") === "download" ? "download" : "view";
    if (!UUID_REGEX.test(attachmentId)) {
      return NextResponse.json({ ok: false, error: "invalid_attachment_id" }, { status: 400 });
    }

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const supabase = getSupabaseServiceClient();
    const { data: attachment, error: attachmentError } = await supabase
      .from("support_request_attachments")
      .select("id,ticket_id,owner_uid,storage_path,mime_type,size_bytes,width,height,scan_status,visibility,created_at")
      .eq("id", attachmentId)
      .maybeSingle();
    if (attachmentError) throw new Error("support_attachment_read_failed");
    if (!attachment) return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });

    const { data: ticket, error: ticketError } = await supabase
      .from("support_requests")
      .select("id,uid")
      .eq("id", attachment.ticket_id)
      .maybeSingle();
    if (ticketError) throw new Error("support_ticket_read_failed");
    if (!ticket) return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });

    const canReadStaff = isAccessAllowed(auth, accessControl, "admin.support.read", "read");
    if (attachment.visibility === "internal" && !canReadStaff) {
      return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    }
    if (!canReadSupportAttachment({
      authUid: auth.uid,
      ticketUid: String(ticket.uid),
      ownerUid: String(attachment.owner_uid),
      canReadStaff,
    })) {
      return NextResponse.json({ ok: false, error: "attachment_not_found" }, { status: 404 });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(SUPPORT_EVIDENCE_BUCKET)
      .createSignedUrl(String(attachment.storage_path), SIGNED_URL_TTL_SECONDS, action === "download" ? { download: true } : undefined);
    if (signedError || !signed?.signedUrl) throw new Error("support_attachment_sign_failed");

    await writeAdminAuditLog({
      actorUid: auth.requesterUid,
      action: action === "download" ? "support.evidence.downloaded" : "support.evidence.viewed",
      targetUid: String(ticket.uid),
      requestId: meta.requestId,
      route: meta.route,
      method: meta.method,
      ip: meta.ip,
      userAgent: meta.userAgent,
      details: { ticketId: String(ticket.id), attachmentId, impersonating: auth.isImpersonating },
    });

    return NextResponse.json({
      ok: true,
      attachment: {
        id: String(attachment.id),
        ticketId: String(attachment.ticket_id),
        mimeType: String(attachment.mime_type),
        sizeBytes: Number(attachment.size_bytes),
        width: Number(attachment.width),
        height: Number(attachment.height),
        scanStatus: String(attachment.scan_status),
        createdAt: String(attachment.created_at),
        url: signed.signedUrl,
        expiresIn: SIGNED_URL_TTL_SECONDS,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const meta = getRequestMeta(request);
  try {
    const rate = await checkRateLimit(request, { key: "api:support:attachment:delete", max: 30, windowMs: 60_000 });
    if (!rate.allowed) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
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

    const { error: storageError } = await supabase.storage.from(SUPPORT_EVIDENCE_BUCKET).remove([String(attachment.storage_path)]);
    if (storageError) throw new Error("support_attachment_delete_failed");
    const { error: deleteError } = await supabase.from("support_request_attachments").delete().eq("id", attachmentId).eq("ticket_id", ticket.id);
    if (deleteError) throw new Error("support_attachment_delete_failed");
    await supabase.from("support_request_events").insert({ id: crypto.randomUUID(), ticket_id: ticket.id, actor_uid: auth.requesterUid, event_type: "attachment_removed", visibility: "public", metadata: { attachmentId }, created_at: new Date().toISOString() });
    await writeAdminAuditLog({ actorUid: auth.requesterUid, action: "support.evidence.deleted", targetUid: String(ticket.uid), requestId: meta.requestId, route: meta.route, method: meta.method, ip: meta.ip, userAgent: meta.userAgent, details: { ticketId: String(ticket.id), attachmentId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const status = message === "missing_auth_token" ? 401 : message === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
