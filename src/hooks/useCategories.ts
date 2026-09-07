"use client";

import { useMemo } from "react";

import { getDefaultCategoriesForWorkspaceType, normalizeDefaultCategoryName, slugifyDefaultCategoryName } from "@/lib/categories/defaultCategories";
import { addCustomCategory, deleteCustomCategoryByName, renameCustomCategoryByName, setDefaultCategoryHidden } from "@/services/categoryService";
import { useGetCategoriesQuery } from "@/store/api/categoriesApi";
import type { BusinessOrganizationKind, WorkspaceType } from "@/types/workspace";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export const CATEGORY_PATH_SEPARATOR = "::";
export type CategoryType = "income" | "expense" | "both";
export interface Category { name: string; type: CategoryType; color: string; isCustom?: boolean; isDefault?: boolean; }

const FALLBACK_WORKSPACE_TYPE: WorkspaceType = "personal";
const CUSTOM_CATEGORY_COLOR = "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50";

function buildDefaultCategories(workspaceType: WorkspaceType, businessKind?: BusinessOrganizationKind): Category[] {
  return getDefaultCategoriesForWorkspaceType(workspaceType, businessKind).map((category) => ({ ...category, isDefault: true }));
}
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

  const hiddenDefaultCategories = useMemo(() => (data?.hiddenDefaultCategories ?? []).map(normalizeDefaultCategoryName), [data?.hiddenDefaultCategories]);
  const defaultCategories = useMemo(() => buildDefaultCategories(workspaceType, activeWorkspace?.settings?.businessOrganizationKind).map((category) => ({
    ...category,
    hidden: normalizeDefaultCategoryName(category.name) === "Outros" ? false : hiddenDefaultCategories.some((name) => normalizeCategoryKey(name) === normalizeCategoryKey(category.name)),
  })), [activeWorkspace?.settings?.businessOrganizationKind, hiddenDefaultCategories, workspaceType]);
  const categories = useMemo(() => {
    const visibleDefaults = defaultCategories.filter((category) => !category.hidden);
    const custom: Category[] = (data?.customCategories ?? []).map((category) => ({
      name: normalizeDefaultCategoryName(category.name), type: category.type, color: category.color || CUSTOM_CATEGORY_COLOR, isCustom: true,
    }));
    const result: Category[] = [...visibleDefaults];
    for (const category of custom) if (!result.some((existing) => categoriesOverlap(existing, category))) result.push(category);
    return result;
  }, [data?.customCategories, defaultCategories]);

  const token = async () => {
    if (!user) throw new Error("missing_auth_user");
    return user.getIdToken();
  };
  const addNewCategory = async (name: string, type: CategoryType, parentName?: string) => {
    const finalName = parentName ? `${parentName}${CATEGORY_PATH_SEPARATOR}${name}` : name;
    await addCustomCategory(await token(), finalName, type);
  };
  const deleteCategory = async (name: string) => { await deleteCustomCategoryByName(await token(), name, "Outros"); };
  const renameCategory = async (oldName: string, newName: string) => {
    const trimmed = newName.trim(); if (!trimmed) return;
    await renameCustomCategoryByName(await token(), oldName, trimmed);
  };
  const toggleDefaultCategoryVisibility = async (name: string, hidden: boolean) => {
    const canonicalName = normalizeDefaultCategoryName(name); if (canonicalName === "Outros") return;
    await setDefaultCategoryHidden(await token(), canonicalName, hidden);
  };

  const waitingForWorkspace = Boolean(userId) && (workspacesLoading || !workspaceId);
  const loadingCategories = waitingForWorkspace || isLoading || (!data && isFetching);
  return { categories, defaultCategories, hiddenDefaultCategories, loadingCategories, addNewCategory, deleteCategory, renameCategory, toggleDefaultCategoryVisibility };
}
