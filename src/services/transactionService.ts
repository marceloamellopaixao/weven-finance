import { Transaction, UserSettings, CreateTransactionDTO } from "@/types/transaction";
import { encryptData, decryptData, decryptLegacy } from "@/lib/crypto";
import { getImpersonationHeader, getImpersonationTargetUid } from "@/lib/impersonation/client";
import { getImpersonationActionStatus } from "@/services/impersonationService";
import { getAccessTokenOrThrow } from "@/services/auth/token";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { buildInstallmentPlan } from "@/lib/transactions/installments";
import { buildRecurringOccurrenceSourceId, getMonthKey } from "@/lib/transactions/recurring";
import { getActiveWorkspaceId, subscribeToActiveWorkspaceChanged } from "@/services/workspaceService";

const TRANSACTIONS_CHANGED_EVENT = "wevenfinance:transactions:changed";
const USER_SETTINGS_CHANGED_EVENT = "wevenfinance:user-settings:changed";
const RECURRING_SYNC_TTL_MS = 60_000;
const recurringSyncCache = new Map<string, { syncedAt: number; inFlight: Promise<number> | null }>();

function emitTransactionsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TRANSACTIONS_CHANGED_EVENT));
}

function emitUserSettingsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(USER_SETTINGS_CHANGED_EVENT));
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

