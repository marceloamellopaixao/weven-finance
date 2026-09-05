import type { Transaction } from "@/types/transaction";
import { parseApiTransactions, type ApiTransaction } from "@/services/transactionService";
import { baseApi, type WorkspaceScope } from "./baseApi";

export type TransactionsArgs = WorkspaceScope & { cryptoUid?: string; month?: string; type?: string; page?: number; pageSize?: number; syncRecurring?: boolean };

export const transactionsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getTransactions: build.query<Transaction[], TransactionsArgs>({
      queryFn: async ({ userId, workspaceId, cryptoUid, syncRecurring, ...filters }, _api, _extra, baseQuery) => {
        if (syncRecurring) {
          const syncResult = await baseQuery({ url: "transactions", method: "POST", body: { action: "syncRecurring", workspaceId } });
          if (syncResult.error) return { error: syncResult.error };
        }
        const result = await baseQuery({ url: "transactions", params: { workspaceId, ...filters } });
        if (result.error) return { error: result.error };
        const transactions = ((result.data as { transactions?: ApiTransaction[] } | undefined)?.transactions ?? []);
        return { data: await parseApiTransactions(transactions, userId, cryptoUid) };
      },
      providesTags: (_result, _error, arg) => [{ type: "Transactions", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
  }),
});

export const { useGetTransactionsQuery } = transactionsApi;
