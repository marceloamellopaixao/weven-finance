import {
  UserProfile,
  UserStatus,
  UserPlan,
  UserRole,
  UserPaymentStatus,
} from "@/types/user";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getImpersonationActionStatus } from "@/services/impersonationService";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { getSupabaseClient } from "@/services/supabase/client";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

const POLLING_INTERVAL_MS = 20000;

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
}

async function apiFetch(path: string, init?: RequestInit) {
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

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForActionApproval(actionRequestId: string, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const status = await getImpersonationActionStatus(actionRequestId);
    const request = status.request;
    if (request?.status === "approved") return;
    if (request?.status === "rejected" || request?.status === "expired") {
      throw new Error("impersonation_action_rejected");
    }
    await sleep(2500);
  }
  throw new Error("impersonation_action_timeout");
}

async function apiFetchWithOptionalApproval(path: string, init?: RequestInit) {
  const first = await apiFetch(path, init);
  const firstPayload = (await first.json()) as {
    ok?: boolean;
    error?: string;
    actionRequestId?: string;
  };

  if (
    first.status === 409 &&
    firstPayload.error === "impersonation_write_confirmation_required" &&
    firstPayload.actionRequestId
  ) {
    await waitForActionApproval(firstPayload.actionRequestId);
    const retry = await apiFetch(path, {
      ...init,
      headers: {
        ...(init?.headers || {}),
        "x-impersonation-action-id": firstPayload.actionRequestId,
      },
    });
    const retryPayload = (await retry.json()) as { ok?: boolean; error?: string };
    return { response: retry, payload: retryPayload };
  }

  return { response: first, payload: firstPayload };
}

export const subscribeToAllUsers = (
  onChange: (users: UserProfile[]) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const response = await apiFetch("/api/admin/users", { method: "GET" });
      const payload = (await response.json()) as { ok: boolean; error?: string; users?: UserProfile[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar usuários");
      if (!cancelled) onChange(payload.users || []);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "profiles",
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

export const fetchAdminUsersPage = async (params?: {
  page?: number;
  limit?: number;
  q?: string;
  role?: UserRole | "all";
  plan?: UserPlan | "all";
  status?: UserStatus | "all";
  paymentStatus?: UserPaymentStatus | "all" | "unpaid_group";
}): Promise<{ users: UserProfile[]; total: number; page: number; limit: number }> => {
  const query = new URLSearchParams();
  query.set("page", String(Math.max(1, Number(params?.page || 1))));
  query.set("limit", String(Math.max(1, Math.min(100, Number(params?.limit || 20)))));
  if (params?.q?.trim()) query.set("q", params.q.trim());
  if (params?.role && params.role !== "all") query.set("role", params.role);
  if (params?.plan && params.plan !== "all") query.set("plan", params.plan);
  if (params?.status && params.status !== "all") query.set("status", params.status);
  if (params?.paymentStatus && params.paymentStatus !== "all" && params.paymentStatus !== "unpaid_group") {
    query.set("paymentStatus", params.paymentStatus);
  }

  const response = await apiFetch(`/api/admin/users?${query.toString()}`, { method: "GET" });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    users?: UserProfile[];
    total?: number;
    page?: number;
    limit?: number;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao buscar usuários");
  }
  return {
    users: payload.users || [],
    total: Number(payload.total || 0),
    page: Number(payload.page || params?.page || 1),
    limit: Number(payload.limit || params?.limit || 20),
  };
};

export const subscribeToUserProfile = (
  uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const response = await apiFetch("/api/profile/me", { method: "GET" });
      const payload = (await response.json()) as { ok: boolean; error?: string; profile?: UserProfile | null };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar perfil");
      if (!cancelled) onChange(payload.profile ?? null);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "profiles",
    filter: `uid=eq.${uid}`,
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

export const normalizeDatabaseUsers = async () => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "normalize" }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; count?: number };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao normalizar usuários");
  }
  return payload.count || 0;
};

