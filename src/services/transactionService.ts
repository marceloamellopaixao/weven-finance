import { Transaction, UserSettings, CreateTransactionDTO } from "@/types/transaction";
import { encryptData, decryptData, decryptLegacy } from "@/lib/crypto";
import { getImpersonationHeader, getImpersonationTargetUid } from "@/lib/impersonation/client";
import { getImpersonationActionStatus } from "@/services/impersonationService";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";

const POLLING_INTERVAL_MS = 20000;
const TRANSACTIONS_CHANGED_EVENT = "wevenfinance:transactions:changed";
const USER_SETTINGS_CHANGED_EVENT = "wevenfinance:user-settings:changed";

function emitTransactionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TRANSACTIONS_CHANGED_EVENT));
}

function emitUserSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_SETTINGS_CHANGED_EVENT));
}

function shouldPollNow() {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible";
}

const addMonthsUTC = (dateStr: string, monthsToAdd: number): string => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetMonthDate = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0)
  );
  const maxDays = lastDayOfTargetMonth.getUTCDate();
  const finalDay = Math.min(day, maxDays);
  const finalDate = new Date(
    Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth(), finalDay)
  );
  return finalDate.toISOString().split("T")[0];
};

async function getIdTokenOrThrow() {
  return getAccessTokenOrThrow();
}

async function apiFetch(path: string, init?: RequestInit) {
  const idToken = await getIdTokenOrThrow();
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

function resolveCryptoUid(uid: string) {
  return getImpersonationTargetUid() || uid;
}

type ApiTransaction = Omit<Transaction, "createdAt" | "amount" | "description"> & {
  createdAt?: string | null;
  amount: number | string;
  description: string;
  isEncrypted?: boolean;
};

type TransactionsPage = {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
};

async function fetchTransactions(uid: string, groupId?: string): Promise<Transaction[]> {
  const cryptoUid = resolveCryptoUid(uid);
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const response = await apiFetch(`/api/transactions${query}`, { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; transactions?: ApiTransaction[] };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar transações");
  }

  const transactions = payload.transactions || [];
  const parsed = await Promise.all(
    transactions.map(async (tx) => {
      let decryptedDesc = tx.description;
      let decryptedAmount = String(tx.amount);

      if (tx.isEncrypted) {
        decryptedDesc = await decryptData(tx.description, cryptoUid);
        decryptedAmount = await decryptData(String(tx.amount), cryptoUid);
      }

      const parsedAmount = Number(decryptedAmount);
      const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
      const isDecryptionFailed =
        tx.isEncrypted &&
        decryptedDesc === tx.description &&
        typeof tx.description === "string" &&
        tx.description.length > 50;

      return {
        ...tx,
        description: isDecryptionFailed
          ? "Dados Protegidos (Migração Necessária)"
          : decryptedDesc,
        amount: safeAmount,
        createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
      } as Transaction;
    })
  );

  return parsed.filter((t) => !t.isArchived);
}

export async function fetchTransactionsPage(
  uid: string,
  params?: {
    page?: number;
    limit?: number;
    month?: string;
    type?: "all" | "income" | "expense";
    status?: "all" | "paid" | "pending";
    category?: string;
    q?: string;
  }
): Promise<TransactionsPage> {
  const cryptoUid = resolveCryptoUid(uid);
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.max(1, Math.min(200, Number(params?.limit || 50)));
  const search = new URLSearchParams();
  search.set("page", String(page));
  search.set("limit", String(limit));
  if (params?.month) search.set("month", params.month);
  if (params?.type && params.type !== "all") search.set("type", params.type);
  if (params?.status && params.status !== "all") search.set("status", params.status);
  if (params?.category && params.category !== "all") search.set("category", params.category);
  if (params?.q?.trim()) search.set("q", params.q.trim());
  const query = `?${search.toString()}`;
  const response = await apiFetch(`/api/transactions${query}`, { method: "GET" });
  const payload = (await response.json()) as {
    ok: boolean;
    error?: string;
    transactions?: ApiTransaction[];
    total?: number;
    page?: number;
    limit?: number;
  };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar transações");
  }

  const transactions = payload.transactions || [];
  const parsed = await Promise.all(
    transactions.map(async (tx) => {
      let decryptedDesc = tx.description;
      let decryptedAmount = String(tx.amount);

      if (tx.isEncrypted) {
        decryptedDesc = await decryptData(tx.description, cryptoUid);
        decryptedAmount = await decryptData(String(tx.amount), cryptoUid);
      }

      const parsedAmount = Number(decryptedAmount);
      const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
      const isDecryptionFailed =
        tx.isEncrypted &&
        decryptedDesc === tx.description &&
        typeof tx.description === "string" &&
        tx.description.length > 50;

      return {
        ...tx,
        description: isDecryptionFailed
          ? "Dados Protegidos (Migração Necessária)"
          : decryptedDesc,
        amount: safeAmount,
        createdAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
      } as Transaction;
    })
  );

  const visible = parsed.filter((t) => !t.isArchived);
  return {
    transactions: visible,
    total: Number(payload.total || visible.length),
    page: Number(payload.page || page),
    limit: Number(payload.limit || limit),
  };
}

