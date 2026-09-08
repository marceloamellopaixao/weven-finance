import { CATEGORIES_CHANGED_EVENT, type CustomCategory } from "@/services/categoryService";
import { baseApi, type WorkspaceScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";
import type { DefaultCategoryPreset } from "@/lib/categories/defaultCategories";

export type CategoriesData = {
  customCategories: CustomCategory[];
  defaultCategories: DefaultCategoryPreset[];
  hiddenDefaultCategories: string[];
};

type CategoryMutationResult = { ok: boolean; id?: string; updated?: number; hiddenDefaultCategories?: string[] };

function categoriesTag(arg: WorkspaceScope) {
  return { type: "Categories" as const, id: `${arg.userId}:${arg.workspaceId}` };
}

export const categoriesApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getCategories: build.query<CategoriesData, WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "categories", params: { workspaceId } }),
      transformResponse: (response: CategoriesData & { ok: boolean }) => ({
        customCategories: response.customCategories ?? [],
        defaultCategories: response.defaultCategories ?? [],
        hiddenDefaultCategories: response.hiddenDefaultCategories ?? [],
      }),
      providesTags: (_result, _error, arg) => [categoriesTag(arg)],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [
            { table: "categories", filter: `uid=eq.${arg.ownerId || arg.userId}` },
            { table: "user_settings", filter: `uid=eq.${arg.ownerId || arg.userId}` },
            { table: "system_configs", filter: "key=eq.category_presets" },
          ],
          browserEvents: [CATEGORIES_CHANGED_EVENT],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "Categories", id: `${arg.userId}:${arg.workspaceId}` }])); },
        }),
    }),
    addCategory: build.mutation<CategoryMutationResult, WorkspaceScope & { name: string; categoryType: CustomCategory["type"]; color?: string }>({
      query: ({ userId, ownerId, categoryType, ...body }) => {
        void userId;
        void ownerId;
        return { url: "categories", method: "POST", body: { ...body, type: categoryType } };
      },
      invalidatesTags: (_result, _error, arg) => [categoriesTag(arg)],
    }),
    renameCategory: build.mutation<CategoryMutationResult, WorkspaceScope & { oldName: string; newName: string }>({
      query: ({ userId, ownerId, ...body }) => {
        void userId;
        void ownerId;
        return { url: "categories", method: "PATCH", body };
      },
      invalidatesTags: (_result, _error, arg) => [categoriesTag(arg), { type: "Transactions", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
    deleteCategory: build.mutation<CategoryMutationResult, WorkspaceScope & { categoryName: string; fallbackCategory?: string }>({
      query: ({ userId, ownerId, workspaceId, categoryName, fallbackCategory = "Outros" }) => {
        void userId;
        void ownerId;
        return {
          url: "categories",
          method: "DELETE",
          params: { workspaceId, name: categoryName, fallbackCategory },
        };
      },
      invalidatesTags: (_result, _error, arg) => [categoriesTag(arg), { type: "Transactions", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
    setDefaultCategoryVisibility: build.mutation<CategoryMutationResult, WorkspaceScope & { categoryName: string; hidden: boolean }>({
      query: ({ userId, ownerId, ...body }) => {
        void userId;
        void ownerId;
        return { url: "categories/default-visibility", method: "POST", body };
      },
      invalidatesTags: (_result, _error, arg) => [categoriesTag(arg)],
    }),
  }),
});

export const {
  useGetCategoriesQuery,
  useAddCategoryMutation,
  useRenameCategoryMutation,
  useDeleteCategoryMutation,
  useSetDefaultCategoryVisibilityMutation,
} = categoriesApi;
