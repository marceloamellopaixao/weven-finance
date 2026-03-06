import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getImpersonationActionStatus } from "@/services/impersonationService";

export interface CustomCategory {
  id?: string;
  name: string;
  type: "income" | "expense" | "both";
  color: string;
  userId: string;
}

type CategoriesResponse = {
  ok: boolean;
  error?: string;
  customCategories?: CustomCategory[];
  hiddenDefaultCategories?: string[];
};

async function fetchWithAuth(path: string, idToken: string, init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      ...getImpersonationHeader(),
      ...(init?.headers || {}),
    },
  });
  return response;
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

async function fetchWithOptionalApproval(path: string, idToken: string, init?: RequestInit) {
  const firstResponse = await fetchWithAuth(path, idToken, init);
  const firstPayload = (await firstResponse.json()) as {
    ok?: boolean;
    error?: string;
    actionRequestId?: string;
  };

  if (
    firstResponse.status === 409 &&
    firstPayload.error === "impersonation_write_confirmation_required" &&
    firstPayload.actionRequestId
  ) {
    await waitForActionApproval(firstPayload.actionRequestId);
    const retryHeaders = {
      ...(init?.headers || {}),
      "x-impersonation-action-id": firstPayload.actionRequestId,
    };
    const retryResponse = await fetchWithAuth(path, idToken, {
      ...init,
      headers: retryHeaders,
    });
    const retryPayload = (await retryResponse.json()) as { ok?: boolean; error?: string };
    return { response: retryResponse, payload: retryPayload };
  }

  return { response: firstResponse, payload: firstPayload };
}

export const getCategoriesData = async (
  idToken: string
): Promise<{ customCategories: CustomCategory[]; hiddenDefaultCategories: string[] }> => {
  const response = await fetchWithAuth("/api/categories", idToken, { method: "GET" });
  const payload = (await response.json()) as CategoriesResponse;
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel carregar categorias");
  }
  return {
    customCategories: payload.customCategories || [],
    hiddenDefaultCategories: payload.hiddenDefaultCategories || [],
  };
};

export const addCustomCategory = async (
  idToken: string,
  name: string,
  type: "income" | "expense" | "both"
): Promise<void> => {
  const { response, payload } = await fetchWithOptionalApproval("/api/categories", idToken, {
    method: "POST",
    body: JSON.stringify({ name, type }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel adicionar categoria");
  }
};

export const deleteCustomCategoryByName = async (
  idToken: string,
  categoryName: string,
  fallbackCategory: string = "Outros"
) => {
  const params = new URLSearchParams({ name: categoryName, fallbackCategory });
  const { response, payload } = await fetchWithOptionalApproval(`/api/categories?${params.toString()}`, idToken, {
    method: "DELETE",
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel excluir categoria");
  }
};

export const renameCustomCategoryByName = async (
  idToken: string,
  oldName: string,
  newName: string
) => {
  const { response, payload } = await fetchWithOptionalApproval("/api/categories", idToken, {
    method: "PATCH",
    body: JSON.stringify({ oldName, newName }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel renomear categoria");
  }
};

export const setDefaultCategoryHidden = async (
  idToken: string,
  categoryName: string,
  hidden: boolean
): Promise<void> => {
  const { response, payload } = await fetchWithOptionalApproval("/api/categories/default-visibility", idToken, {
    method: "POST",
    body: JSON.stringify({ categoryName, hidden }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Nao foi possivel atualizar visibilidade da categoria");
  }
};
