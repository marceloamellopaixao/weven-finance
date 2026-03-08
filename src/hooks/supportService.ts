import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

export type SupportRequestStatus = "pending" | "in_progress" | "resolved" | "rejected";
export type FeatureRequestStatus = "pending" | "under_review" | "approved" | "rejected" | "implemented";

export interface SupportTicket {
  id: string;
  uid: string;
  email: string;
  name: string;
  message: string;
  type: "support" | "feature";
  status: SupportRequestStatus | FeatureRequestStatus;
  createdAt: Date;
  platform: string;
  assignedTo?: string;
  assignedToName?: string;
  staffSeenBy?: string[];
}

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
      ...(init?.headers || {}),
    },
  });
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

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao enviar solicitacao de suporte");
  }
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

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao enviar sugestao");
  }
};

async function getTickets(): Promise<SupportTicket[]> {
  const response = await fetchWithAuth("/api/support-requests", {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    tickets?: Array<Omit<SupportTicket, "createdAt"> & { createdAt?: string | null }>;
  };

  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao buscar tickets de suporte");
  }

  return (payload.tickets || []).map((ticket) => ({
    ...ticket,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt) : new Date(),
  }));
}

export const subscribeToSupportTickets = (
  _userUid: string,
  _userRole: string,
  onChange: (tickets: SupportTicket[]) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const tickets = await getTickets();
      if (!cancelled) onChange(tickets);
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
  const onFocus = () => void run();
  window.addEventListener("focus", onFocus);

  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
    window.removeEventListener("focus", onFocus);
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

