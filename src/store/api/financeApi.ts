import { baseApi, type WorkspaceScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";
import type { UserSettings } from "@/types/transaction";

export type FinanceSettings = UserSettings;
type FinanceResponse = FinanceSettings & { ok: boolean };

export const financeApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getFinanceSettings: build.query<FinanceSettings, WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "user-settings/finance", params: { workspaceId } }),
      transformResponse: ({ ok, ...settings }: FinanceResponse) => { void ok; return settings; },
      providesTags: (_result, _error, arg) => [{ type: "FinanceSettings", id: `${arg.userId}:${arg.workspaceId}` }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "user_settings", filter: `uid=eq.${arg.ownerId || arg.userId}` }],
          browserEvents: ["wevenfinance:user-settings:changed"],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "FinanceSettings", id: `${arg.userId}:${arg.workspaceId}` }])); },
        }),
    }),
    updateFinanceSettings: build.mutation<FinanceSettings, WorkspaceScope & Partial<FinanceSettings>>({
      query: ({ userId, workspaceId, ...body }) => { void userId; return { url: "user-settings/finance", method: "PUT", body: { ...body, workspaceId } }; },
      transformResponse: ({ ok, ...settings }: FinanceResponse) => { void ok; return settings; },
      invalidatesTags: (_result, _error, arg) => [{ type: "FinanceSettings", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
  }),
});

export const { useGetFinanceSettingsQuery, useUpdateFinanceSettingsMutation } = financeApi;
