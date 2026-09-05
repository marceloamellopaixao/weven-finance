"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@/types/workspace";

const WORKSPACES_CHANGED_EVENT = "wevenfinance:workspaces:changed";
const ACTIVE_WORKSPACE_CHANGED_EVENT = "wevenfinance:workspaces:active-changed";
const ACTIVE_WORKSPACE_KEY = "wevenfinance:active-workspace-id:v1";
const ACTIVE_WORKSPACE_OWNER_KEY = "wevenfinance:active-workspace-owner-uid:v1";

let workspacesCache: Workspace[] | null = null;
let workspacesCacheAt = 0;
let workspacesInFlight: Promise<Workspace[]> | null = null;
const WORKSPACES_CACHE_TTL_MS = 15_000;

function emitWorkspacesChanged() {
  if (typeof window === "undefined") return;
  workspacesCache = null;
  workspacesCacheAt = 0;
  window.dispatchEvent(new Event(WORKSPACES_CHANGED_EVENT));
}

function emitActiveWorkspaceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(ACTIVE_WORKSPACE_CHANGED_EVENT));
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
    const messages: Record<string, string> = {
      workspace_profile_limit_reached: "Seu plano permite somente um perfil financeiro próprio.",
      invalid_business_document: "Confira o CNPJ informado. O número digitado não é válido.",
    };
    throw new Error((payload.error && messages[payload.error]) || payload.error || "Não foi possível carregar contextos");
  }
  return payload;
}

export async function getUserWorkspaces() {
  const now = Date.now();
  if (workspacesCache && now - workspacesCacheAt < WORKSPACES_CACHE_TTL_MS) {
    return workspacesCache;
  }
  if (workspacesInFlight) return workspacesInFlight;
  workspacesInFlight = (async () => {
    const response = await apiFetch("/api/workspaces", { method: "GET" });
    const payload = await readPayload(response);
    const next = payload.workspaces || [];
    workspacesCache = next;
    workspacesCacheAt = Date.now();
    return next;
  })();
  try {
    return await workspacesInFlight;
  } finally {
    workspacesInFlight = null;
  }
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

export async function deleteWorkspace(input: { id: string; mode: "archive" | "delete_data" }) {
  const response = await apiFetch("/api/workspaces", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
  await readPayload(response);
  emitWorkspacesChanged();
}

export function getActiveWorkspaceId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

export function getActiveWorkspaceOwnerUid() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_WORKSPACE_OWNER_KEY);
}

export function setActiveWorkspaceId(workspaceId: string, ownerUid?: string | null) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
  if (ownerUid) localStorage.setItem(ACTIVE_WORKSPACE_OWNER_KEY, ownerUid);
  else localStorage.removeItem(ACTIVE_WORKSPACE_OWNER_KEY);
  emitActiveWorkspaceChanged();
}

export function clearActiveWorkspaceId() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
  localStorage.removeItem(ACTIVE_WORKSPACE_OWNER_KEY);
  emitActiveWorkspaceChanged();
}

export function subscribeToActiveWorkspaceChanged(callback: () => void) {
  window.addEventListener(ACTIVE_WORKSPACE_CHANGED_EVENT, callback);
  return () => window.removeEventListener(ACTIVE_WORKSPACE_CHANGED_EVENT, callback);
}
