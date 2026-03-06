import { getAuth, signOut, updateProfile } from "firebase/auth";
import {
  UserProfile,
  UserStatus,
  UserPlan,
  UserRole,
  UserPaymentStatus,
} from "@/types/user";
import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getImpersonationActionStatus } from "@/services/impersonationService";

const POLLING_INTERVAL_MS = 15000;

async function getIdTokenOrThrow() {
  const auth = getAuth();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error("missing_auth_user");
  return currentUser.getIdToken();
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
    try {
      const response = await apiFetch("/api/admin/users", { method: "GET" });
      const payload = (await response.json()) as { ok: boolean; error?: string; users?: UserProfile[] };
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao buscar usuarios");
      if (!cancelled) onChange(payload.users || []);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const subscribeToUserProfile = (
  _uid: string,
  onChange: (profile: UserProfile | null) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const run = async () => {
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
  return () => {
    cancelled = true;
    clearInterval(interval);
  };
};

export const normalizeDatabaseUsers = async () => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "normalize" }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string; count?: number };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Erro ao normalizar usuarios");
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
  const auth = getAuth();
  const user = auth.currentUser;
  if (user) {
    await updateProfile(user, { displayName: data.displayName });
  }

  const { response, payload } = await apiFetchWithOptionalApproval("/api/profile/me", {
    method: "PUT",
    body: JSON.stringify({
      displayName: data.displayName,
      completeName: data.completeName,
      phone: data.phone,
    }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || `Erro ao atualizar perfil do usuario ${uid}`);
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
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao deletar usuario");

  const auth = getAuth();
  if (auth.currentUser?.uid === uid) {
    await signOut(auth);
  }
};

export const restoreUserAccount = async (uid: string, restoreData: boolean = true): Promise<void> => {
  const response = await apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ action: "restore", uid, restoreData }),
  });
  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Erro ao restaurar usuario");
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
    throw new Error(payload.error || "Nao foi possivel excluir a conta");
  }
};
