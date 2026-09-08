"use client";

import { useMemo } from "react";

import { getDefaultCategoriesForWorkspaceType, normalizeDefaultCategoryName, slugifyDefaultCategoryName } from "@/lib/categories/defaultCategories";
import {
  useAddCategoryMutation,
  useDeleteCategoryMutation,
  useGetCategoriesQuery,
  useRenameCategoryMutation,
  useSetDefaultCategoryVisibilityMutation,
} from "@/store/api/categoriesApi";
import type { WorkspaceType } from "@/types/workspace";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export const CATEGORY_PATH_SEPARATOR = "::";
export type CategoryType = "income" | "expense" | "both";
export interface Category { name: string; type: CategoryType; color: string; isCustom?: boolean; isDefault?: boolean; }

const FALLBACK_WORKSPACE_TYPE: WorkspaceType = "personal";
const CUSTOM_CATEGORY_COLOR = "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50";

function normalizeCategoryKey(name: string) { return slugifyDefaultCategoryName(normalizeDefaultCategoryName(name)); }
function categoriesOverlap(left: Category, right: Category) {
  if (left.name === right.name) return true;
  if (left.type !== right.type && left.type !== "both" && right.type !== "both") return false;
  return normalizeCategoryKey(left.name) === normalizeCategoryKey(right.name);
}

export function useCategories() {
  const { user, userProfile } = useAuth();
  const { activeWorkspace, loading: workspacesLoading } = useWorkspaces();
  const workspaceType = activeWorkspace?.type || FALLBACK_WORKSPACE_TYPE;
  const workspaceId = activeWorkspace?.id;
  const ownerId = activeWorkspace?.ownerUid || activeWorkspace?.uid;
  const userId = userProfile?.uid || user?.uid;
  const { data, isLoading, isFetching } = useGetCategoriesQuery(
    { userId: userId || "", workspaceId: workspaceId || "", ownerId: ownerId || userId || "" }, { skip: !userId || !workspaceId },
  );
  const [addCategoryRequest] = useAddCategoryMutation();
  const [deleteCategoryRequest] = useDeleteCategoryMutation();
  const [renameCategoryRequest] = useRenameCategoryMutation();
  const [setDefaultCategoryVisibility] = useSetDefaultCategoryVisibilityMutation();
  const serverDefaultCategories = data?.defaultCategories;
  const customCategories = data?.customCategories;

  const hiddenDefaultCategories = useMemo(() => (data?.hiddenDefaultCategories ?? []).map(normalizeDefaultCategoryName), [data?.hiddenDefaultCategories]);
  const defaultCategories = useMemo(() => {
    const presets = serverDefaultCategories?.length
      ? serverDefaultCategories
      : getDefaultCategoriesForWorkspaceType(workspaceType, activeWorkspace?.settings?.businessOrganizationKind);
    return presets.map((category) => ({
      ...category,
      isDefault: true,
      hidden: normalizeDefaultCategoryName(category.name) === "Outros"
        ? false
        : hiddenDefaultCategories.some((hiddenName) => {
            const hiddenKey = normalizeCategoryKey(hiddenName);
            return hiddenKey === normalizeCategoryKey(category.name)
              || (category.aliases ?? []).some((alias) => hiddenKey === normalizeCategoryKey(alias));
          }),
    }));
  }, [activeWorkspace?.settings?.businessOrganizationKind, hiddenDefaultCategories, serverDefaultCategories, workspaceType]);
  const categories = useMemo(() => {
    const visibleDefaults = defaultCategories.filter((category) => !category.hidden);
    const custom: Category[] = (customCategories ?? []).map((category) => ({
      name: normalizeDefaultCategoryName(category.name), type: category.type, color: category.color || CUSTOM_CATEGORY_COLOR, isCustom: true,
    }));
    const result: Category[] = [...visibleDefaults];
    for (const category of custom) if (!result.some((existing) => categoriesOverlap(existing, category))) result.push(category);
    return result;
  }, [customCategories, defaultCategories]);

  const mutationScope = () => {
    if (!userId || !workspaceId) throw new Error("workspace_not_ready");
    return { userId, workspaceId, ownerId: ownerId || userId };
  };
  const rethrowMutationError = (error: unknown, fallback: string): never => {
    const apiError = error as { data?: { error?: unknown }; error?: string };
    const message = typeof apiError.data?.error === "string"
      ? apiError.data.error
      : typeof apiError.error === "string" ? apiError.error : fallback;
    throw new Error(message);
  };
  const addNewCategory = async (name: string, type: CategoryType, parentName?: string) => {
    const finalName = parentName ? `${parentName}${CATEGORY_PATH_SEPARATOR}${name}` : name;
    try {
      await addCategoryRequest({ ...mutationScope(), name: finalName, categoryType: type }).unwrap();
    } catch (error) {
      rethrowMutationError(error, "category_create_failed");
    }
  };
  const deleteCategory = async (name: string) => {
    try {
      await deleteCategoryRequest({ ...mutationScope(), categoryName: name, fallbackCategory: "Outros" }).unwrap();
    } catch (error) {
      rethrowMutationError(error, "category_delete_failed");
    }
  };
  const renameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim(); if (!trimmed) return;
    try {
      await renameCategoryRequest({ ...mutationScope(), oldName, newName: trimmed }).unwrap();
    } catch (error) {
      rethrowMutationError(error, "category_rename_failed");
    }
  };
  const toggleDefaultCategoryVisibility = async (name: string, hidden: boolean) => {
    const canonicalName = normalizeDefaultCategoryName(name); if (canonicalName === "Outros") return;
    try {
      await setDefaultCategoryVisibility({ ...mutationScope(), categoryName: canonicalName, hidden }).unwrap();
    } catch (error) {
      rethrowMutationError(error, "category_visibility_failed");
    }
  };

  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !workspaceId);
  const loadingCategories = waitingForWorkspace || isLoading || (!data && isFetching);
  return { categories, defaultCategories, hiddenDefaultCategories, loadingCategories, addNewCategory, deleteCategory, renameCategory, toggleDefaultCategoryVisibility };
}
