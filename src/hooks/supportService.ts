import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import type { SupportReportType, SupportTechnicalContext } from "@/lib/support/report";

export type SupportRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type FeatureRequestStatus = "pending" | "under_review" | "approved" | "rejected" | "implemented";

export interface SupportTicket {
  id: string;
  uid: string;
  email: string;
  name: string;
  protocol?: string;
  title?: string;
  message: string;
  type: SupportReportType;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  technicalContext?: SupportTechnicalContext;
  reportedDuringImpersonation?: boolean;
  attachments?: SupportAttachment[];
  supportKind?: string;
  wantsData?: boolean;
  status: SupportRequestStatus | FeatureRequestStatus;
  priority?: "low" | "medium" | "high" | "urgent";
  createdAt: Date;
  updatedAt?: string | null;
  platform: string;
  assignedTo?: string;
  assignedToName?: string;
  staffSeenBy?: string[];
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  slaDueAt?: string | null;
  slaBreached?: boolean;
  workspaceId?: string;
  workspaceType?: string;
  effectivePlan?: string;
  reportRoute?: string;
  appVersion?: string;
  browser?: string;
}

export type SupportActivity = {
  ticketId: string;
  protocol: string;
  status: string;
  assignedToName: string | null;
  updatedAt: string;
  messages: Array<{ id: string; visibility: "public" | "internal"; message: string; author: "you" | "support" | "client"; createdAt: string }>;
  events: Array<{ id: string; type: string; visibility: "public" | "internal"; metadata: Record<string, unknown>; actor: "you" | "support"; createdAt: string }>;
  attachments: SupportAttachment[];
  canReply: boolean;
  canWriteInternal: boolean;
  canRequestAccess: boolean;
  canReopen: boolean;
  reopenWindowDays: number;
};

export type SupportTicketFilters = {
  assignedTo?: string;
  route?: string;
  appVersion?: string;
  browser?: string;
  plan?: string;
  workspaceId?: string;
};

export type SupportAttachment = {
  id: string;
  ticketId: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  scanStatus: "pending" | "clean" | "rejected" | "unavailable";
  createdAt: string;
};

export type CreateSupportReportInput = {
  type: SupportReportType;
  title: string;
  description: string;
  stepsToReproduce?: string;
  expectedResult?: string;
  actualResult?: string;
  includeTechnicalContext: boolean;
  technicalContext?: SupportTechnicalContext;
  attachments?: File[];
  clientRequestId: string;
};

const POLLING_INTERVAL_MS = 20000;

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
}

async function fetchWithAuth(path: string, init?: RequestInit) {
  const idToken = await getIdTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...getImpersonationHeader(),
      ...(init?.headers || {}),
    },
  });
}

export async function createSupportReport(input: CreateSupportReportInput) {
  const token = await getIdTokenOrThrow();
  const form = new FormData();
  form.set("type", input.type);
  form.set("title", input.title);
  form.set("description", input.description);
  form.set("stepsToReproduce", input.stepsToReproduce || "");
  form.set("expectedResult", input.expectedResult || "");
  form.set("actualResult", input.actualResult || "");
  form.set("includeTechnicalContext", String(input.includeTechnicalContext));
  form.set("technicalContext", JSON.stringify(input.technicalContext || {}));
  form.set("clientRequestId", input.clientRequestId);
  for (const file of input.attachments || []) form.append("attachments", file, file.name);

  const response = await fetch("/api/support-requests", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Idempotency-Key": input.clientRequestId,
      ...getImpersonationHeader(),
    },
    body: form,
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    id?: string;
    protocol?: string;
    duplicated?: boolean;
  };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "support_report_failed");
  return payload;
}

export async function getSupportAttachmentUrl(attachmentId: string, action: "view" | "download" = "view") {
  const response = await fetchWithAuth(
    `/api/support-requests/attachments?attachmentId=${encodeURIComponent(attachmentId)}&action=${action}`,
    { method: "GET" },
  );
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    attachment?: SupportAttachment & { url: string; expiresIn: number };
  };
  if (!response.ok || !payload.ok || !payload.attachment) {
    throw new Error(payload.error || "support_attachment_url_failed");
  }
  return payload.attachment;
}

