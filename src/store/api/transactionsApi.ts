import type { Transaction } from "@/types/transaction";
import { parseApiTransactions, type ApiTransaction } from "@/services/transactionService";
import { baseApi, type WorkspaceScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";

export type TransactionsArgs = WorkspaceScope & { cryptoUid?: string; month?: string; type?: string; page?: number; limit?: number };
const RECURRING_SYNC_TTL_MS = 60_000;
const recurringSyncAt = new Map<string, number>();

export const transactionsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getTransactions: build.query<Transaction[], TransactionsArgs>({
      queryFn: async ({ userId, workspaceId, cryptoUid, ...filters }, _api, _extra, baseQuery) => {
        const syncKey = `${userId}:${workspaceId}`;
        const shouldSyncRecurring = Date.now() - (recurringSyncAt.get(syncKey) || 0) >= RECURRING_SYNC_TTL_MS;
        const initialTransactionsRequest = baseQuery({ url: "transactions", params: { workspaceId, ...filters } });
        let syncCreatedTransactions = false;

        if (shouldSyncRecurring) {
          const syncResult = await baseQuery({ url: "transactions", method: "POST", body: { action: "syncRecurring", workspaceId } });
          if (syncResult.error) return { error: syncResult.error };
          recurringSyncAt.set(syncKey, Date.now());
          syncCreatedTransactions = Number((syncResult.data as { created?: number } | undefined)?.created || 0) > 0;
        }

        const initialResult = await initialTransactionsRequest;
        const result = syncCreatedTransactions
          ? await baseQuery({ url: "transactions", params: { workspaceId, ...filters } })
          : initialResult;
        if (result.error) return { error: result.error };
        const transactions = ((result.data as { transactions?: ApiTransaction[] } | undefined)?.transactions ?? []);
        return { data: await parseApiTransactions(transactions, userId, cryptoUid) };
      },
      providesTags: (_result, _error, arg) => [{ type: "Transactions", id: `${arg.userId}:${arg.workspaceId}` }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "transactions", filter: `uid=eq.${arg.cryptoUid || arg.ownerId || arg.userId}` }],
          browserEvents: ["wevenfinance:transactions:changed"],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "Transactions", id: `${arg.userId}:${arg.workspaceId}` }])); },
        }),
    }),
  }),
});

export const { useGetTransactionsQuery } = transactionsApi;
