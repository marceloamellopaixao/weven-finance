import type { SupportReportType } from "@/lib/support/report";

export const SUPPORT_REOPEN_WINDOW_DAYS = 14;
export const SUPPORT_MESSAGE_MAX_LENGTH = 5_000;

export type SupportActor = {
  authUid: string;
  requesterUid: string;
  isImpersonating: boolean;
  canReadStaff: boolean;
  canWriteStaff: boolean;
};

export type SupportTicketAccess = {
  ticketUid: string;
  workspaceId?: string | null;
};

export function getSupportAccess(actor: SupportActor, ticket: SupportTicketAccess) {
  const isOwner = Boolean(actor.authUid) && actor.authUid === ticket.ticketUid;
  return {
    isOwner,
    canRead: isOwner || actor.canReadStaff,
    canReplyPublic: (isOwner && !actor.isImpersonating) || (actor.canWriteStaff && !actor.isImpersonating),
    canWriteInternal: actor.canWriteStaff && !actor.isImpersonating,
    canMutateTicket: actor.canWriteStaff && !actor.isImpersonating,
  };
}

export function normalizeSupportMessage(value: unknown) {
  if (typeof value !== "string") throw new Error("invalid_message");
  const message = value.trim();
  if (!message || message.length > SUPPORT_MESSAGE_MAX_LENGTH) throw new Error("invalid_message");
  return message;
}

export function canReopenSupportTicket(input: { status: string; resolvedAt?: string | null; now?: Date }) {
  if (!new Set(["resolved", "implemented", "rejected"]).has(input.status)) return false;
  if (!input.resolvedAt) return false;
  const resolvedAt = new Date(input.resolvedAt).getTime();
  if (!Number.isFinite(resolvedAt)) return false;
  const now = (input.now || new Date()).getTime();
  return now - resolvedAt <= SUPPORT_REOPEN_WINDOW_DAYS * 24 * 60 * 60 * 1_000;
}

export function reopenedStatusForType(type: SupportReportType) {
  return type === "feature" ? "under_review" : "in_progress";
}

export function publicSupportEventMetadata(eventType: string, metadata: Record<string, unknown>) {
  const allowedByType: Record<string, string[]> = {
    created: ["protocol", "type"],
    status_changed: ["from", "to"],
    assigned: ["assigned"],
    public_reply: [],
    information_requested: [],
    attachment_added: ["attachmentId"],
    attachment_removed: ["attachmentId"],
    reopened: ["from", "to"],
  };
  const allowed = allowedByType[eventType] || [];
  return Object.fromEntries(allowed.filter((key) => metadata[key] !== undefined).map((key) => [key, metadata[key]]));
}
