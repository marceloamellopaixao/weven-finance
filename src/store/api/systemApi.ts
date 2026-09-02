import type { AccessPermissionLevel, AccessResourceKey, FeatureAccessConfig, PlansConfig } from "@/types/system";
import { baseApi, type UserScope } from "./baseApi";

type AccessResult = { access: Partial<Record<AccessResourceKey, AccessPermissionLevel>>; featureAccess: FeatureAccessConfig };

export const systemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPlans: build.query<PlansConfig, UserScope>({
      query: () => "system/plans",
      transformResponse: (response: { plans: PlansConfig }) => response.plans,
      providesTags: ["Plans"],
      keepUnusedDataFor: 300,
    }),
    getAccessControl: build.query<AccessResult, UserScope>({
      query: () => "system/access-control/me",
      transformResponse: (response: AccessResult & { ok: boolean }) => ({ access: response.access ?? {}, featureAccess: response.featureAccess }),
      providesTags: (_result, _error, arg) => [{ type: "AccessControl", id: arg.userId }],
    }),
  }),
});

export const { useGetPlansQuery, useGetAccessControlQuery } = systemApi;
