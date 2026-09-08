import "server-only";

import type { NextRequest } from "next/server";

import { encryptServerPayload } from "@/lib/secure-store/server";
import type { SupportAuthContext } from "@/lib/support/auth.server";
import { processSupportEvidence, type ProcessedSupportEvidence } from "@/lib/support/evidence.server";
import {
  extensionForSupportEvidence,
  MAX_SUPPORT_ATTACHMENTS,
  MAX_SUPPORT_DAILY_ATTACHMENTS,
  MAX_SUPPORT_DAILY_BYTES,
  parseSupportReportFields,
  type SupportReportFields,
  type SupportReportType,
  type SupportTechnicalContext,
} from "@/lib/support/report";
import { resolveActiveWorkspaceContext } from "@/lib/workspaces/server";
import { getSupabaseServiceClient } from "@/services/supabase/service-client";

const SUPPORT_EVIDENCE_BUCKET = "support-evidence";
const FINAL_STATUSES = new Set(["resolved", "implemented", "rejected"]);

export type UploadedEvidence = ProcessedSupportEvidence & {
  id: string;
  storagePath: string;
};

function formatProtocol(date = new Date()) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `WF-${y}${m}${d}-${suffix}`;
}

function inferPriority(type: SupportReportType, message: string) {
  if (type === "feature") return "low" as const;
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/(bloquead|urgente|nao consigo|nao entra|sem acesso|pagamento|cobranca|erro 500)/.test(normalized)) {
    return "high" as const;
  }
  if (type === "bug" || /(travando|lento|falha|bug|problema)/.test(normalized)) return "medium" as const;
  return "low" as const;
}

function computeSlaDueAt(createdAtIso: string, type: SupportReportType, priority: "low" | "medium" | "high") {
  const hours = type === "feature"
    ? { high: 48, medium: 72, low: 96 }[priority]
    : { high: 8, medium: 24, low: 48 }[priority];
  return new Date(new Date(createdAtIso).getTime() + hours * 60 * 60 * 1_000).toISOString();
}

function isFileEntry(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && typeof value.arrayBuffer === "function";
}

async function parseRequest(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.toLowerCase().includes("multipart/form-data")) {
    const form = await request.formData();
    let technicalContext: unknown;
    try {
      technicalContext = JSON.parse(String(form.get("technicalContext") || "{}"));
    } catch {
      throw new Error("invalid_technical_context");
    }
    const fields = parseSupportReportFields({
      type: form.get("type"),
      title: form.get("title"),
      description: form.get("description"),
      stepsToReproduce: form.get("stepsToReproduce"),
      expectedResult: form.get("expectedResult"),
      actualResult: form.get("actualResult"),
      includeTechnicalContext: form.get("includeTechnicalContext"),
      technicalContext,
      clientRequestId: form.get("clientRequestId") || request.headers.get("idempotency-key"),
    });
    const files = form.getAll("attachments").filter(isFileEntry);
    return { fields, files };
  }

  const body = (await request.json()) as Record<string, unknown>;
  return {
    fields: parseSupportReportFields({
      ...body,
      description: body.description ?? body.message,
      clientRequestId: body.clientRequestId ?? request.headers.get("idempotency-key"),
    }),
    files: [] as File[],
  };
}

export async function enforceSupportDailyQuota(ownerUid: string, incomingFiles: number, incomingBytes: number) {
  if (incomingFiles === 0) return;
  const supabase = getSupabaseServiceClient();
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from("support_request_attachments")
    .select("size_bytes")
    .eq("owner_uid", ownerUid)
    .gte("created_at", startOfDay.toISOString())
    .limit(MAX_SUPPORT_DAILY_ATTACHMENTS + 1);
  if (error) throw new Error("support_attachment_quota_failed");
  const usedFiles = data?.length || 0;
  const usedBytes = (data || []).reduce((total, row) => total + Number(row.size_bytes || 0), 0);
  if (usedFiles + incomingFiles > MAX_SUPPORT_DAILY_ATTACHMENTS || usedBytes + incomingBytes > MAX_SUPPORT_DAILY_BYTES) {
    throw new Error("daily_attachment_quota_exceeded");
  }
}