export const sendSupportRequest = async (_uid: string, _email: string, _name: string, reason: string) => {
  const response = await fetchWithAuth("/api/support-requests", {
    method: "POST",
    body: JSON.stringify({
      type: "support",
      message: reason,
      status: "pending",
      platform: "web",
    }),
  });

  const payload = (await response.json()) as { ok: boolean; error?: string; protocol?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao enviar solicitação de suporte");
  }
  return { protocol: payload.protocol || null };
};

export const sendFeatureRequest = async (_uid: string, _email: string, _name: string, idea: string) => {
  const response = await fetchWithAuth("/api/support-requests", {
    method: "POST",
    body: JSON.stringify({
      type: "feature",
      message: idea,
      status: "pending",
      platform: "web",
    }),
  });

  const payload = (await response.json()) as { ok: boolean; error?: string; protocol?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao enviar sugestao");
  }
  return { protocol: payload.protocol || null };
};

type SupportTicketsPage = {
  tickets: SupportTicket[];
  total: number;
  page: number;
  limit: number;
  unseenCount: number;
};

async function getTickets(params?: {
  page?: number;
  limit?: number;
  scope?: "mine" | "all";
  type?: SupportReportType | "all";
  status?: string;
  priority?: "low" | "medium" | "high" | "urgent" | "all";
  q?: string;
} & SupportTicketFilters): Promise<SupportTicketsPage> {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, Number(params?.page || 1))));
  query.set("limit", String(Math.max(1, Math.min(100, Number(params?.limit || 20)))));
  if (params?.scope === "mine") query.set("scope", "mine");
  if (params?.type && params.type !== "all") query.set("type", params.type);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.priority && params.priority !== "all") query.set("priority", params.priority);
  if (params?.q?.trim()) query.set("q", params.q.trim());
  if (params?.assignedTo && params.assignedTo !== "all") query.set("assignedTo", params.assignedTo);
  if (params?.route && params.route !== "all") query.set("route", params.route);
  if (params?.appVersion && params.appVersion !== "all") query.set("appVersion", params.appVersion);
  if (params?.browser && params.browser !== "all") query.set("browser", params.browser);
  if (params?.plan && params.plan !== "all") query.set("plan", params.plan);
  if (params?.workspaceId && params.workspaceId !== "all") query.set("workspaceId", params.workspaceId);

  const response = await fetchWithAuth(`/api/support-requests?${query.toString()}`, {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    tickets?: Array<Omit<SupportTicket, "createdAt"> & { createdAt?: string | null }>;
    total?: number;
    page?: number;
    limit?: number;
    unseenCount?: number;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao buscar tickets de suporte");
  }

  const tickets = (payload.tickets || []).map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
  }));

  return {
    tickets,
    total: Number(payload.total || 0),
    page: Number(payload.page || params?.page || 1),
    limit: Number(payload.limit || params?.limit || 20),
    unseenCount: Number(payload.unseenCount || 0),
  };
}

