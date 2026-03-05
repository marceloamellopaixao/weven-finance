"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import {
    getCustomCategories,
    addCustomCategory,
    deleteCustomCategoryByName,
    renameCustomCategoryByName,
    getHiddenDefaultCategories,
    setDefaultCategoryHidden,
} from "@/services/categoryService";

export const CATEGORY_PATH_SEPARATOR = "::";

export type CategoryType = "income" | "expense" | "both";

export interface Category {
    name: string;
    type: CategoryType;
    color: string;
    isCustom?: boolean;
    isDefault?: boolean;
}

const INITIAL_CATEGORIES: Category[] = [
    { name: "Dízimo", type: "expense", color: "bg-violet-500/10 text-violet-600 border-violet-200/50 dark:text-violet-400 dark:border-violet-800/50" },
    { name: "Casa", type: "expense", color: "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:text-blue-400 dark:border-blue-800/50" },
    { name: "Alimentação", type: "expense", color: "bg-orange-500/10 text-orange-600 border-orange-200/50 dark:text-orange-400 dark:border-orange-800/50" },
    { name: "Investimento", type: "expense", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:text-emerald-400 dark:border-emerald-800/50" },
    { name: "Compras", type: "expense", color: "bg-pink-500/10 text-pink-600 border-pink-200/50 dark:text-pink-400 dark:border-pink-800/50" },
    { name: "Streaming", type: "expense", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200/50 dark:text-indigo-400 dark:border-indigo-800/50" },
    { name: "Salário", type: "income", color: "bg-green-500/10 text-green-600 border-green-200/50 dark:text-green-400 dark:border-green-800/50" },
    { name: "Rendimento", type: "income", color: "bg-green-500/10 text-green-600 border-green-200/50 dark:text-green-400 dark:border-green-800/50" },
    { name: "Vendas", type: "income", color: "bg-teal-500/10 text-teal-600 border-teal-200/50 dark:text-teal-400 dark:border-teal-800/50" },
    { name: "Serviços", type: "income", color: "bg-teal-500/10 text-teal-600 border-teal-200/50 dark:text-teal-400 dark:border-teal-800/50" },
    { name: "Outros", type: "both", color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50" },
];

export function useCategories() {
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [hiddenDefaultCategories, setHiddenDefaultCategories] = useState<string[]>([]);

    useEffect(() => {
        if (!user) return;

        const loadCategories = async () => {
            try {
                const [customCats, hiddenDefaults] = await Promise.all([
                    getCustomCategories(user.uid),
                    getHiddenDefaultCategories(user.uid),
                ]);

                const formattedCustom: Category[] = customCats.map((cat) => ({
                    name: cat.name,
                    type: cat.type,
                    color: cat.color,
                    isCustom: true,
                }));

                const hiddenSet = new Set(hiddenDefaults);
                const visibleDefaultCats = INITIAL_CATEGORIES
                    .map((cat) => ({ ...cat, isDefault: true }))
                    .filter((cat) => cat.name === "Outros" || !hiddenSet.has(cat.name));

                const allCats = [...visibleDefaultCats];
                formattedCustom.forEach((fc) => {
                    if (!allCats.some((ac) => ac.name === fc.name)) {
                        allCats.push(fc);
                    }
                });

                setHiddenDefaultCategories(hiddenDefaults);
                setCategories(allCats);
            } catch (error) {
                console.error("Erro ao carregar categorias:", error);
            } finally {
                setLoadingCategories(false);
            }
        };

        loadCategories();
    }, [user]);

    const addNewCategory = async (
        name: string,
        type: CategoryType,
        parentName?: string
    ) => {
        if (!user) return;

        const finalName = parentName
            ? `${parentName}${CATEGORY_PATH_SEPARATOR}${name}`
            : name;

        const newCat: Category = {
            name: finalName,
            type,
            color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
            isCustom: true,
        };

        setCategories((prev) => [...prev, newCat]);

        await addCustomCategory(user.uid, finalName, type);
    };

    const deleteCategory = async (name: string) => {
        if (!user) return;

        setCategories((prev) => prev.filter((cat) => cat.name !== name && !cat.name.startsWith(`${name}${CATEGORY_PATH_SEPARATOR}`)));
        await deleteCustomCategoryByName(user.uid, name, "Outros");
    };

    const renameCategory = async (oldName: string, newName: string) => {
        if (!user) return;

        const trimmed = newName.trim();
        if (!trimmed) return;

        setCategories((prev) =>
            prev.map((cat) => {
                if (cat.name === oldName || cat.name.startsWith(`${oldName}${CATEGORY_PATH_SEPARATOR}`)) {
                    const suffix = cat.name.slice(oldName.length);
                    return { ...cat, name: `${trimmed}${suffix}` };
                }
                return cat;
            })
        );

        await renameCustomCategoryByName(user.uid, oldName, trimmed);
    };

    const toggleDefaultCategoryVisibility = async (name: string, hidden: boolean) => {
        if (!user) return;
        if (name === "Outros") return;

        const defaultCategory = INITIAL_CATEGORIES.find((cat) => cat.name === name);
        if (!defaultCategory) return;

        setHiddenDefaultCategories((prev) =>
            hidden ? Array.from(new Set([...prev, name])) : prev.filter((n) => n !== name)
        );

        setCategories((prev) => {
            if (hidden) {
                return prev.filter((cat) => cat.name !== name);
            }

            if (prev.some((cat) => cat.name === name)) return prev;
            return [{ ...defaultCategory, isDefault: true }, ...prev];
        });

        await setDefaultCategoryHidden(user.uid, name, hidden);
    };

    const defaultCategories = INITIAL_CATEGORIES.map((cat) => ({
        ...cat,
        isDefault: true,
        hidden: cat.name === "Outros" ? false : hiddenDefaultCategories.includes(cat.name),
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
