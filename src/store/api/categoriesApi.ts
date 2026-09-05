import type { CustomCategory } from "@/services/categoryService";
import { baseApi, type WorkspaceScope } from "./baseApi";

export type CategoriesData = { customCategories: CustomCategory[]; hiddenDefaultCategories: string[] };

export const categoriesApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getCategories: build.query<CategoriesData, WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "categories", params: { workspaceId } }),
      transformResponse: (response: CategoriesData & { ok: boolean }) => ({ customCategories: response.customCategories ?? [], hiddenDefaultCategories: response.hiddenDefaultCategories ?? [] }),
      providesTags: (_result, _error, arg) => [{ type: "Categories", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
    setDefaultCategoryVisibility: build.mutation<void, WorkspaceScope & { categoryName: string; hidden: boolean }>({
      query: ({ userId, ...body }) => { void userId; return { url: "categories/default-visibility", method: "POST", body }; },
      invalidatesTags: (_result, _error, arg) => [{ type: "Categories", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
  }),
});

export const { useGetCategoriesQuery, useSetDefaultCategoryVisibilityMutation } = categoriesApi;