export const updateUserStatus = async (
  uid: string,
  status: UserStatus,
  reason?: string
) => {
  const response = await apiFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({
      uid,
      updates: {
        status,
        blockReason: reason || "",
      },
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao atualizar status");
};

export const updateUserPlan = async (uid: string, plan: UserPlan) => {
  const response = await apiFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({
      uid,
      updates: {
        plan,
        "billing.source": "manual",
        "billing.lastSyncAt": new Date().toISOString(),
      },
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao atualizar plano");
};

export const updateUserRole = async (uid: string, role: UserRole) => {
  const updates: Record<string, unknown> = { role };
  if (role === "admin" || role === "moderator") {
    updates.paymentStatus = "free";
    updates["billing.source"] = "system";
    updates["billing.lastSyncAt"] = new Date().toISOString();
  }
  const response = await apiFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({
      uid,
      updates,
      requiresAdmin: true,
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao atualizar role");
};

export const updateUserPaymentStatus = async (
  uid: string,
  paymentStatus: UserPaymentStatus
) => {
  const response = await apiFetch("/api/admin/users", {
    method: "PATCH",
    body: JSON.stringify({
      uid,
      updates: {
        paymentStatus,
        "billing.source": "manual",
        "billing.lastSyncAt": new Date().toISOString(),
      },
    }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao atualizar pagamento");
};

export const getUserTransactionCount = async (uid: string): Promise<number> => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "recountTransactionCount", uid }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; count?: number };
  if (!response.ok || !payload.ok) return 0;
  return payload.count || 0;
};

export const updateOwnProfile = async (
  uid: string,
  data: { displayName: string; completeName: string; phone: string }
) => {
  const supabase = getSupabaseClient();
  await supabase.auth.updateUser({
    data: {
      displayName: data.displayName,
      completeName: data.completeName,
      phone: data.phone,
    },
  });

  const { response, payload } = await apiFetchWithOptionalApproval("/api/profile/me", {
    method: "PUT",
    body: JSON.stringify({
      displayName: data.displayName,
      completeName: data.completeName,
      phone: data.phone,
    }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Erro ao atualizar perfil do usuário ${uid}`);
  }
};

export const getStaffUsers = async (): Promise<UserProfile[]> => {
  try {
    const response = await apiFetch("/api/admin/users?scope=staff", { method: "GET" });
    const payload = (await response.json()) as { ok: boolean; error?: string; users?: UserProfile[] };
    if (!response.ok || !payload.ok) return [];
    return payload.users || [];
  } catch {
    return [];
  }
};

export const downloadAdminCsv = async (
  kind: "users" | "support" | "audit",
  filters?: Record<string, string | undefined>
) => {
  const query = new URLSearchParams();
  query.set("kind", kind);
  if (filters) {
    for (const [key, value] of Object.entries(filters)) {
      if (typeof value === "string" && value.trim()) query.set(key, value.trim());
    }
  }

  const response = await apiFetch(`/api/admin/export?${query.toString()}`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = (await response.json()) as { ok?: boolean; error?: string };
    throw new Error(payload.error || "Erro ao exportar CSV");
  }

  const csv = await response.text();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename=\"([^\"]+)\"/i);
  const filename = match?.[1] || `export-${kind}.csv`;

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const resetUserFinancialData = async (uid: string) => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "resetFinancialData", uid }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao resetar dados financeiros");
};

export const softDeleteUser = async (uid: string): Promise<void> => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "softDelete", uid }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao deletar usuário");

  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getUser();
  const meta = (data.user?.user_metadata as Record<string, unknown> | undefined) || {};
  const mappedUid =
    typeof meta.firebaseUid === "string" && meta.firebaseUid.trim()
      ? meta.firebaseUid
      : data.user?.id;
  if (mappedUid === uid) {
    await supabase.auth.signOut();
  }
};

export const restoreUserAccount = async (uid: string, restoreData: boolean = true): Promise<void> => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "restore", uid, restoreData }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao restaurar usuário");
};

export const requestOwnAccountDeletion = async (idToken: string): Promise<void> => {
  const response = await fetch("/api/account/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    },
  });

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível excluir a conta");
  }
};

