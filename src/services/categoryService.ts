import { addDoc, deleteDoc, doc, getDocs, query, where } from "firebase/firestore";
import { categoriesCol } from "./firebase/collections";

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
