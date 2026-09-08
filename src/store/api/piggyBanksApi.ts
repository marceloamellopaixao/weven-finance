import type { PiggyBank } from "@/types/piggyBank";
import { baseApi, type WorkspaceScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";

export const piggyBanksApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getPiggyBanks: build.query<PiggyBank[], WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "piggy-banks", params: { workspaceId } }),
      transformResponse: (response: { piggyBanks?: PiggyBank[] }) => response.piggyBanks ?? [],
      providesTags: (_result, _error, arg) => [{ type: "PiggyBanks", id: `${arg.userId}:${arg.workspaceId}` }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "piggy_banks", filter: `uid=eq.${arg.ownerId || arg.userId}` }],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "PiggyBanks", id: `${arg.userId}:${arg.workspaceId}` }])); },
        }),
    }),
  }),
});

export const { useGetPiggyBanksQuery } = piggyBanksApi;
