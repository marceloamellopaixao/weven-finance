import { addDoc, deleteDoc, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from "firebase/firestore";
import { categoriesCol, transactionsCol, userDoc } from "./firebase/collections";
import { db } from "./firebase/client";

export interface CustomCategory {
    id?: string;
    name: string;
    type: "income" | "expense" | "both";
    color: string;
    userId: string;
}

export const addCustomCategory = async (uid: string, name: string, type: "income" | "expense" | "both"): Promise<void> => {
    try {
        // Verifica se já existe para evitar duplicatas (considerando o mesmo nome para o mesmo usuário)
        const q = query(categoriesCol(uid), where("name", "==", name));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            throw new Error("Já existe uma categoria com esse nome.");
        }

        await addDoc(categoriesCol(uid), {
            name,
            type,
            color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50",
            userId: uid
        })
    } catch (error) {
        console.error("Erro ao adicionar categoria personalizada:", error);
        throw error;
    }
};

export const getCustomCategories = async (uid: string): Promise<CustomCategory[]> => {
    try {
        const q = await getDocs(categoriesCol(uid));
        return q.docs.map(doc => ({ id: doc.id, ...doc.data() } as CustomCategory));
    } catch (error) {
        console.error("Erro ao obter categorias personalizadas:", error);
        return [];
    }
}

export const deleteCustomCategory = async (uid: string, categoryId: string) => {
    try {
        await deleteDoc(doc(categoriesCol(uid), categoryId));
    } catch (error) {
        console.error("Erro ao deletar categoria personalizada:", error);
        throw error;
    }
}

const categoriesSettingsDoc = (uid: string) => doc(userDoc(uid), "settings", "categories");

export const deleteCustomCategoryByName = async (
    uid: string,
    categoryName: string,
    fallbackCategory: string = "Outros"
) => {
    try {
        const allCustomCategoriesSnapshot = await getDocs(categoriesCol(uid));

        const affectedCategoryNames = allCustomCategoriesSnapshot.docs
            .map((docSnap) => ({
                id: docSnap.id,
                name: String(docSnap.data().name || ""),
            }))
            .filter((item) => item.name === categoryName || item.name.startsWith(`${categoryName}::`));

        const batch = writeBatch(db);
        let hasWrites = false;

        affectedCategoryNames.forEach((item) => {
            batch.delete(doc(categoriesCol(uid), item.id));
            hasWrites = true;
        });

        const txSnapshots = await Promise.all(
            affectedCategoryNames.map((item) =>
                getDocs(query(transactionsCol(uid), where("category", "==", item.name)))
            )
        );

        txSnapshots.forEach((txSnapshot) => {
            txSnapshot.docs.forEach((docSnap) => {
                batch.update(docSnap.ref, { category: fallbackCategory });
                hasWrites = true;
            });
        });

        if (hasWrites) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Erro ao deletar categoria personalizada e reclassificar transações:", error);
        throw error;
    }
};

export const renameCustomCategoryByName = async (
    uid: string,
    oldName: string,
    newName: string
) => {
    try {
        const trimmedNewName = newName.trim();
        if (!trimmedNewName) {
            throw new Error("Nome da categoria não pode ser vazio.");
        }

        const allCustomCategoriesSnapshot = await getDocs(categoriesCol(uid));
        const allCustomCategories = allCustomCategoriesSnapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            name: String(docSnap.data().name || ""),
        }));

        const affected = allCustomCategories.filter(
            (item) => item.name === oldName || item.name.startsWith(`${oldName}::`)
        );

        if (affected.length === 0) return;

        const renameMap = new Map<string, string>();
        affected.forEach((item) => {
            const suffix = item.name.slice(oldName.length);
            renameMap.set(item.name, `${trimmedNewName}${suffix}`);
        });

        const existingNames = new Set(
            allCustomCategories
                .filter((item) => !renameMap.has(item.name))
                .map((item) => item.name)
        );

        for (const newTargetName of renameMap.values()) {
            if (existingNames.has(newTargetName)) {
                throw new Error("Já existe uma categoria com esse nome.");
            }
        }

        const batch = writeBatch(db);
        let hasWrites = false;

        for (const item of affected) {
            const renamed = renameMap.get(item.name);
            if (!renamed || renamed === item.name) continue;
            batch.update(doc(categoriesCol(uid), item.id), { name: renamed });
            hasWrites = true;
        }

        const txSnapshots = await Promise.all(
            Array.from(renameMap.entries()).map(([currentName]) =>
                getDocs(query(transactionsCol(uid), where("category", "==", currentName)))
            )
        );

        Array.from(renameMap.entries()).forEach(([, renamedName], index) => {
            txSnapshots[index].docs.forEach((docSnap) => {
                batch.update(docSnap.ref, { category: renamedName });
                hasWrites = true;
            });
        });

        if (hasWrites) {
            await batch.commit();
        }
    } catch (error) {
        console.error("Erro ao renomear categoria personalizada:", error);
        throw error;
    }
};

export const getHiddenDefaultCategories = async (uid: string): Promise<string[]> => {
    try {
        const snap = await getDoc(categoriesSettingsDoc(uid));
        if (!snap.exists()) return [];
        const data = snap.data() as { hiddenDefaultCategories?: unknown };
        return Array.isArray(data.hiddenDefaultCategories)
            ? data.hiddenDefaultCategories.filter((item): item is string => typeof item === "string")
            : [];
    } catch (error) {
        console.error("Erro ao obter categorias padrão ocultas:", error);
        return [];
    }
};

export const setDefaultCategoryHidden = async (
    uid: string,
    categoryName: string,
    hidden: boolean
): Promise<void> => {
    try {
        const currentHidden = await getHiddenDefaultCategories(uid);
        const next = hidden
            ? Array.from(new Set([...currentHidden, categoryName]))
            : currentHidden.filter((name) => name !== categoryName);

        await setDoc(
            categoriesSettingsDoc(uid),
            { hiddenDefaultCategories: next },
            { merge: true }
        );
    } catch (error) {
        console.error("Erro ao atualizar visibilidade da categoria padrão:", error);
        throw error;
    }
};