export const migrateCryptography = async (uid: string) => {
  const cryptoUid = resolveCryptoUid(uid);
  const all = await fetchTransactions(uid);
  const updates: Array<{ id: string; updates: Record<string, unknown> }> = [];

  for (const tx of all) {
    if (!tx.id) continue;
    const rawDescription = tx.description;
    const rawAmount = tx.amount;

    const legDesc = await decryptLegacy(String(rawDescription), cryptoUid);
    const legAmount = await decryptLegacy(String(rawAmount), cryptoUid);

    if (legDesc !== null || legAmount !== null) {
      const descToSave = legDesc !== null ? legDesc : rawDescription;
      const amountToSave = legAmount !== null ? Number(legAmount) : rawAmount;
      updates.push({
        id: tx.id,
        updates: {
          description: await encryptData(descToSave, cryptoUid),
          amount: await encryptData(amountToSave, cryptoUid),
          isEncrypted: true,
        },
      });
      continue;
    }

    if (!tx.isEncrypted) {
      updates.push({
        id: tx.id,
        updates: {
          description: await encryptData(rawDescription, cryptoUid),
          amount: await encryptData(rawAmount, cryptoUid),
          isEncrypted: true,
        },
      });
    }
  }

  if (updates.length > 0) {
    const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
      method: "POST",
      body: JSON.stringify({ action: "updateMany", updates }),
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Não foi possível migrar criptografia");
    }
  }

  return updates.length;
};

export const subscribeToTransactions = (
  uid: string,
  onChange: (data: Transaction[]) => void,
  onError?: (error: Error) => void
) => {
  let cancelled = false;
  const effectiveUid = resolveCryptoUid(uid);

  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const data = await fetchTransactions(uid);
      if (!cancelled) onChange(data);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "transactions",
    filter: `uid=eq.${effectiveUid}`,
    onChange: () => void run(),
  });
  const onChangedEvent = () => void run();
  const onFocus = () => void run();
  window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChangedEvent);
  window.addEventListener("focus", onFocus);

  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
    window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChangedEvent);
    window.removeEventListener("focus", onFocus);
  };
};

export const addTransaction = async (uid: string, tx: CreateTransactionDTO) => {
  const cryptoUid = resolveCryptoUid(uid);
  const groupId = crypto.randomUUID();
  const count = tx.isInstallment ? Math.max(1, Math.floor(tx.installmentsCount)) : 1;
  const encryptedAmount = await encryptData(tx.amount, cryptoUid);
  const transactions: Record<string, unknown>[] = [];

  for (let i = 0; i < count; i++) {
    const currentDueDate = addMonthsUTC(tx.dueDate, i);
    const descText = tx.isInstallment ? `${tx.description} (${i + 1}/${count})` : tx.description;
    const encryptedDesc = await encryptData(descText, cryptoUid);

    transactions.push({
      description: encryptedDesc,
      amount: encryptedAmount,
      amountForLimit: Number(tx.amount),
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      ...(tx.cardId ? { cardId: tx.cardId } : {}),
      ...(tx.cardLabel ? { cardLabel: tx.cardLabel } : {}),
      ...(tx.cardType ? { cardType: tx.cardType } : {}),
      status: "pending",
      date: tx.date,
      dueDate: currentDueDate,
      isEncrypted: true,
      isArchived: false,
      ...(tx.isInstallment && {
        groupId,
        installmentCurrent: i + 1,
        installmentTotal: count,
      }),
    });
  }

  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify({ action: "createMany", transactions }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível adicionar transação");
  }
  emitTransactionsChanged();
  emitUserSettingsChanged();
};

export const deleteTransaction = async (
  uid: string,
  transactionId: string,
  deleteGroup: boolean = false
) => {
  if (deleteGroup) {
    const all = await fetchTransactions(uid);
    const selected = all.find((tx) => tx.id === transactionId);
    if (!selected?.groupId) return;

    const { response, payload } = await apiFetchWithOptionalApproval(`/api/transactions?groupId=${encodeURIComponent(selected.groupId)}`, {
      method: "DELETE",
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Não foi possível excluir grupo de transações");
    }
    emitTransactionsChanged();
    emitUserSettingsChanged();
    return;
  }

  const { response, payload } = await apiFetchWithOptionalApproval(`/api/transactions?transactionId=${encodeURIComponent(transactionId)}`, {
    method: "DELETE",
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível excluir transação");
  }
  emitTransactionsChanged();
  emitUserSettingsChanged();
};

export const cancelFutureInstallments = async (
  _uid: string,
  groupId: string,
  lastInstallmentDate: string
) => {
  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      action: "cancelFuture",
      groupId,
      lastInstallmentDate,
    }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível cancelar parcelas futuras");
  }
  emitTransactionsChanged();
  emitUserSettingsChanged();
};

