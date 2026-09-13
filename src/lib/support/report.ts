export const SUPPORT_REPORT_TYPES = ["bug", "support", "feature"] as const;
export type SupportReportType = (typeof SUPPORT_REPORT_TYPES)[number];

export const SUPPORT_EVIDENCE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type SupportEvidenceMimeType = (typeof SUPPORT_EVIDENCE_MIME_TYPES)[number];

export const MAX_SUPPORT_ATTACHMENTS = 3;
export const MAX_SUPPORT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_SUPPORT_DAILY_ATTACHMENTS = 20;
export const MAX_SUPPORT_DAILY_BYTES = 50 * 1024 * 1024;
export const SUPPORT_EVIDENCE_RETENTION_DAYS = 180;

export type SupportTechnicalContext = {
  route?: string;
  appVersion?: string;
  browser?: string;
  operatingSystem?: string;
  viewport?: string;
  locale?: string;
  timezone?: string;
  workspaceId?: string;
  workspaceType?: string;
  plan?: string;
  featureFlags?: string[];
};

export type SupportReportFields = {
  type: SupportReportType;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  includeTechnicalContext: boolean;
  technicalContext?: SupportTechnicalContext;
  clientRequestId: string;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_CONTEXT_TEXT = /^[\p{L}\p{N} ._:/@+()\-[\]]*$/u;
const SUSPICIOUS_INNER_EXTENSION = /\.(?:svg|gif|pdf|html?|js|mjs|exe|bat|cmd|ps1|php|sh|zip|rar|7z)\.(?:png|jpe?g|webp)$/i;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanContextText(value: unknown, maxLength: number) {
  const cleaned = cleanText(value, maxLength);
  return SAFE_CONTEXT_TEXT.test(cleaned) ? cleaned : "";
}

export function normalizeSupportReportType(value: unknown): SupportReportType {
  return SUPPORT_REPORT_TYPES.includes(value as SupportReportType) ? (value as SupportReportType) : "support";
}

export function sanitizeSupportTechnicalContext(value: unknown): SupportTechnicalContext | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  const routeValue = cleanText(input.route, 300);
  const route = routeValue.startsWith("/") ? routeValue.split(/[?#]/, 1)[0] : "";
  const featureFlags = Array.isArray(input.featureFlags)
    ? input.featureFlags
        .map((flag) => cleanContextText(flag, 80))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const context: SupportTechnicalContext = {
    route: route || undefined,
    appVersion: cleanContextText(input.appVersion, 80) || undefined,
    browser: cleanContextText(input.browser, 160) || undefined,
    operatingSystem: cleanContextText(input.operatingSystem, 120) || undefined,
    viewport: cleanContextText(input.viewport, 40) || undefined,
    locale: cleanContextText(input.locale, 40) || undefined,
    timezone: cleanContextText(input.timezone, 80) || undefined,
    workspaceId: cleanContextText(input.workspaceId, 160) || undefined,
    workspaceType: cleanContextText(input.workspaceType, 40) || undefined,
    featureFlags,
  };
  return Object.values(context).some((item) => Array.isArray(item) ? item.length > 0 : Boolean(item))
    ? context
    : undefined;
}

export function parseSupportReportFields(value: Record<string, unknown>): SupportReportFields {
  const rawTitle = typeof value.title === "string" ? value.title.trim() : "";
  const rawDescriptionValue = value.description ?? value.message;
  const rawDescription = typeof rawDescriptionValue === "string" ? rawDescriptionValue.trim() : "";
  if (rawTitle.length > 120 || rawDescription.length > 5_000) throw new Error("invalid_payload");
  const type = normalizeSupportReportType(value.type);
  const title = cleanText(rawTitle, 120);
  const description = cleanText(rawDescription, 5_000);
  const stepsToReproduce = cleanText(value.stepsToReproduce, 3_000);
  const expectedResult = cleanText(value.expectedResult, 2_000);
  const actualResult = cleanText(value.actualResult, 2_000);
  const clientRequestId = cleanText(value.clientRequestId, 64);
  const includeTechnicalContext = value.includeTechnicalContext !== false && value.includeTechnicalContext !== "false";

  if (!description || description.length < 10) throw new Error("description_too_short");
  if (type === "bug" && !title) throw new Error("title_required");
  if (clientRequestId && !UUID_REGEX.test(clientRequestId)) throw new Error("invalid_client_request_id");

  return {
    type,
    title: title || description.slice(0, 80),
    description,
    stepsToReproduce: stepsToReproduce || undefined,
    expectedResult: expectedResult || undefined,
    actualResult: actualResult || undefined,
    includeTechnicalContext,
    technicalContext: includeTechnicalContext ? sanitizeSupportTechnicalContext(value.technicalContext) : undefined,
    clientRequestId: clientRequestId || crypto.randomUUID(),
  };
}

export function canReadSupportAttachment(input: {
  authUid: string;
  ticketUid: string;
  ownerUid: string;
  canReadStaff: boolean;
}) {
  return input.canReadStaff || (
    Boolean(input.authUid) &&
    input.authUid === input.ticketUid &&
    input.authUid === input.ownerUid
  );
}

export function computeSupportEvidenceRetentionUntil(now = new Date()) {
  return new Date(now.getTime() + SUPPORT_EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1_000).toISOString();
}

export function detectSupportEvidenceMime(bytes: Uint8Array): SupportEvidenceMimeType | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    return "image/webp";
  }
  return null;
}

export function validateSupportEvidenceSize(size: number) {
  if (!Number.isFinite(size) || size <= 0) throw new Error("empty_file");
  if (size > MAX_SUPPORT_ATTACHMENT_BYTES) throw new Error("file_too_large");
}

export function validateSupportEvidenceIdentity(input: {
  fileName: string;
  declaredMime: string;
  detectedMime: SupportEvidenceMimeType | null;
}) {
  const name = input.fileName.trim();
  if (!name || name.length > 180 || name.includes("/") || name.includes("\\") || SUSPICIOUS_INNER_EXTENSION.test(name)) {
    throw new Error("invalid_file_name");
  }
  const extension = name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || "";
  const allowedExtensions: Record<SupportEvidenceMimeType, string[]> = {
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
  };
  if (!input.detectedMime || !SUPPORT_EVIDENCE_MIME_TYPES.includes(input.declaredMime as SupportEvidenceMimeType)) {
    throw new Error("unsupported_file_type");
  }
  if (input.declaredMime !== input.detectedMime || !allowedExtensions[input.detectedMime].includes(extension)) {
    throw new Error("file_type_mismatch");
  }
  return input.detectedMime;
}

export function extensionForSupportEvidence(mime: SupportEvidenceMimeType) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}
