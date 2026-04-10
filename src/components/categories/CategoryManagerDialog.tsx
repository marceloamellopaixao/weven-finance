"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Plus, EyeOff, Eye, FolderTree, Tag, Check, X, FolderOpen } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORY_PATH_SEPARATOR, Category, CategoryType } from "@/hooks/useCategories";
import {
  formatCategoryLabel,
  getCategoryRoot,
  getSubcategoryName,
  isLinkedSubcategory,
  isOthersCategory,
  isSubcategory,
  orderCategoryNames,
} from "@/lib/category-utils";

type CategoryManagerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: CategoryType;
  selectedCategory?: string;
  onSelectCategory?: (category: string) => void;
  categories: Category[];
  defaultCategories: Array<Category & { hidden?: boolean }>;
  addNewCategory: (name: string, type: CategoryType, parentName?: string) => Promise<void>;
  deleteCategory: (name: string) => Promise<void>;
  renameCategory: (oldName: string, newName: string) => Promise<void>;
  toggleDefaultCategoryVisibility: (name: string, hidden: boolean) => Promise<void>;
};

export function CategoryManagerDialog({
  open,
  onOpenChange,
  type,
  selectedCategory,
  onSelectCategory,
  categories,
  defaultCategories,
  addNewCategory,
  deleteCategory,
  renameCategory,
  toggleDefaultCategoryVisibility,
}: CategoryManagerDialogProps) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryMode, setNewCategoryMode] = useState<"root" | "sub">("root");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editingCategoryInput, setEditingCategoryInput] = useState("");
  const [editingCategoryParent, setEditingCategoryParent] = useState("");
  const [renamingCategoryName, setRenamingCategoryName] = useState<string | null>(null);
  const [customParentFilter, setCustomParentFilter] = useState("all");

  const compatibleCategories = useMemo(() => {
    const filtered = categories.filter((cat) => cat.type === type || cat.type === "both");
    const byName = new Map(filtered.map((cat) => [cat.name, cat]));
    return orderCategoryNames(filtered.map((cat) => cat.name))
      .map((name) => byName.get(name))
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));
  }, [categories, type]);

  const compatibleDefaultCategories = useMemo(
    () => defaultCategories.filter((cat) => cat.type === type || cat.type === "both"),
    [defaultCategories, type]
  );

  const allRootCategories = useMemo(() => {
    return compatibleCategories
      .filter((cat) => !isSubcategory(cat.name))
      .sort((a, b) => {
        if (isOthersCategory(a.name)) return 1;
        if (isOthersCategory(b.name)) return -1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [compatibleCategories]);

  const customCategories = useMemo(
    () => compatibleCategories.filter((cat) => cat.isCustom),
    [compatibleCategories]
  );

  const filteredCustomCategories = useMemo(() => {
    if (customParentFilter === "all") return customCategories;
    return customCategories.filter((cat) => {
      if (!isSubcategory(cat.name)) return cat.name === customParentFilter;
      return getCategoryRoot(cat.name) === customParentFilter;
    });
  }, [customCategories, customParentFilter]);

  const resetForm = () => {
    setNewCategoryName("");
    setNewCategoryMode("root");
    setNewCategoryParent("");
    setDeletingCategoryName(null);
    setEditingCategoryName(null);
    setEditingCategoryInput("");
    setEditingCategoryParent("");
    setRenamingCategoryName(null);
    setCustomParentFilter("all");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm();
    onOpenChange(nextOpen);
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    if (newCategoryMode === "sub" && !newCategoryParent) return;

    const categoryName = newCategoryName.trim();
    const parentName = newCategoryMode === "sub" ? newCategoryParent : undefined;
    const fullCategoryName = parentName
      ? `${parentName}${CATEGORY_PATH_SEPARATOR}${categoryName}`
      : categoryName;

    try {
      await addNewCategory(categoryName, type, parentName);
      onSelectCategory?.(fullCategoryName);
      setNewCategoryName("");
      if (newCategoryMode === "root") {
        setCustomParentFilter("all");
      } else if (parentName) {
        setCustomParentFilter(parentName);
      }
      toast.success("Categoria adicionada com sucesso.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao criar categoria.";
      if (message === "duplicate_category_name") {
        toast.error("Essa categoria ja existe.");
        return;
      }
      toast.error("Nao foi possivel criar a categoria.");
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    setDeletingCategoryName(categoryName);
    try {
      await deleteCategory(categoryName);
      if (
        selectedCategory &&
        (selectedCategory === categoryName || selectedCategory.startsWith(`${categoryName}${CATEGORY_PATH_SEPARATOR}`))
      ) {
        onSelectCategory?.("Outros");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao excluir categoria.";
      if (message === "duplicate_category_name") {
        toast.error("Ja existe uma categoria com esse nome.");
        return;
      }
      toast.error("Nao foi possivel excluir a categoria.");
    } finally {
      setDeletingCategoryName(null);
    }
  };

  const handleStartEditCategory = (categoryName: string) => {
    setEditingCategoryName(categoryName);
    setEditingCategoryInput(getSubcategoryName(categoryName));
    setEditingCategoryParent(
      isSubcategory(categoryName)
        ? (isLinkedSubcategory(categoryName) ? getCategoryRoot(categoryName) : "Outros")
        : ""
    );
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryName(null);
    setEditingCategoryInput("");
    setEditingCategoryParent("");
  };

  const handleSaveEditCategory = async (targetName: string) => {
    if (!editingCategoryInput.trim()) return;

    const isTargetSub = isSubcategory(targetName);
    const nextName = isTargetSub
      ? (editingCategoryParent
        ? `${editingCategoryParent}${CATEGORY_PATH_SEPARATOR}${editingCategoryInput.trim()}`
        : editingCategoryInput.trim())
      : editingCategoryInput.trim();

    if (nextName === targetName) {
      handleCancelEditCategory();
      return;
    }

    setRenamingCategoryName(targetName);
    try {
      await renameCategory(targetName, nextName);

      if (
        selectedCategory &&
        (selectedCategory === targetName || selectedCategory.startsWith(`${targetName}${CATEGORY_PATH_SEPARATOR}`))
      ) {
        const suffix = selectedCategory.slice(targetName.length);
        onSelectCategory?.(`${nextName}${suffix}`);
      }

      handleCancelEditCategory();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao editar categoria.";
      if (message === "duplicate_category_name") {
        toast.error("Ja existe uma categoria com esse nome.");
        return;
      }
      toast.error("Nao foi possivel salvar a categoria.");
    } finally {
      setRenamingCategoryName(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* Removemos o p-0 e max-h para controlar o scroll internamente de forma mais limpa */}
      <DialogContent className="rounded-3xl w-[calc(100vw-1rem)] max-w-2xl p-0 overflow-hidden bg-white dark:bg-zinc-950 border-none shadow-2xl">
        <DialogHeader className="app-panel-subtle border-b px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <FolderTree className="h-5 w-5 text-violet-600" />
            Gerenciar Categorias
          </DialogTitle>
          <DialogDescription>
            Organize suas categorias para manter seus relatórios precisos.
          </DialogDescription>
        </DialogHeader>

        {/* Container de Scroll Principal */}
        <div className="px-6 py-4 max-h-[75vh] overflow-y-auto space-y-8 custom-scrollbar pb-8">
          
          {/* SESSÃO 1: CRIAR NOVA */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <Plus className="h-4 w-4 text-violet-600" />
              Criar Nova Categoria
            </h3>
            <div className="app-panel-subtle space-y-4 rounded-2xl border p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-500">Nível da categoria</Label>
                  <Select value={newCategoryMode} onValueChange={(v) => setNewCategoryMode(v as "root" | "sub")}>
                    <SelectTrigger className="bg-white dark:bg-zinc-950 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root">Categoria Principal</SelectItem>
                      <SelectItem value="sub">Subcategoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newCategoryMode === "sub" && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-left-2">
                    <Label className="text-xs text-zinc-500">Pertence a qual principal?</Label>
                    <Select value={newCategoryParent} onValueChange={setNewCategoryParent}>
                      <SelectTrigger className="bg-white dark:bg-zinc-950 rounded-xl">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allRootCategories.map((cat) => (
                          <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-500">
                  {newCategoryMode === "sub" ? "Nome da Subcategoria" : "Nome da Categoria"}
                </Label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    placeholder={newCategoryMode === "sub" ? "Ex: Reforma" : "Ex: Casa"}
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    className="bg-white dark:bg-zinc-950 rounded-xl flex-1"
                  />
                  <Button 
                    onClick={handleCreateCategory} 
                    disabled={!newCategoryName.trim() || (newCategoryMode === "sub" && !newCategoryParent)} 
                    className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0 shadow-sm"
                  >
                    Adicionar Categoria
                  </Button>
                </div>
              </div>
            </div>
          </section>

          {/* SESSÃO 2: PERSONALIZADAS (Movemos para cima pois é o que o usuário mais interage) */}
          <section className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
                <Tag className="h-4 w-4 text-violet-600" />
                Suas Categorias
              </h3>
              <Select value={customParentFilter} onValueChange={setCustomParentFilter}>
                <SelectTrigger className="h-8 w-40 text-xs rounded-lg border-zinc-200 bg-transparent">
                  <SelectValue placeholder="Filtrar pai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas principais</SelectItem>
                  {allRootCategories.map((root) => (
                    <SelectItem key={`filter-${root.name}`} value={root.name}>{root.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
              {filteredCustomCategories.length === 0 ? (
                <div className="p-8 text-center text-zinc-500 text-sm flex flex-col items-center">
                  <FolderOpen className="h-8 w-8 text-zinc-300 mb-2" />
                  Nenhuma categoria personalizada encontrada.
                </div>
              ) : (
                filteredCustomCategories.map((cat) => {
                  const sub = isSubcategory(cat.name);
                  const linked = isLinkedSubcategory(cat.name);
                  const isEditing = editingCategoryName === cat.name;

                  return (
                    <div key={cat.name} className={`group p-3 transition-colors ${isEditing ? 'app-panel-subtle' : 'hover:bg-accent/70'}`}>
                      {isEditing ? (
                        // MODO EDIÇÃO INLINE
                        <div className="flex flex-col sm:flex-row gap-2 animate-in fade-in zoom-in-95 duration-200">
                          {sub && (
                            <Select value={editingCategoryParent} onValueChange={setEditingCategoryParent}>
                              <SelectTrigger className="h-9 sm:w-40 bg-white dark:bg-zinc-950">
                                <SelectValue placeholder="Pai" />
                              </SelectTrigger>
                              <SelectContent>
                                {allRootCategories.map((root) => (
                                  <SelectItem key={root.name} value={root.name}>{root.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Input 
                            value={editingCategoryInput} 
                            onChange={(e) => setEditingCategoryInput(e.target.value)} 
                            className="h-9 flex-1 bg-white dark:bg-zinc-950" 
                            autoFocus
                          />
                          <div className="flex items-center gap-1 shrink-0 justify-end">
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200" onClick={handleCancelEditCategory}>
                              <X className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              className="h-9 w-9 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border border-emerald-200" 
                              disabled={renamingCategoryName === cat.name || (sub && !editingCategoryParent)} 
                              onClick={() => handleSaveEditCategory(cat.name)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        // MODO VISUALIZAÇÃO
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                {formatCategoryLabel(cat.name)}
                              </p>
                              {sub && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-zinc-500 font-normal">
                                  Subcategoria
                                </Badge>
                              )}
                            </div>
                            {sub && !linked && (
                              <p className="text-[11px] text-amber-600 font-medium mt-0.5">⚠️ Sem pai vinculado</p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-zinc-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20" 
                              onClick={() => handleStartEditCategory(cat.name)}
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" 
                              disabled={deletingCategoryName === cat.name} 
                              onClick={() => handleDeleteCategory(cat.name)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* SESSÃO 3: PADRÃO DO SISTEMA */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-1.5 text-zinc-800 dark:text-zinc-200">
              <FolderTree className="h-4 w-4 text-zinc-400" />
              Categorias do Sistema
            </h3>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
              {compatibleDefaultCategories
                .slice()
                .sort((a, b) => {
                  if (a.name === "Outros") return 1;
                  if (b.name === "Outros") return -1;
                  return a.name.localeCompare(b.name, "pt-BR");
                })
                .map((cat) => {
                  const hidden = cat.name !== "Outros" && !compatibleCategories.some((item) => item.name === cat.name);
                  const isOthers = cat.name === "Outros";

                  return (
                    <div key={`default-${cat.name}`} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${hidden ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-violet-100 dark:bg-violet-900/30'}`}>
                          {hidden ? <EyeOff className="h-4 w-4 text-zinc-400" /> : <Eye className="h-4 w-4 text-violet-600" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium truncate ${hidden ? 'text-zinc-500' : 'text-zinc-900 dark:text-zinc-100'}`}>
                            {cat.name}
                          </p>
                          {hidden && <p className="text-[11px] text-zinc-400">Oculta nas listagens</p>}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant={hidden ? "default" : "ghost"}
                        size="sm"
                        className={`h-8 rounded-lg text-xs font-medium ${
                          isOthers
                            ? "text-zinc-400 bg-transparent hover:bg-transparent cursor-not-allowed"
                            : hidden
                              ? "bg-zinc-800 hover:bg-zinc-900 text-white dark:bg-zinc-200 dark:text-zinc-900"
                              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                        }`}
                        disabled={isOthers}
                        onClick={() => toggleDefaultCategoryVisibility(cat.name, !hidden)}
                      >
                        {isOthers ? "Obrigatória" : hidden ? "Mostrar" : "Ocultar"}
                      </Button>
                    </div>
                  );
                })}
            </div>
          </section>

        </div>
      </DialogContent>
    </Dialog>
  );
}
