"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import type { FamilyPermission, FamilyRole, PendingWorkspaceInvitation, WorkspaceInvitation, WorkspaceMember, WorkspaceSeatSummary } from "@/types/workspace";

export type FamilyWorkspacePayload = {
  members: WorkspaceMember[];
  invitations: WorkspaceInvitation[];
  seats: WorkspaceSeatSummary;
};

export type InviteFamilyMemberInput = {
  workspaceId: string;
  email: string;
  displayName?: string;
  role: FamilyRole;
  permissions?: FamilyPermission[];
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
    const messages: Record<string, string> = {
      subscription_cancellation_confirmation_required: "Confirme o cancelamento do plano individual antes de aceitar.",
      subscription_not_found: "A assinatura individual não foi encontrada no Mercado Pago. Revise a conta de cobrança antes de aceitar.",
      additional_seat_price_not_configured: "O valor do usuário adicional ainda não foi configurado.",
      cannot_remove_occupied_seats: "Remova membros ou convites pendentes antes de reduzir os usuários adicionais.",
      subscription_not_active_for_seat_change: "É necessário ter uma assinatura ativa para alterar os usuários adicionais.",
      invitation_not_found: "Este convite não está mais disponível.",
    };
    throw new Error((payload.error && messages[payload.error]) || payload.error || "Não foi possível gerenciar a família");
  }
  return payload;
}

export async function getFamilyWorkspace(workspaceId: string) {
  const response = await apiFetch(`/api/workspaces/family?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "GET",
  });
  const payload = await readPayload<FamilyWorkspacePayload & { ok: true }>(response);
  return { members: payload.members, invitations: payload.invitations, seats: payload.seats };
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
    recipientType: "existing_account" | "new_account";
    seats: WorkspaceSeatSummary;
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

export async function closeFamilyWorkspace(workspaceId: string) {
  const response = await apiFetch(`/api/workspaces/family?workspaceId=${encodeURIComponent(workspaceId)}`, {
    method: "DELETE",
  });
  await readPayload<{ ok: true }>(response);
}

export async function getPendingFamilyInvitations() {
  const response = await apiFetch("/api/workspaces/family/accept", { method: "GET" });
  const payload = await readPayload<{ ok: true; invitations: PendingWorkspaceInvitation[] }>(response);
  return payload.invitations;
}

export async function acceptFamilyInvitation(invitationId?: string, cancelCurrentSubscription = false) {
  const response = await apiFetch("/api/workspaces/family/accept", {
    method: "POST",
    body: JSON.stringify({ ...(invitationId ? { invitationId } : {}), cancelCurrentSubscription }),
  });
  const payload = await readPayload<{
    ok: true;
    members: WorkspaceMember[];
    invitations: WorkspaceInvitation[];
    subscriptionCanceled: boolean;
  }>(response);
  return payload;
}

export async function rejectFamilyInvitation(invitationId: string) {
  const response = await apiFetch(`/api/workspaces/family/accept?invitationId=${encodeURIComponent(invitationId)}`, {
    method: "DELETE",
  });
  await readPayload<{ ok: true }>(response);
}

export async function updateAdditionalFamilySeats(workspaceId: string, quantity: number) {
  const response = await apiFetch("/api/billing/additional-seats", {
    method: "POST",
    body: JSON.stringify({ workspaceId, quantity }),
  });
  return readPayload<{
    ok: true;
    seats: WorkspaceSeatSummary;
    amount: number;
    interval: "monthly" | "yearly";
    nextChargeAt: string | null;
    chargePolicy: "next_renewal_no_immediate_charge";
  }>(response);
}
