import type { CreateWorkspaceInput, UpdateWorkspaceInput, Workspace } from "@/types/workspace";
import { baseApi, type UserScope } from "./baseApi";
import { keepQueryFreshFromRealtime } from "./cacheLifecycle";

type WorkspacesResponse = { ok: boolean; workspaces?: Workspace[]; workspace?: Workspace };

export const workspacesApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getWorkspaces: build.query<Workspace[], UserScope>({
      query: () => "workspaces",
      transformResponse: (response: WorkspacesResponse) => response.workspaces ?? [],
      providesTags: (_result, _error, arg) => [{ type: "Workspaces", id: arg.userId }],
      onCacheEntryAdded: (arg, { cacheDataLoaded, cacheEntryRemoved, dispatch }) =>
        keepQueryFreshFromRealtime({
          cacheDataLoaded,
          cacheEntryRemoved,
          sources: [
            { table: "profiles", filter: `uid=eq.${arg.userId}` },
            { table: "workspace_members", filter: `member_uid=eq.${arg.userId}` },
          ],
          browserEvents: ["wevenfinance:workspaces:changed"],
          onChange: () => { dispatch(baseApi.util.invalidateTags([{ type: "Workspaces", id: arg.userId }])); },
        }),
    }),
    createWorkspace: build.mutation<Workspace, UserScope & CreateWorkspaceInput>({
      query: ({ userId, ...body }) => { void userId; return { url: "workspaces", method: "POST", body }; },
      transformResponse: (response: WorkspacesResponse) => response.workspace as Workspace,
      invalidatesTags: (_result, _error, arg) => [{ type: "Workspaces", id: arg.userId }],
    }),
    updateWorkspace: build.mutation<Workspace, UserScope & UpdateWorkspaceInput>({
      query: ({ userId, ...body }) => { void userId; return { url: "workspaces", method: "PATCH", body }; },
      transformResponse: (response: WorkspacesResponse) => response.workspace as Workspace,
      invalidatesTags: (_result, _error, arg) => [{ type: "Workspaces", id: arg.userId }],
    }),
  }),
});

export const { useGetWorkspacesQuery, useCreateWorkspaceMutation, useUpdateWorkspaceMutation } = workspacesApi;
