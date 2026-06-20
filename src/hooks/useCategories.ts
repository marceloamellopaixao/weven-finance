"use client";

import { useEffect, useState } from "react";

import { useI18n } from "@/i18n/I18nProvider";
import {
  getDefaultCategoriesForWorkspaceType,
  normalizeDefaultCategoryName,
  slugifyDefaultCategoryName,
} from "@/lib/categories/defaultCategories";
import { subscribeToTableChanges } from "@/services/supabase/realtime";
import { subscribeToActiveWorkspaceChanged } from "@/services/workspaceService";
import {
  addCustomCategory,
  deleteCustomCategoryByName,
  getCategoriesData,
  renameCustomCategoryByName,
  setDefaultCategoryHidden,
} from "@/services/categoryService";
import type { WorkspaceType } from "@/types/workspace";
import { useAuth } from "./useAuth";
import { useWorkspaces } from "./useWorkspaces";

export const CATEGORY_PATH_SEPARATOR = "::";

export type CategoryType = "income" | "expense" | "both";

export interface Category {
  name: string;
  type: CategoryType;
  color: string;
  isCustom?: boolean;
  isDefault?: boolean;
}

const FALLBACK_WORKSPACE_TYPE: WorkspaceType = "personal";
const CUSTOM_CATEGORY_COLOR =
  "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50";

function buildDefaultCategories(workspaceType: WorkspaceType = FALLBACK_WORKSPACE_TYPE): Category[] {
  return getDefaultCategoriesForWorkspaceType(workspaceType).map((category) => ({
    name: category.name,
    type: category.type,
    color: category.color,
    isDefault: true,
  }));
}

function normalizeCategoryKey(name: string) {
  return slugifyDefaultCategoryName(normalizeDefaultCategoryName(name));
}

function categoriesOverlap(left: Category, right: Category) {
  if (left.name === right.name) return true;
  if (left.type !== right.type && left.type !== "both" && right.type !== "both") return false;
  return normalizeCategoryKey(left.name) === normalizeCategoryKey(right.name);
}

