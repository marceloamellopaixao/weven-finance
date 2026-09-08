import type { AccessPermissionLevel, AccessResourceKey, FeatureAccessConfig, PlansConfig } from "@/types/system";
import { baseApi, type UserScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";
import type { CategoryPresetsConfig } from "@/lib/categories/defaultCategories";

type AccessResult = { access: Partial<Record<AccessResourceKey, AccessPermissionLevel>>; featureAccess: FeatureAccessConfig };
type UpdatePlansArgs = UserScope & { plans: PlansConfig };
type UpdateCategoryPresetsArgs = UserScope & { categoryPresets: CategoryPresetsConfig };

export const systemApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getPlans: build.query<PlansConfig, UserScope>({
      query: () => "system/plans",
      transformResponse: (response: { plans: PlansConfig }) => response.plans,
      providesTags: ["Plans"],
      keepUnusedDataFor: 300,
      onCacheEntryAdded: (_arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "system_configs", filter: "key=eq.plans" }],
          onChange: () => { dispatch(baseApi.util.invalidateTags(["Plans"])); },
        }),
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
    getCategoryPresets: build.query<CategoryPresetsConfig, UserScope>({
      query: () => "system/category-presets",
      transformResponse: (response: { categoryPresets: CategoryPresetsConfig }) => response.categoryPresets,
      providesTags: ["CategoryPresets"],
      keepUnusedDataFor: 300,
      onCacheEntryAdded: (_arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [{ table: "system_configs", filter: "key=eq.category_presets" }],
          onChange: () => { dispatch(baseApi.util.invalidateTags(["CategoryPresets", "Categories"])); },
        }),
    }),
    updateCategoryPresets: build.mutation<CategoryPresetsConfig, UpdateCategoryPresetsArgs>({
      query: ({ categoryPresets }) => ({
        url: "system/category-presets",
        method: "PUT",
        body: { categoryPresets },
      }),
      transformResponse: (response: { categoryPresets: CategoryPresetsConfig }) => response.categoryPresets,
      invalidatesTags: ["CategoryPresets", "Categories"],
    }),
    getAccessControl: build.query<AccessResult, UserScope>({
      query: () => "system/access-control/me",
      transformResponse: (response: AccessResult & { ok: boolean }) => ({ access: response.access ?? {}, featureAccess: response.featureAccess }),
      providesTags: (_result, _error, arg) => [{ type: "AccessControl", id: arg.userId }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [
            { table: "system_configs", filter: "key=eq.access_control" },
            { table: "profiles", filter: `uid=eq.${arg.userId}` },
          ],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "AccessControl", id: arg.userId }])); },
        }),
    }),
  }),
});

export const {
  useGetPlansQuery,
  useUpdatePlansMutation,
  useGetCategoryPresetsQuery,
  useUpdateCategoryPresetsMutation,
  useGetAccessControlQuery,
  useLazyGetAccessControlQuery,
} = systemApi;