export async function uploadSupportEvidence(input: { ownerUid: string; ticketId: string; files: File[] }) {
  if (input.files.length > MAX_SUPPORT_ATTACHMENTS) throw new Error("too_many_attachments");
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(input.ownerUid)) throw new Error("invalid_owner_uid");
  const incomingBytes = input.files.reduce((total, file) => total + file.size, 0);
  await enforceSupportDailyQuota(input.ownerUid, input.files.length, incomingBytes);
  const processed = await Promise.all(input.files.map(processSupportEvidence));
  const supabase = getSupabaseServiceClient();
  const uploaded: UploadedEvidence[] = [];
  try {
    for (const evidence of processed) {
      const id = crypto.randomUUID();
      const extension = extensionForSupportEvidence(evidence.mimeType);
      const storagePath = `${input.ownerUid}/${input.ticketId}/${id}.${extension}`;
      const { error } = await supabase.storage.from(SUPPORT_EVIDENCE_BUCKET).upload(storagePath, evidence.bytes, {
        contentType: evidence.mimeType,
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw new Error("support_attachment_upload_failed");
      uploaded.push({ ...evidence, id, storagePath });
    }
    return uploaded;
  } catch (error) {
    await removeUploaded(uploaded.map((item) => item.storagePath));
    throw error;
  }
}

export async function persistSupportEvidence(input: { ownerUid: string; ticketId: string; uploaded: UploadedEvidence[]; visibility?: "public" | "internal" }) {
  if (input.uploaded.length === 0) return;
  const nowIso = new Date().toISOString();
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase.from("support_request_attachments").insert(input.uploaded.map((item) => ({
    id: item.id,
    ticket_id: input.ticketId,
    owner_uid: input.ownerUid,
    storage_path: item.storagePath,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    sha256: item.sha256,
    width: item.width,
    height: item.height,
    scan_status: "unavailable",
    visibility: input.visibility || "public",
    created_at: nowIso,
    updated_at: nowIso,
  })));
  if (error) {
    await removeUploaded(input.uploaded.map((item) => item.storagePath));
    throw new Error("support_attachment_insert_failed");
  }
}

async function resolveTechnicalContext(auth: SupportAuthContext, fields: SupportReportFields) {
  if (!fields.includeTechnicalContext) return undefined;
  const clientContext = fields.technicalContext;
  let workspace: Awaited<ReturnType<typeof resolveActiveWorkspaceContext>> | null = null;
  if (clientContext?.workspaceId) {
    workspace = await resolveActiveWorkspaceContext(auth.uid, clientContext.workspaceId);
  }
  return {
    ...clientContext,
    plan: auth.plan,
    workspaceId: workspace?.workspaceId || undefined,
    workspaceType: workspace?.workspaceType,
  } satisfies SupportTechnicalContext;
}

async function removeUploaded(paths: string[]) {
  if (paths.length === 0) return;
  const supabase = getSupabaseServiceClient();
  await supabase.storage.from(SUPPORT_EVIDENCE_BUCKET).remove(paths);
}

export async function createSupportReport(request: NextRequest, auth: SupportAuthContext) {
  const { fields, files } = await parseRequest(request);
  if (files.length > MAX_SUPPORT_ATTACHMENTS) throw new Error("too_many_attachments");

  const supabase = getSupabaseServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from("support_requests")
    .select("id,raw")
    .eq("uid", auth.uid)
    .eq("client_request_id", fields.clientRequestId)
    .maybeSingle();
  if (existingError) throw new Error("support_idempotency_lookup_failed");
  if (existing) {
    const raw = (existing.raw as Record<string, unknown> | null) || {};
    return {
      id: String(existing.id),
      protocol: String(raw.protocol || ""),
      type: fields.type,
      duplicated: true,
    };
  }

  const ticketId = crypto.randomUUID();
  const uploaded = await uploadSupportEvidence({ ownerUid: auth.uid, ticketId, files });

  try {
    const nowIso = new Date().toISOString();
    const protocol = formatProtocol(new Date(nowIso));
    const priority = inferPriority(fields.type, `${fields.title} ${fields.description} ${fields.actualResult || ""}`);
    const technicalContext = await resolveTechnicalContext(auth, fields);
    const raw: Record<string, unknown> = {
      uid: auth.uid,
      protocol,
      type: fields.type,
      status: "pending",
      priority,
      slaDueAt: computeSlaDueAt(nowIso, fields.type, priority),
      firstResponseAt: null,
      resolvedAt: null,
      staffSeenBy: [],
      createdAt: nowIso,
      updatedAt: nowIso,
      platform: "web",
      report: {
        title: fields.title,
        stepsToReproduce: fields.stepsToReproduce,
        expectedResult: fields.expectedResult,
        actualResult: fields.actualResult,
      },
      reporter: {
        subjectUid: auth.uid,
        submittedByUid: auth.requesterUid,
        submittedByRole: auth.requesterRole,
        isImpersonating: auth.isImpersonating,
      },
      technicalContext,
      secureSupport: encryptServerPayload({
        email: auth.email,
        name: auth.name,
        title: fields.title,
        message: fields.description,
        stepsToReproduce: fields.stepsToReproduce,
        expectedResult: fields.expectedResult,
        actualResult: fields.actualResult,
      }),
      ...(fields.type === "feature" ? { votes: 0 } : {}),
    };

    const { error: ticketError } = await supabase.from("support_requests").insert({
      id: ticketId,
      uid: auth.uid,
      protocol,
      workspace_id: technicalContext?.workspaceId || null,
      workspace_type: technicalContext?.workspaceType || null,
      effective_plan: auth.plan,
      report_route: technicalContext?.route || null,
      app_version: technicalContext?.appVersion || null,
      browser: technicalContext?.browser || null,
      email: auth.email,
      name: auth.name,
      title: fields.title,
      message: fields.description,
      ticket_type: fields.type,
      ticket_status: "pending",
      client_request_id: fields.clientRequestId,
      staff_seen_by: [],
      votes: fields.type === "feature" ? 0 : null,
      created_at: nowIso,
      updated_at: nowIso,
      raw,
    });
    if (ticketError) {
      if (ticketError.code === "23505") {
        await removeUploaded(uploaded.map((item) => item.storagePath));
        const { data: duplicate } = await supabase
          .from("support_requests")
          .select("id,raw")
          .eq("uid", auth.uid)
          .eq("client_request_id", fields.clientRequestId)
          .single();
        const duplicateRaw = (duplicate?.raw as Record<string, unknown> | null) || {};
        return { id: String(duplicate?.id || ""), protocol: String(duplicateRaw.protocol || ""), type: fields.type, duplicated: true };
      }
      throw new Error("support_request_insert_failed");
    }

    if (uploaded.length > 0) {
      try {
        await persistSupportEvidence({ ownerUid: auth.uid, ticketId, uploaded });
      } catch {
        await supabase.from("support_requests").delete().eq("id", ticketId);
        throw new Error("support_attachment_insert_failed");
      }
    }

    const { error: eventError } = await supabase.from("support_request_events").insert({
      id: crypto.randomUUID(),
      ticket_id: ticketId,
      actor_uid: auth.requesterUid,
      event_type: "created",
      visibility: "public",
      metadata: { protocol, type: fields.type, impersonating: auth.isImpersonating },
      created_at: nowIso,
    });
    if (eventError) {
      await supabase.from("support_requests").delete().eq("id", ticketId);
      throw new Error("support_event_write_failed");
    }

    return { id: ticketId, protocol, type: fields.type, duplicated: false };
  } catch (error) {
    await removeUploaded(uploaded.map((item) => item.storagePath));
    throw error;
  }
}

export function isFinalSupportStatus(status: string) {
  return FINAL_STATUSES.has(status.toLowerCase());
}
