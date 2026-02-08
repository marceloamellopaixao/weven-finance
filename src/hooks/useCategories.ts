"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { getCustomCategories, addCustomCategory } from "@/services/categoryService";

const INITIAL_CATEGORIES = [
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
]

export function useCategories() {
    const { user } = useAuth();
    const [categories, setCategories] = useState(INITIAL_CATEGORIES);
    const [loadingCategories, setLoadingCategories] = useState(true);

    // Carrega as categorias customizadas do Firestore ao iniciar
    useEffect(() => {
        if (!user) return;

        const loadCategories = async () => {
            try {
                const customCats = await getCustomCategories(user.uid);

                // Formata as categorias vindas do banco para o formato visual esperado
                const formattedCustom = customCats.map(cat => ({
                    name: cat.name,
                    type: cat.type,
                    color: cat.color
                }))

                // Junta as categorias iniciais com as customizadas (evitando duplicatas pelo nome)
                const allCats = [...INITIAL_CATEGORIES]
                formattedCustom.forEach(fc => {
                    if (!allCats.some(ac => ac.name === fc.name)) {
                        allCats.push(fc);
                    }
                })

                setCategories(allCats);
            } catch (error) {
                console.error("Erro ao carregar categorias:", error);
            } finally {
                setLoadingCategories(false);
            };
        };

        loadCategories();
    }, [user]);

    // Função para adicionar nova categoria (salva no Firestore e atualiza o estado local)
    const addNewCategory = async (name: string, type: "income" | "expense" | "both") => {
        if (!user) return;

        // Otimisticamente atualiza a UI
        const newCat = { 
            name, 
            type, 
            color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50"
        };
        setCategories(prev => [...prev, newCat]);

        await addCustomCategory(user.uid, name, type);
    };

    return { categories, loadingCategories, addNewCategory };
}