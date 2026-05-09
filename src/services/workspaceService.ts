"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@/types/workspace";

const WORKSPACES_CHANGED_EVENT = "wevenfinance:workspaces:changed";

function emitWorkspacesChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
}

async function apiFetch(path: string, init?: RequestInit) {
  const token = await getAccessTokenOrThrow();
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...getImpersonationHeader(),
      ...(init?.headers || {}),
    },
  });
}

type WorkspacesPayload = {
  ok: boolean;
  error?: string;
  workspaces?: Workspace[];
  defaultWorkspace?: Workspace | null;
  workspace?: Workspace;
};

async function readPayload(response: Response): Promise<WorkspacesPayload> {
  const payload = (await response.json()) as WorkspacesPayload;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar contextos");
  }
  return payload;
}

export async function getUserWorkspaces() {
  const response = await apiFetch("/api/workspaces", { method: "GET" });
  const payload = await readPayload(response);
  return payload.workspaces || [];
}

export async function getDefaultWorkspace() {
  const response = await apiFetch("/api/workspaces?default=1", { method: "GET" });
  const payload = await readPayload(response);
  return payload.defaultWorkspace || null;
}

export async function createWorkspace(input: CreateWorkspaceInput) {
  const response = await apiFetch("/api/workspaces", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const payload = await readPayload(response);
  emitWorkspacesChanged();
  return payload.workspace as Workspace;
}

export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const response = await apiFetch("/api/workspaces", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const payload = await readPayload(response);
  emitWorkspacesChanged();
  return payload.workspace as Workspace;
}

export async function setDefaultWorkspace(id: string) {
  return updateWorkspace({ id, isDefault: true });
}

export async function ensureDefaultWorkspace(input?: CreateWorkspaceInput) {
  const response = await apiFetch("/api/workspaces", {
    method: "PATCH",
    body: JSON.stringify({ action: "ensureDefault", workspace: input }),
  });
  const payload = await readPayload(response);
  emitWorkspacesChanged();
  return payload.defaultWorkspace || payload.workspace || null;
}

export function subscribeToWorkspacesChanged(callback: () => void) {
  window.addEventListener(WORKSPACES_CHANGED_EVENT, callback);
  return () => window.removeEventListener(WORKSPACES_CHANGED_EVENT, callback);
}
