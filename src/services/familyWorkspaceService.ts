"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import type { FamilyPermission, FamilyRole, WorkspaceInvitation, WorkspaceMember } from "@/types/workspace";

export type FamilyWorkspacePayload = {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
};

export type InviteFamilyMemberInput = {
  workspaceId: string;
  email: string;
  displayName?: string;
  role: FamilyRole;
  permissions?: FamilyPermission[];
  inviteMode: "temporary_password" | "auto_password" | "self_setup";
  temporaryPassword?: string;
};

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

async function readPayload<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível gerenciar a família");
  }
  return payload;
}

export async function getFamilyWorkspace(workspaceId: string) {
  const response = await apiFetch(`/api/workspaces/family?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "GET",
  });
  const payload = await readPayload<FamilyWorkspacePayload & { ok: true }>(response);
  return { members: payload.members, invitations: payload.invitations };
}

export async function inviteFamilyMember(input: InviteFamilyMemberInput) {
  const response = await apiFetch("/api/workspaces/family", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const payload = await readPayload<{
    ok: true;
    member: WorkspaceMember;
    invitation: WorkspaceInvitation;
    generatedPasswordExposed: false;
    emailSent: boolean;
  }>(response);
  return payload;
}

export async function resendFamilyInvitation(input: {
  workspaceId: string;
  invitationId: string;
}) {
  const response = await apiFetch("/api/workspaces/family", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const payload = await readPayload<{ ok: true; invitation: WorkspaceInvitation; emailSent: boolean }>(response);
  return payload;
}

export async function resendFamilyMemberAccess(input: {
  workspaceId: string;
  memberUid: string;
}) {
  const response = await apiFetch("/api/workspaces/family", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  const payload = await readPayload<{ ok: true; member: WorkspaceMember; emailSent: boolean }>(response);
  return payload;
}

export async function updateFamilyMember(input: {
  workspaceId: string;
  memberUid: string;
  role?: FamilyRole;
  permissions?: FamilyPermission[];
  status?: "active" | "pending" | "disabled";
}) {
  const response = await apiFetch("/api/workspaces/family", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const payload = await readPayload<{ ok: true; member: WorkspaceMember }>(response);
  return payload.member;
}

export async function acceptFamilyInvitation() {
  const response = await apiFetch("/api/workspaces/family/accept", {
    method: "POST",
  });
  const payload = await readPayload<{
    ok: true;
    members: WorkspaceMember[];
    invitations: WorkspaceInvitation[];
  }>(response);
  return payload;
}