export const updateTransaction = async (
  uid: string,
  transactionId: string,
  data: Partial<Transaction>,
  updateGroup: boolean = false
) => {
  const cryptoUid = resolveCryptoUid(uid);
  const updates: Record<string, unknown> = { ...data };
  if (data.amount !== undefined) {
    updates.amount = await encryptData(data.amount, cryptoUid);
    updates.amountForLimit = Number(data.amount);
    updates.isEncrypted = true;
  }

  if (!updateGroup) {
    if (data.description) {
      updates.description = await encryptData(data.description, cryptoUid);
      updates.isEncrypted = true;
    }
    const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
      method: "PATCH",
      body: JSON.stringify({ transactionId, updates }),
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Não foi possível atualizar transação");
    }
    emitTransactionsChanged();
    emitUserSettingsChanged();
    return;
  }

  const all = await fetchTransactions(uid);
  const currentTx = all.find((tx) => tx.id === transactionId);
  if (!currentTx?.groupId) return;

  const groupItems = all.filter((tx) => tx.groupId === currentTx.groupId);
  const bulkUpdates: Array<{ id: string; updates: Record<string, unknown> }> = [];

  for (const tx of groupItems) {
    if (!tx.id) continue;
    const batchUpdates: Record<string, unknown> = { ...updates };
    const isTarget = tx.id === transactionId;

    if (data.description) {
      const descWithSuffix = `${data.description} (${tx.installmentCurrent}/${tx.installmentTotal})`;
      batchUpdates.description = await encryptData(descWithSuffix, cryptoUid);
      batchUpdates.isEncrypted = true;
    }

    if (!isTarget) {
      delete batchUpdates.date;
      delete batchUpdates.dueDate;
      delete batchUpdates.status;
    }

    bulkUpdates.push({ id: tx.id, updates: batchUpdates });
  }

  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify({ action: "updateMany", updates: bulkUpdates }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar grupo de transações");
  }
  emitTransactionsChanged();
  emitUserSettingsChanged();
};

export const toggleTransactionStatus = async (
  _uid: string,
  transactionId: string,
  currentStatus: "paid" | "pending"
) => {
  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify({ action: "toggleStatus", transactionId, currentStatus }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar status da transação");
  }
  emitTransactionsChanged();
  emitUserSettingsChanged();
};

export const syncCreditCardAmountForLimit = async (uid: string, transactions: Transaction[]) => {
  void uid;
  const updates = transactions
    .filter((tx) => tx.id && tx.paymentMethod === "credit_card" && tx.type === "expense")
    .filter((tx) => tx.amountForLimit === undefined || Number.isNaN(tx.amountForLimit))
    .map((tx) => ({
      id: tx.id as string,
      updates: {
        amountForLimit: Number(tx.amount),
      },
    }));

  if (updates.length === 0) return 0;

  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify({ action: "updateMany", updates }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível sincronizar valores do cartão");
  }
  emitTransactionsChanged();
  return updates.length;
};

async function fetchUserSettings(): Promise<UserSettings> {
  const response = await apiFetch("/api/user-settings/finance", { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; currentBalance?: number };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar configurações financeiras");
  }
  return { currentBalance: Number(payload.currentBalance || 0) };
}

export const getUserSettings = async (uid: string): Promise<UserSettings> => {
  void uid;
  return fetchUserSettings();
};

export const subscribeToUserSettings = (
  uid: string,
  onChange: (data: UserSettings) => void,
  onError?: (error: Error) => void
) => {
  const effectiveUid = resolveCryptoUid(uid);
  let cancelled = false;
  const run = async () => {
    if (!shouldPollNow()) return;
    try {
      const data = await fetchUserSettings();
      if (!cancelled) onChange(data);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const interval = setInterval(() => void run(), POLLING_INTERVAL_MS);
  const stopRealtime = subscribeToTableChanges({
    table: "user_settings",
    filter: `uid=eq.${effectiveUid}`,
    onChange: () => void run(),
  });
  const onChangedEvent = () => void run();
  const onFocus = () => void run();
  window.addEventListener(USER_SETTINGS_CHANGED_EVENT, onChangedEvent);
  window.addEventListener("focus", onFocus);
  return () => {
    cancelled = true;
    clearInterval(interval);
    stopRealtime();
    window.removeEventListener(USER_SETTINGS_CHANGED_EVENT, onChangedEvent);
    window.removeEventListener("focus", onFocus);
  };
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
  void uid;
  const { response, payload } = await apiFetchWithOptionalApproval("/api/user-settings/finance", {
    method: "PUT",
    body: JSON.stringify({ currentBalance: newBalance }),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar saldo");
  }
  emitUserSettingsChanged();
};

