import type { PiggyBank } from "@/types/piggyBank";
import { baseApi, type WorkspaceScope } from "./baseApi";

export const piggyBanksApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getPiggyBanks: build.query<PiggyBank[], WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "piggy-banks", params: { workspaceId } }),
      transformResponse: (response: { piggyBanks?: PiggyBank[] }) => response.piggyBanks ?? [],
      providesTags: (_result, _error, arg) => [{ type: "PiggyBanks", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
  }),
});

export const { useGetPiggyBanksQuery } = piggyBanksApi;