export async function fetchSupportTicketsPage(params?: {
  page?: number;
  limit?: number;
  scope?: "mine" | "all";
  type?: SupportReportType | "all";
  status?: string;
  priority?: "low" | "medium" | "high" | "urgent" | "all";
  q?: string;
} & SupportTicketFilters) {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, Number(params?.page || 1))));
  query.set("limit", String(Math.max(1, Math.min(100, Number(params?.limit || 20)))));
  if (params?.scope === "mine") query.set("scope", "mine");
  if (params?.type && params.type !== "all") query.set("type", params.type);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.priority && params.priority !== "all") query.set("priority", params.priority);
  if (params?.q?.trim()) query.set("q", params.q.trim());
  if (params?.assignedTo && params.assignedTo !== "all") query.set("assignedTo", params.assignedTo);
  if (params?.route && params.route !== "all") query.set("route", params.route);
  if (params?.appVersion && params.appVersion !== "all") query.set("appVersion", params.appVersion);
  if (params?.browser && params.browser !== "all") query.set("browser", params.browser);
  if (params?.plan && params.plan !== "all") query.set("plan", params.plan);
  if (params?.workspaceId && params.workspaceId !== "all") query.set("workspaceId", params.workspaceId);

  const response = await fetchWithAuth(`/api/support-requests?${query.toString()}`, {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    tickets?: Array<Omit<SupportTicket, "createdAt"> & { createdAt?: string | null }>;
    total?: number;
    page?: number;
    limit?: number;
    unseenCount?: number;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao buscar tickets de suporte");
  }

  return {
    tickets: (payload.tickets || []).map((ticket) => ({
      ...ticket,
      createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
    })),
    total: Number(payload.total || 0),
    page: Number(payload.page || params?.page || 1),
    limit: Number(payload.limit || params?.limit || 20),
    unseenCount: Number(payload.unseenCount || 0),
  };
}

export const subscribeToSupportTickets = (
  _userUid: string,
  _userRole: string,
  onChange: (result: SupportTicketsPage) => void,
  options?: {
    page?: number;
    limit?: number;
    scope?: "mine" | "all";
    type?: SupportReportType | "all";
    status?: string;
    priority?: "low" | "medium" | "high" | "urgent" | "all";
    q?: string;
  },
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const result = await getTickets(options);
      if (!cancelled) onChange(result);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "support_requests",
    onChange: () => void run(),
  });

  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
  };
};

export const updateTicket = async (ticketId: string, updates: Partial<SupportTicket>) => {
  const response = await fetchWithAuth("/api/support-requests", {
    method: "PATCH",
    body: JSON.stringify({
      ticketId,
      updates,
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao atualizar ticket");
  }
};

export const markSupportTicketsAsSeen = async (ticketIds: string[]) => {
  const ids = ticketIds.map((id) => String(id || "").trim()).filter(Boolean);
  if (ids.length === 0) return;
  const response = await fetchWithAuth("/api/support-requests", {
    method: "PATCH",
    body: JSON.stringify({
      action: "markSeen",
      ticketIds: ids,
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao marcar chamados como vistos");
  }
};

export const deleteTicket = async (ticketId: string) => {
  const response = await fetchWithAuth(`/api/support-requests?ticketId=${encodeURIComponent(ticketId)}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao deletar chamado");
  }
};

export async function fetchSupportActivity(ticketId: string) {
  const response = await fetchWithAuth(`/api/support-requests/activity?ticketId=${encodeURIComponent(ticketId)}`, { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; activity?: SupportActivity };
  if (!response.ok || !payload.ok || !payload.activity) throw new Error(payload.error || "support_activity_failed");
  return payload.activity;
}

export async function postSupportActivity(input: { ticketId: string; action: "reply" | "internal_note" | "request_info" | "reopen"; message?: string; attachments?: File[] }) {
  const token = await getIdTokenOrThrow();
  const form = new FormData();
  form.set("ticketId", input.ticketId);
  form.set("action", input.action);
  if (input.message) form.set("message", input.message);
  for (const file of input.attachments || []) form.append("attachments", file, file.name);
  const response = await fetch("/api/support-requests/activity", { method: "POST", headers: { Authorization: `Bearer ${token}`, ...getImpersonationHeader() }, body: form });
  const payload = (await response.json()) as { ok: boolean; error?: string; status?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "support_activity_write_failed");
  return payload;
}

export async function removeSupportAttachment(attachmentId: string) {
  const response = await fetchWithAuth(`/api/support-requests/attachments?attachmentId=${encodeURIComponent(attachmentId)}`, { method: "DELETE" });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "support_attachment_delete_failed");
}