function withActiveWorkspace(path: string) {
  const workspaceId = getActiveWorkspaceId();
  if (!workspaceId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}workspaceId=${encodeURIComponent(workspaceId)}`;
}

function withActiveWorkspaceBody<T extends Record<string, unknown>>(body: T): T & { workspaceId?: string } {
  const workspaceId = getActiveWorkspaceId();
  return workspaceId ? { ...body, workspaceId } : body;
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

function stripInstallmentSuffix(value: string) {
  return String(value || "").replace(/(?:\s+\(\d+\/\d+\))+\s*$/g, "").trim();
}

function looksLikeEncryptedValue(value: unknown) {
  return typeof value === "string" && /^[A-Za-z0-9+/]{16}={0,2}:[A-Za-z0-9+/]{20,}={0,2}$/.test(value);
}

async function parseApiTransaction(tx: ApiTransaction, cryptoUid: string): Promise<Transaction> {
  let decryptedTitle = tx.title || tx.description;
  let decryptedDesc = tx.title ? tx.description || "" : "";
  let decryptedAmount = String(tx.amount);

  const shouldDecrypt = Boolean(
    tx.isEncrypted ||
    looksLikeEncryptedValue(tx.title) ||
    looksLikeEncryptedValue(tx.description) ||
    looksLikeEncryptedValue(tx.amount)
  );

  if (shouldDecrypt) {
    decryptedTitle = await decryptData(tx.title || tx.description, cryptoUid);
    decryptedDesc = tx.title ? await decryptData(tx.description || "", cryptoUid) : "";
    decryptedAmount = await decryptData(String(tx.amount), cryptoUid);
  }

  const parsedAmount = Number(decryptedAmount);
  const safeAmount = Number.isFinite(parsedAmount) ? parsedAmount : 0;
  const protectedText = tx.title || tx.description;
  const isDecryptionFailed =
    shouldDecrypt &&
    decryptedTitle === protectedText &&
    typeof protectedText === "string" &&
    protectedText.length > 50;

  return {
    ...tx,
    title: isDecryptionFailed ? "Dados protegidos no momento" : decryptedTitle,
    description: isDecryptionFailed ? "" : decryptedDesc,
    amount: safeAmount,
    createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : new Date().toISOString(),
  } as Transaction;
}

export type ApiTransaction = Omit<Transaction, "createdAt" | "amount" | "title" | "description"> & {
  createdAt?: string | null;
  amount: number | string;
  title?: string;
  description: string;
  isEncrypted?: boolean;
};

export async function parseApiTransactions(transactions: ApiTransaction[], uid: string) {
  const cryptoUid = resolveCryptoUid(uid);
  const parsed = await Promise.all(transactions.map((tx) => parseApiTransaction(tx, cryptoUid)));
  return parsed.filter((tx) => !tx.isArchived);
}

type TransactionsPage = {
  transactions: Transaction[];
  total: number;
  page: number;
  limit: number;
};

async function fetchTransactions(uid: string, groupId?: string): Promise<Transaction[]> {
  const query = groupId ? `?groupId=${encodeURIComponent(groupId)}` : "";
  const response = await apiFetch(withActiveWorkspace(`/api/transactions${query}`), { method: "GET" });
  const payload = (await response.json()) as { ok: boolean; error?: string; transactions?: ApiTransaction[] };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar transações");
  }

  return parseApiTransactions(payload.transactions || [], uid);
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
  await syncRecurringTransactions(uid);
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
  const response = await apiFetch(withActiveWorkspace(`/api/transactions${query}`), { method: "GET" });
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
    transactions.map((tx) => parseApiTransaction(tx, cryptoUid))
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
      body: JSON.stringify(withActiveWorkspaceBody({ action: "updateMany", updates })),
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
  onError?: (error: Error) => void,
  options?: { syncRecurring?: boolean }
) => {
  let cancelled = false;
  let runId = 0;
  let debounceTimer: number | null = null;
  const effectiveUid = resolveCryptoUid(uid);

  const run = async () => {
    const currentRunId = ++runId;
    try {
      if (options?.syncRecurring) {
        await syncRecurringTransactionsOnce(uid);
      }
      const data = await fetchTransactions(uid);
      if (!cancelled && currentRunId === runId) onChange(data);
    } catch (error) {
      if (!cancelled && currentRunId === runId) onError?.(error as Error);
    }
  };

  const scheduleRun = () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => void run(), 120);
  };

  void run();
  const stopRealtime = subscribeToTableChanges({
    table: "transactions",
    filter: `uid=eq.${effectiveUid}`,
    onChange: scheduleRun,
  });
  const onChangedEvent = scheduleRun;
  window.addEventListener(TRANSACTIONS_CHANGED_EVENT, onChangedEvent);
  const stopWorkspaceListener = subscribeToActiveWorkspaceChanged(scheduleRun);

  return () => {
    cancelled = true;
    if (debounceTimer) window.clearTimeout(debounceTimer);
    stopRealtime();
    stopWorkspaceListener();
    window.removeEventListener(TRANSACTIONS_CHANGED_EVENT, onChangedEvent);
  };
};

async function syncRecurringTransactionsOnce(uid: string) {
  const workspaceId = getActiveWorkspaceId() || "default";
  const key = `${resolveCryptoUid(uid)}:${workspaceId}`;
  const cached = recurringSyncCache.get(key);
  const now = Date.now();
  if (cached?.inFlight) return cached.inFlight;
  if (cached && now - cached.syncedAt < RECURRING_SYNC_TTL_MS) return 0;

  const inFlight = syncRecurringTransactions(uid)
    .then((created) => {
      recurringSyncCache.set(key, { syncedAt: Date.now(), inFlight: null });
      return created;
    })
    .catch((error) => {
      recurringSyncCache.delete(key);
      throw error;
    });
  recurringSyncCache.set(key, { syncedAt: cached?.syncedAt || 0, inFlight });
  return inFlight;
}

export const syncRecurringTransactions = async (_uid: string) => {
  void _uid;
  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify(withActiveWorkspaceBody({ action: "syncRecurring" })),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "NÃ£o foi possÃ­vel sincronizar recorrÃªncias");
  }
  return Number((payload as { created?: number }).created || 0);
};

export const addTransaction = async (uid: string, tx: CreateTransactionDTO & { isRecurring?: boolean }) => {
  const cryptoUid = resolveCryptoUid(uid);
  const installmentPlan = tx.isInstallment
    ? buildInstallmentPlan(tx.amount, tx.installmentsCount, tx.installmentValueMode || "split_total")
    : null;
  const count = installmentPlan ? installmentPlan.count : 1;
  const groupId = count > 1 ? crypto.randomUUID() : null;
  const transactions: Record<string, unknown>[] = [];
  const recurringId = tx.isRecurring ? crypto.randomUUID() : null;

  for (let i = 0; i < count; i++) {
    const currentDate = tx.isInstallment ? addMonthsUTC(tx.date, i) : tx.date;
    const currentDueDate = tx.isInstallment ? addMonthsUTC(tx.dueDate, i) : tx.dueDate;
    const baseTitle = stripInstallmentSuffix(tx.title || tx.description);
    const titleText = tx.isInstallment ? `${baseTitle} (${i + 1}/${count})` : baseTitle;
    const encryptedTitle = await encryptData(titleText, cryptoUid);
    const encryptedDesc = await encryptData(tx.description || "", cryptoUid);
    const currentAmount = installmentPlan
      ? installmentPlan.installmentAmounts[i] ?? installmentPlan.installmentAmounts[0] ?? 0
      : tx.amount;
    const encryptedAmount = await encryptData(currentAmount, cryptoUid);

    transactions.push({
      title: encryptedTitle,
      description: encryptedDesc,
      amount: encryptedAmount,
      amountForLimit: Number(currentAmount),
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      ...(tx.cardId ? { cardId: tx.cardId } : {}),
      ...(tx.cardLabel ? { cardLabel: tx.cardLabel } : {}),
      ...(tx.cardType ? { cardType: tx.cardType } : {}),
      status: "pending",
      date: currentDate,
      dueDate: currentDueDate,
      isEncrypted: true,
      isArchived: false,
      isRecurring: tx.isRecurring || false,
      ...(recurringId && {
        sourceId: buildRecurringOccurrenceSourceId(recurringId, getMonthKey(currentDueDate) || currentDueDate.slice(0, 7)),
        groupId: recurringId,
        recurringId,
        recurringMonth: getMonthKey(currentDueDate),
        recurringRole: "occurrence",
      }),
      ...(groupId && {
        groupId,
        installmentCurrent: i + 1,
        installmentTotal: count,
      }),
      ...(tx.isRecurring ? { recurrenceEnded: false } : {}),
    });
  }

  if (recurringId) {
    const encryptedTitle = await encryptData(stripInstallmentSuffix(tx.title || tx.description), cryptoUid);
    const encryptedDesc = await encryptData(tx.description || "", cryptoUid);
    const encryptedAmount = await encryptData(tx.amount, cryptoUid);
    transactions.push({
      sourceId: recurringId,
      title: encryptedTitle,
      description: encryptedDesc,
      amount: encryptedAmount,
      amountForLimit: null,
      recurringAmountForLimit: Number(tx.amount),
      type: tx.type,
      category: tx.category,
      paymentMethod: tx.paymentMethod,
      ...(tx.cardId ? { cardId: tx.cardId } : {}),
      ...(tx.cardLabel ? { cardLabel: tx.cardLabel } : {}),
      ...(tx.cardType ? { cardType: tx.cardType } : {}),
      status: "pending",
      date: tx.date,
      dueDate: tx.dueDate,
      isEncrypted: true,
      isArchived: true,
      isRecurring: true,
      recurrenceEnded: false,
      groupId: recurringId,
      recurringId,
      recurringRole: "template",
    });
  }

  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify(withActiveWorkspaceBody({ action: "createMany", transactions })),
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

    const { response, payload } = await apiFetchWithOptionalApproval(withActiveWorkspace(`/api/transactions?groupId=${encodeURIComponent(selected.groupId)}`), {
      method: "DELETE",
    });
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Não foi possível excluir grupo de transações");
    }
    emitTransactionsChanged();
    emitUserSettingsChanged();
    return;
  }

  const { response, payload } = await apiFetchWithOptionalApproval(withActiveWorkspace(`/api/transactions?transactionId=${encodeURIComponent(transactionId)}`), {
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
    body: JSON.stringify(withActiveWorkspaceBody({
      action: "cancelFuture",
      groupId,
      lastInstallmentDate,
    })),
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
    if (data.title !== undefined) {
      updates.title = await encryptData(stripInstallmentSuffix(data.title || ""), cryptoUid);
      updates.isEncrypted = true;
    }
    if (data.description !== undefined) {
      updates.description = await encryptData(data.description || "", cryptoUid);
      updates.isEncrypted = true;
    }
    const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
      method: "PATCH",
      body: JSON.stringify(withActiveWorkspaceBody({ transactionId, updates })),
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

    if (data.title !== undefined) {
      const baseTitle = stripInstallmentSuffix(data.title || "");
      const titleText = currentTx.isRecurring ? baseTitle : `${baseTitle} (${tx.installmentCurrent}/${tx.installmentTotal})`;
      batchUpdates.title = await encryptData(titleText, cryptoUid);
      batchUpdates.isEncrypted = true;
    }
    if (data.description !== undefined) {
      batchUpdates.description = await encryptData(data.description || "", cryptoUid);
      batchUpdates.isEncrypted = true;
    }

    if (!isTarget) {
      delete batchUpdates.date;
      if (data.paymentMethod === "credit_card" && data.dueDate) {
        const installmentOffset = Number(tx.installmentCurrent || 1) - Number(currentTx.installmentCurrent || 1);
        batchUpdates.dueDate = addMonthsUTC(data.dueDate, installmentOffset);
      } else {
        delete batchUpdates.dueDate;
      }
      delete batchUpdates.status;
    }

    bulkUpdates.push({ id: tx.id, updates: batchUpdates });
  }

  const recurringTemplateId = currentTx.isRecurring ? currentTx.recurringId || currentTx.groupId : null;
  if (recurringTemplateId) {
    const templateUpdates: Record<string, unknown> = {
      ...updates,
      amountForLimit: null,
      isArchived: true,
      isRecurring: true,
      recurrenceEnded: data.recurrenceEnded ?? false,
      groupId: recurringTemplateId,
      recurringId: recurringTemplateId,
      recurringRole: "template",
      installmentCurrent: undefined,
      installmentTotal: undefined,
    };
    if (data.amount !== undefined) {
      templateUpdates.recurringAmountForLimit = Number(data.amount);
    }
    delete templateUpdates.status;
    if (data.title !== undefined) {
      templateUpdates.title = await encryptData(stripInstallmentSuffix(data.title || ""), cryptoUid);
      templateUpdates.isEncrypted = true;
    }
    if (data.description !== undefined) {
      templateUpdates.description = await encryptData(data.description || "", cryptoUid);
      templateUpdates.isEncrypted = true;
    }
    bulkUpdates.push({ id: recurringTemplateId, updates: templateUpdates });
  }

  const { response, payload } = await apiFetchWithOptionalApproval("/api/transactions", {
    method: "POST",
    body: JSON.stringify(withActiveWorkspaceBody({ action: "updateMany", updates: bulkUpdates })),
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
    body: JSON.stringify(withActiveWorkspaceBody({ action: "toggleStatus", transactionId, currentStatus })),
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
    body: JSON.stringify(withActiveWorkspaceBody({ action: "updateMany", updates })),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível sincronizar valores do cartão");
  }
  emitTransactionsChanged();
  return updates.length;
};

async function fetchUserSettings(): Promise<UserSettings> {
  const response = await apiFetch(withActiveWorkspace("/api/user-settings/finance"), { method: "GET" });
  const payload = (await response.json()) as UserSettings & { ok: boolean; error?: string };
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível carregar configurações financeiras");
  }
  return {
    currentBalance: Number(payload.currentBalance || 0),
    locale: payload.locale,
    currency: payload.currency,
    country: payload.country,
    region: payload.region,
    regionConfigured: payload.regionConfigured,
  };
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
    try {
      const data = await fetchUserSettings();
      if (!cancelled) onChange(data);
    } catch (error) {
      if (!cancelled) onError?.(error as Error);
    }
  };

  void run();
  const stopRealtime = subscribeToTableChanges({
    table: "user_settings",
    filter: `uid=eq.${effectiveUid}`,
    onChange: () => void run(),
  });
  const onChangedEvent = () => void run();
  window.addEventListener(USER_SETTINGS_CHANGED_EVENT, onChangedEvent);
  const stopWorkspaceListener = subscribeToActiveWorkspaceChanged(onChangedEvent);
  return () => {
    cancelled = true;
    stopWorkspaceListener();
    stopRealtime();
    window.removeEventListener(USER_SETTINGS_CHANGED_EVENT, onChangedEvent);
  };
};

export const updateUserBalance = async (uid: string, newBalance: number) => {
  void uid;
  const { response, payload } = await apiFetchWithOptionalApproval("/api/user-settings/finance", {
    method: "PUT",
    body: JSON.stringify(withActiveWorkspaceBody({ currentBalance: newBalance })),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível atualizar saldo");
  }
  emitUserSettingsChanged();
};

export const updateUserRegionalPreferences = async (
  uid: string,
  preferences: Pick<UserSettings, "locale" | "currency" | "country" | "region" | "regionConfigured">
) => {
  void uid;
  const { response, payload } = await apiFetchWithOptionalApproval("/api/user-settings/finance", {
    method: "PUT",
    body: JSON.stringify(withActiveWorkspaceBody(preferences)),
  });
  if (!response.ok || !payload.ok) {
    throw new Error(payload.error || "Não foi possível salvar as preferências regionais");
  }
  emitUserSettingsChanged();
};
