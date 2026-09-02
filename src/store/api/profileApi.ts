import type { UserProfile } from "@/types/user";
import { baseApi, type UserScope } from "./baseApi";

type ProfileResponse = { ok: boolean; profile?: UserProfile | null };

export const profileApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getProfile: build.query<UserProfile | null, UserScope>({
      query: () => "profile/me",
      transformResponse: (response: ProfileResponse) => response.profile ?? null,
      providesTags: (_result, _error, arg) => [{ type: "Profile", id: arg.userId }],
    }),
  }),
});

export const { useGetProfileQuery } = profileApi;
