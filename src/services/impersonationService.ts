import {
  clearImpersonationTargetUid,
  getImpersonationTargetUid,
  setImpersonationTargetUid,
} from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";

export type SupportAccessRequest = {
  id: string;
  requesterUid: string;
  requesterDisplayName: string;
  requesterEmail: string;
  requesterRole: "admin" | "moderator" | "support" | "client";
  targetUid: string;
  targetDisplayName: string;
  targetEmail: string;
  targetRole: "admin" | "moderator" | "support" | "client";
  status: "pending" | "approved" | "rejected" | "revoked" | "expired";
  permissionImpersonate: boolean | null;
  createdAt: string;
  updatedAt: string;
  handledAt?: string | null;
  expiresAt?: string | null;
};

export type ImpersonationActionRequest = {
  id: string;
  requesterUid: string;
  requesterDisplayName: string;
  requesterEmail: string;
  requesterRole: "admin" | "moderator" | "support" | "client";
  targetUid: string;
  targetDisplayName: string;
  targetEmail: string;
  targetRole: "admin" | "moderator" | "support" | "client";
  actionType: string;
  actionLabel: string;
  status: "pending" | "approved" | "rejected" | "consumed" | "expired";
  permissionImpersonate: boolean | null;
  createdAt: string;
  updatedAt: string;
  handledAt?: string | null;
  expiresAt?: string | null;
  consumedAt?: string | null;
};

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getIdTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
}

export async function requestImpersonationAccess(targetUid: string) {
  const response = await apiFetch("/api/impersonation", {
    method: "POST",
    body: JSON.stringify({ action: "request", targetUid }),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    requestId?: string;
    status?: string;
    alreadyPending?: boolean;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível solicitar acesso");
  }
  return payload;
}

export async function getPendingImpersonationRequests() {
  const response = await apiFetch("/api/impersonation?mode=pending", {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    requests?: SupportAccessRequest[];
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível listar solicitações pendentes");
  }
  return payload.requests || [];
}

export async function respondImpersonationRequest(requestId: string, approved: boolean) {
  const response = await apiFetch("/api/impersonation", {
    method: "POST",
    body: JSON.stringify({ action: "respond", requestId, approved }),
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    status?: "approved" | "rejected";
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível responder solicitação");
  }
  return payload;
}

export async function getMyImpersonationStatus(targetUid: string) {
  const response = await apiFetch(`/api/impersonation?mode=status&targetUid=${encodeURIComponent(targetUid)}`, {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    approved?: boolean;
    request?: SupportAccessRequest | null;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível consultar status da solicitação");
  }
  return payload;
}

export async function getPendingImpersonationActionRequests() {
  const response = await apiFetch("/api/impersonation?mode=pending-actions", {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    requests?: ImpersonationActionRequest[];
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível listar solicitações de ação");
  }
  return payload.requests || [];
}

export async function respondImpersonationActionRequest(actionRequestId: string, approved: boolean) {
  const response = await apiFetch("/api/impersonation", {
    method: "POST",
    body: JSON.stringify({ action: "respond-action", actionRequestId, approved }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível responder solicitação de ação");
  }
}

export async function getImpersonationActionStatus(actionRequestId: string) {
  const response = await apiFetch(`/api/impersonation?mode=action-status&actionRequestId=${encodeURIComponent(actionRequestId)}`, {
    method: "GET",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    request?: ImpersonationActionRequest | null;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível consultar status da ação");
  }
  return payload;
}

export function activateImpersonation(targetUid: string) {
  setImpersonationTargetUid(targetUid);
}

export function deactivateImpersonation() {
  clearImpersonationTargetUid();
}

export function getActiveImpersonationTargetUid() {
  return getImpersonationTargetUid();
}
