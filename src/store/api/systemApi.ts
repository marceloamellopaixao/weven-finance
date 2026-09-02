import type { AccessPermissionLevel, AccessResourceKey, FeatureAccessConfig, PlansConfig } from "@/types/system";
import { baseApi, type UserScope } from "./baseApi";

type AccessResult = { access: Partial<Record<AccessResourceKey, AccessPermissionLevel>>; featureAccess: FeatureAccessConfig };
type UpdatePlansArgs = UserScope & { plans: PlansConfig };

export const systemApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getPlans: build.query<PlansConfig, UserScope>({
      query: () => "system/plans",
      transformResponse: (response: { plans: PlansConfig }) => response.plans,
      providesTags: ["Plans"],
      keepUnusedDataFor: 300,
    }),
    updatePlans: build.mutation<PlansConfig, UpdatePlansArgs>({
      query: ({ plans }) => ({
        url: "system/plans",
        method: "PUT",
        body: { plans },
      }),
      transformResponse: (response: { plans: PlansConfig }) => response.plans,
      async onQueryStarted({ userId, plans }, { dispatch, queryFulfilled }) {
        const optimisticPatch = dispatch(
          systemApi.util.updateQueryData("getPlans", { userId }, () => plans),
        );
        try {
          const { data } = await queryFulfilled;
          dispatch(systemApi.util.updateQueryData("getPlans", { userId }, () => data));
        } catch {
          optimisticPatch.undo();
        }
      },
    }),
    getAccessControl: build.query<AccessResult, UserScope>({
      query: () => "system/access-control/me",
      transformResponse: (response: AccessResult & { ok: boolean }) => ({ access: response.access ?? {}, featureAccess: response.featureAccess }),
      providesTags: (_result, _error, arg) => [{ type: "AccessControl", id: arg.userId }],
    }),
  }),
});

export const { useGetPlansQuery, useUpdatePlansMutation, useGetAccessControlQuery } = systemApi;