export function useCategories() {
  const { user, userProfile } = useAuth();
  const { locale } = useI18n();
  const { activeWorkspace } = useWorkspaces();
  const workspaceType = activeWorkspace?.type || FALLBACK_WORKSPACE_TYPE;
  const [categories, setCategories] = useState<Category[]>(() => buildDefaultCategories(workspaceType));
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [hiddenDefaultCategories, setHiddenDefaultCategories] = useState<string[]>([]);

  useEffect(() => {
    const effectiveUid = userProfile?.uid || user?.uid;
    if (!user || !effectiveUid) {
      setCategories(buildDefaultCategories(workspaceType));
      setLoadingCategories(false);
      return;
    }

    let cancelled = false;

    const loadCategories = async () => {
      try {
        const token = await user.getIdToken();
        const { customCategories: customCats, hiddenDefaultCategories: hiddenDefaults } = await getCategoriesData(token);
        const hiddenKeys = new Set(hiddenDefaults.map(normalizeCategoryKey));
        const defaultCats = buildDefaultCategories(workspaceType);
        const visibleDefaultCats = defaultCats.filter(
          (cat) => normalizeDefaultCategoryName(cat.name) === "Outros" || !hiddenKeys.has(normalizeCategoryKey(cat.name))
        );
        const formattedCustom: Category[] = customCats.map((cat) => ({
          name: normalizeDefaultCategoryName(cat.name),
          type: cat.type,
          color: cat.color,
          isCustom: true,
        }));

        const allCats: Category[] = [...visibleDefaultCats];
        formattedCustom.forEach((customCategory) => {
          if (!allCats.some((category) => categoriesOverlap(category, customCategory))) {
            allCats.push(customCategory);
          }
        });

        if (cancelled) return;
        setHiddenDefaultCategories(hiddenDefaults.map(normalizeDefaultCategoryName));
        setCategories(allCats);
      } catch (error) {
        console.error("Erro ao carregar categorias:", error);
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };

    void loadCategories();
    const stopCategories = subscribeToTableChanges({
      table: "categories",
      filter: `uid=eq.${effectiveUid}`,
      onChange: () => void loadCategories(),
    });
    const stopSettings = subscribeToTableChanges({
      table: "user_settings",
      filter: `uid=eq.${effectiveUid}`,
      onChange: () => void loadCategories(),
    });
    const stopActiveWorkspace = subscribeToActiveWorkspaceChanged(() => {
      setLoadingCategories(true);
      void loadCategories();
    });

    return () => {
      cancelled = true;
      stopCategories();
      stopSettings();
      stopActiveWorkspace();
    };
  }, [user, userProfile?.uid, workspaceType, locale]);

  const addNewCategory = async (name: string, type: CategoryType, parentName?: string) => {
    if (!user) return;

    const finalName = parentName ? `${parentName}${CATEGORY_PATH_SEPARATOR}${name}` : name;
    await addCustomCategory(await user.getIdToken(), finalName, type);

    const newCat: Category = {
      name: finalName,
      type,
      color: CUSTOM_CATEGORY_COLOR,
      isCustom: true,
    };

    setCategories((prev) => {
      if (prev.some((cat) => categoriesOverlap(cat, newCat))) return prev;
      return [...prev, newCat];
    });
  };

  const deleteCategory = async (name: string) => {
    if (!user) return;
    await deleteCustomCategoryByName(await user.getIdToken(), name, "Outros");
    setCategories((prev) => prev.filter((cat) => cat.name !== name && !cat.name.startsWith(`${name}${CATEGORY_PATH_SEPARATOR}`)));
  };

  const renameCategory = async (oldName: string, newName: string) => {
    if (!user) return;

    const trimmed = newName.trim();
    if (!trimmed) return;
    await renameCustomCategoryByName(await user.getIdToken(), oldName, trimmed);
    setCategories((prev) =>
      prev.map((cat) => {
        if (cat.name === oldName || cat.name.startsWith(`${oldName}${CATEGORY_PATH_SEPARATOR}`)) {
          const suffix = cat.name.slice(oldName.length);
          return { ...cat, name: `${trimmed}${suffix}` };
        }
        return cat;
      })
    );
  };

  const toggleDefaultCategoryVisibility = async (name: string, hidden: boolean) => {
    if (!user) return;
    const canonicalName = normalizeDefaultCategoryName(name);
    if (canonicalName === "Outros") return;

    const defaultCategory = buildDefaultCategories(workspaceType).find(
      (cat) => normalizeDefaultCategoryName(cat.name) === canonicalName
    );
    if (!defaultCategory) return;

    setHiddenDefaultCategories((prev) =>
      hidden ? Array.from(new Set([...prev, canonicalName])) : prev.filter((item) => normalizeDefaultCategoryName(item) !== canonicalName)
    );

    setCategories((prev) => {
      if (hidden) {
        return prev.filter((cat) => normalizeDefaultCategoryName(cat.name) !== canonicalName);
      }

      if (prev.some((cat) => normalizeDefaultCategoryName(cat.name) === canonicalName)) return prev;
      return [{ ...defaultCategory, isDefault: true }, ...prev];
    });

    await setDefaultCategoryHidden(await user.getIdToken(), canonicalName, hidden);
  };

  const defaultCategories = buildDefaultCategories(workspaceType).map((cat) => ({
    ...cat,
    isDefault: true,
    hidden:
      normalizeDefaultCategoryName(cat.name) === "Outros"
        ? false
        : hiddenDefaultCategories.some((name) => normalizeCategoryKey(name) === normalizeCategoryKey(cat.name)),
  }));

  return {
    categories,
    defaultCategories,
    hiddenDefaultCategories,
    loadingCategories,
    addNewCategory,
    deleteCategory,
    renameCategory,
    toggleDefaultCategoryVisibility,
  };
}
