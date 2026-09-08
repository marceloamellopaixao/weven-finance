"use client";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import type {
  BusinessPermission,
  BusinessRole,
  BusinessWorkspaceInvitation,
  BusinessWorkspaceMember,
  WorkspaceSeatSummary,
} from "@/types/workspace";

export type BusinessWorkspacePayload = {
  members: BusinessWorkspaceMember[];
  invitations: BusinessWorkspaceInvitation[];
  seats: WorkspaceSeatSummary;
  pagination: { page: number; limit: number; total: number; pages: number };
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
  const payload = await response.json() as T & { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    const messages: Record<string, string> = {
      business_plan_required: "Contrate o plano Business/PJ antes de convidar pessoas para a equipe.",
      business_seat_limit_reached: "Não há usuários disponíveis. Adicione um usuário adicional antes de convidar outra pessoa.",
      business_member_already_invited: "Esta pessoa já pertence à equipe ou possui um convite pendente.",
      business_seat_capacity_changed: "A capacidade da equipe mudou. Atualize a página e tente novamente.",
      cannot_invite_yourself: "Você já é o responsável por este perfil e não precisa enviar um convite para si mesmo.",
      cannot_assign_business_owner: "A titularidade do perfil não pode ser atribuída por esta tela.",
      cannot_modify_business_owner: "O proprietário do perfil não pode ser alterado por esta tela.",
      additional_seat_price_not_configured: "O valor do usuário adicional ainda não foi configurado.",
      cannot_remove_occupied_seats: "Remova pessoas ou convites pendentes antes de reduzir os usuários adicionais.",
      subscription_not_active_for_seat_change: "É necessário ter uma assinatura Business/PJ ativa para alterar os usuários adicionais.",
      invitation_not_found: "Este convite não está mais disponível.",
      invitation_not_pending: "Este convite já foi respondido ou cancelado.",
      forbidden: "Você não possui permissão para realizar esta ação.",
    };
    throw new Error((payload.error && messages[payload.error]) || payload.error || "Não foi possível gerenciar a equipe");
  }
  return payload;
}

export async function getBusinessWorkspace(workspaceId: string, options?: { page?: number; limit?: number; search?: string }) {
  const params = new URLSearchParams({ workspaceId, page: String(options?.page || 1), limit: String(options?.limit || 10) });
  if (options?.search?.trim()) params.set("search", options.search.trim());
  const response = await apiFetch(`/api/workspaces/business?${params.toString()}`);
  return readPayload<BusinessWorkspacePayload & { ok: true }>(response);
}

export async function inviteBusinessMember(input: {
  workspaceId: string;
  email: string;
  displayName?: string;
  role: BusinessRole;
  permissions?: BusinessPermission[];
}) {
  const response = await apiFetch("/api/workspaces/business", { method: "POST", body: JSON.stringify(input) });
  return readPayload<{
    ok: true;
    member: BusinessWorkspaceMember;
    invitation: BusinessWorkspaceInvitation;
    generatedPasswordExposed: false;
    emailSent: boolean;
    recipientType: "existing_account" | "new_account";
    seats: WorkspaceSeatSummary;
  }>(response);
}

export async function updateBusinessMember(input: {
  workspaceId: string;
  memberUid: string;
  role?: BusinessRole;
  permissions?: BusinessPermission[];
  status?: "active" | "pending" | "disabled";
}) {
  const response = await apiFetch("/api/workspaces/business", { method: "PATCH", body: JSON.stringify(input) });
  return readPayload<{ ok: true; member: BusinessWorkspaceMember; seats?: WorkspaceSeatSummary }>(response);
}

export async function resendBusinessInvitation(workspaceId: string, invitationId: string) {
  const response = await apiFetch("/api/workspaces/business", { method: "PUT", body: JSON.stringify({ workspaceId, invitationId }) });
  return readPayload<{ ok: true; invitation: BusinessWorkspaceInvitation; emailSent: boolean }>(response);
}

export async function revokeBusinessInvitation(workspaceId: string, invitationId: string) {
  const response = await apiFetch(`/api/workspaces/business?workspaceId=${encodeURIComponent(workspaceId)}&invitationId=${encodeURIComponent(invitationId)}`, { method: "DELETE" });
  return readPayload<{ ok: true; invitation: BusinessWorkspaceInvitation; seats: WorkspaceSeatSummary }>(response);
}

export async function updateAdditionalBusinessSeats(workspaceId: string, quantity: number) {
  const response = await apiFetch("/api/billing/additional-seats", { method: "POST", body: JSON.stringify({ workspaceId, quantity }) });
  return readPayload<{
    ok: true;
    seats: WorkspaceSeatSummary;
    amount: number;
    interval: "monthly" | "yearly";
    nextChargeAt: string | null;
    chargePolicy: "next_renewal_no_immediate_charge";
  }>(response);
}
