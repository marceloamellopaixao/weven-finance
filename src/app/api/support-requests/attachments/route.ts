import { NextRequest, NextResponse } from "next/server";

import { getServerAccessControlConfig, isAccessAllowed } from "@/lib/access-control/server";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { getSupportAuthContext } from "@/lib/support/auth.server";
import { canReadSupportAttachment } from "@/lib/support/report";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

const SUPPORT_EVIDENCE_BUCKET = "support-evidence";
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const rate = await checkRateLimit(request, { key: "api:support:attachment:get", max: 60, windowMs: 60_000 });
    if (!rate.allowed) {
      return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
    }

    const attachmentId = request.nextUrl.searchParams.get("attachmentId")?.trim() || "";
    if (!UUID_REGEX.test(attachmentId)) {
      return NextResponse.json({ ok: false, error: "invalid_attachment_id" }, { status: 400 });
    }

    const auth = await getSupportAuthContext(request);
    const accessControl = await getServerAccessControlConfig();
    const supabase = getSupabaseServiceClient();
    const { data: attachment, error: attachmentError } = await supabase
      .from("support_request_attachments")
      .select("id,ticket_id,owner_uid,storage_path,mime_type,size_bytes,width,height,scan_status,created_at")
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
      .createSignedUrl(String(attachment.storage_path), SIGNED_URL_TTL_SECONDS);
    if (signedError || !signed?.signedUrl) throw new Error("support_attachment_sign_failed");

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
