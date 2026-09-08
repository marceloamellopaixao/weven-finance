import type { UserProfile } from "@/types/user";
import { baseApi, type UserScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";

type ProfileResponse = { ok: boolean; profile?: UserProfile | null };

export const profileApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getProfile: build.query<UserProfile | null, UserScope>({
      query: () => "profile/me",
      transformResponse: (response: ProfileResponse) => response.profile ?? null,
      providesTags: (_result, _error, arg) => [{ type: "Profile", id: arg.userId }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "profiles", filter: `uid=eq.${arg.userId}` }],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "Profile", id: arg.userId }])); },
        }),
    }),
  }),
});

export const { useGetProfileQuery, useLazyGetProfileQuery } = profileApi;
