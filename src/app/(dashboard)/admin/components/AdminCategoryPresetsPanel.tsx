"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, Pencil, Plus, Tags, Trash2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CATEGORY_PRESET_COLOR_OPTIONS,
  CATEGORY_PRESET_SCOPES,
  DEFAULT_CATEGORY_PRESETS_CONFIG,
  normalizeCategoryPresetsConfig,
  type CategoryPresetsConfig,
  type CategoryPresetScope,
  type DefaultCategoryType,
} from "@/lib/categories/defaultCategories";
import { useGetCategoryPresetsQuery, useUpdateCategoryPresetsMutation } from "@/store/api/systemApi";

const SCOPE_LABELS: Record<CategoryPresetScope, string> = {
  personal: "Pessoal · Free, Premium, Pro e Foundation",
  family: "Família",
  business: "Business · padrão geral",
  business_self_employed: "Business · Autônomo/MEI",
  business_company: "Business · Empresa",
  business_services: "Business · Prestação de serviços",
  business_church: "Business · Igreja",
  business_nonprofit: "Business · Associação/ONG",
  business_project: "Business · Projeto",
  business_other: "Business · Outro segmento",
};

const TYPE_LABELS: Record<DefaultCategoryType, string> = {
  income: "Receita",
  expense: "Despesa",
  both: "Receita e despesa",
};

type EditorState = { index: number; name: string; type: DefaultCategoryType; color: string };

function cloneConfig(config: CategoryPresetsConfig) {
  return normalizeCategoryPresetsConfig(structuredClone(config));
}

function categoryKey(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function AdminCategoryPresetsPanel({ userId, canWrite }: { userId: string; canWrite: boolean }) {
  const { data, isLoading, isError, refetch } = useGetCategoryPresetsQuery({ userId }, { skip: !userId });
  const [updateCategoryPresets, updateState] = useUpdateCategoryPresetsMutation();
  const [localConfig, setLocalConfig] = useState<CategoryPresetsConfig | null>(null);
  const [scope, setScope] = useState<CategoryPresetScope>("personal");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DefaultCategoryType>("expense");
  const [newColor, setNewColor] = useState<string>(CATEGORY_PRESET_COLOR_OPTIONS[2].value);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const config = localConfig ?? data ?? DEFAULT_CATEGORY_PRESETS_CONFIG;
  const changeScope = (value: CategoryPresetScope) => {
    setScope(value);
    setEditor(null);
    setDeleteIndex(null);
    setFeedback(null);
  };

  const categories = config[scope];
  const selectedScopeDescription = useMemo(() => {
    if (scope === "personal") return "Usado nos perfis pessoais, independentemente do nível do plano.";
    if (scope === "family") return "Usado somente no perfil compartilhado do plano Família.";
    if (scope === "business") return "Fallback usado quando o segmento da organização ainda não foi definido.";
    return "Usado no perfil Business quando a organização escolhe este segmento.";
  }, [scope]);

  const persist = async (next: CategoryPresetsConfig, successMessage: string) => {
    if (!canWrite || updateState.isLoading) return false;
    setFeedback(null);
    try {
      const saved = await updateCategoryPresets({ userId, categoryPresets: next }).unwrap();
      setLocalConfig(cloneConfig(saved));
      setFeedback({ type: "success", message: successMessage });
      return true;
    } catch {
      setFeedback({ type: "error", message: "Não foi possível salvar as categorias padrão. Tente novamente." });
      return false;
    }
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) return setFeedback({ type: "error", message: "Informe o nome da categoria." });
    if (categories.some((category) => categoryKey(category.name) === categoryKey(name))) {
      return setFeedback({ type: "error", message: "Já existe uma categoria com esse nome neste perfil." });
    }
    const next = cloneConfig(config);
    next[scope] = [...next[scope].filter((category) => categoryKey(category.name) !== "outros"), {
      name,
      type: newType,
      color: newColor,
    }, next[scope].find((category) => categoryKey(category.name) === "outros")!];
    if (await persist(next, `Categoria “${name}” adicionada.`)) setNewName("");
  };

  const saveEdit = async () => {
    if (!editor) return;
    const name = editor.name.trim();
    const current = categories[editor.index];
    if (!current || !name) return setFeedback({ type: "error", message: "Informe um nome válido." });
    if (categoryKey(current.name) === "outros") return;
    if (categories.some((category, index) => index !== editor.index && categoryKey(category.name) === categoryKey(name))) {
      return setFeedback({ type: "error", message: "Já existe uma categoria com esse nome neste perfil." });
    }
    const aliases = categoryKey(current.name) === categoryKey(name)
      ? current.aliases
      : Array.from(new Set([...(current.aliases ?? []), current.name]));
    const next = cloneConfig(config);
    next[scope][editor.index] = { name, type: editor.type, color: editor.color, aliases };
    if (await persist(next, `Categoria “${name}” atualizada.`)) setEditor(null);
  };

  const confirmDelete = async () => {
    if (deleteIndex == null) return;
    const category = categories[deleteIndex];
    if (!category || categoryKey(category.name) === "outros") return setDeleteIndex(null);
    const next = cloneConfig(config);
    next[scope] = next[scope].filter((_, index) => index !== deleteIndex);
    if (await persist(next, `Categoria “${category.name}” removida das opções futuras.`)) setDeleteIndex(null);
  };

  return (
    <Card className="app-panel-soft overflow-hidden rounded-3xl border border-primary/20 shadow-lg">
      <CardHeader className="border-b border-border/70 bg-primary/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <Tags className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <CardTitle className="text-lg">Categorias padrão</CardTitle>
              <CardDescription className="mt-1 max-w-3xl leading-relaxed">
                Defina as opções iniciais por tipo de perfil. Categorias criadas pelos clientes continuam privadas em cada workspace.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="w-fit rounded-full border-primary/30 bg-primary/8 px-3 py-1 text-primary">
            Configuração global
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-5 sm:p-6">
        <div className="grid gap-4 rounded-2xl border border-border/70 bg-background/45 p-4 lg:grid-cols-[minmax(260px,0.8fr)_1.2fr] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="category-preset-scope">Perfil de aplicação</Label>
            <Select value={scope} onValueChange={(value) => changeScope(value as CategoryPresetScope)}>
              <SelectTrigger id="category-preset-scope" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_PRESET_SCOPES.map((item) => <SelectItem key={item} value={item}>{SCOPE_LABELS[item]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {selectedScopeDescription} Alterações não modificam lançamentos históricos.
          </p>
        </div>

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias...</div>
        ) : isError ? (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-500">
            Não foi possível carregar a configuração. <Button type="button" variant="link" className="h-auto p-0 text-red-500 underline" onClick={() => void refetch()}>Tentar novamente</Button>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-background/35">
              <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-sm font-semibold text-foreground">Categorias deste perfil</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">A cor é usada apenas para identificar a categoria nos lançamentos e gráficos.</p>
                </div>
                <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-xs">{categories.length}</Badge>
              </div>

              <div className="hidden grid-cols-[minmax(180px,1.4fr)_minmax(130px,0.8fr)_minmax(100px,0.6fr)_88px] gap-4 border-b border-border/60 bg-muted/20 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground md:grid">
                <span>Categoria</span><span>Tipo</span><span>Cor</span><span className="text-right">Ações</span>
              </div>

              <div className="divide-y divide-border/60">
                {categories.map((category, index) => {
                  const required = categoryKey(category.name) === "outros";
                  const isEditing = editor?.index === index;
                  const colorLabel = CATEGORY_PRESET_COLOR_OPTIONS.find((option) => option.value === category.color)?.label ?? "Neutro";
                  return (
                    <div key={`${category.name}-${index}`} className="px-4 py-3 transition-colors hover:bg-muted/20 sm:px-5">
                      {isEditing ? (
                        <div className="grid gap-3 md:grid-cols-[minmax(180px,1.4fr)_minmax(130px,0.8fr)_minmax(100px,0.6fr)_auto] md:items-center">
                          <div className="space-y-1.5"><Label className="text-xs md:sr-only">Categoria</Label><Input aria-label="Nome da categoria" className="h-10 rounded-xl" value={editor.name} onChange={(event) => setEditor({ ...editor, name: event.target.value })} maxLength={60} /></div>
                          <div className="space-y-1.5"><Label className="text-xs md:sr-only">Tipo</Label><Select value={editor.type} onValueChange={(value) => setEditor({ ...editor, type: value as DefaultCategoryType })}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-1.5"><Label className="text-xs md:sr-only">Cor</Label><Select value={editor.color} onValueChange={(value) => setEditor({ ...editor, color: value })}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_PRESET_COLOR_OPTIONS.map((option) => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                          <div className="flex justify-end gap-1">
                            <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-lg" aria-label="Cancelar edição" onClick={() => setEditor(null)}><X className="h-4 w-4" /></Button>
                            <Button type="button" size="icon" className="h-9 w-9 rounded-lg" aria-label="Salvar categoria" disabled={updateState.isLoading} onClick={() => void saveEdit()}>{updateState.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-[minmax(180px,1.4fr)_minmax(130px,0.8fr)_minmax(100px,0.6fr)_88px] md:items-center md:gap-4">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{category.name}</p>
                            {required ? <Badge variant="outline" className="rounded-full text-[10px] text-muted-foreground">Obrigatória</Badge> : null}
                          </div>
                          <p className="text-xs text-muted-foreground md:text-sm">{TYPE_LABELS[category.type]}</p>
                          <p className="text-xs text-muted-foreground md:text-sm">{colorLabel}</p>
                          {!required && canWrite ? (
                            <div className="flex justify-end gap-1">
                              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg" aria-label={`Editar ${category.name}`} onClick={() => setEditor({ index, name: category.name, type: category.type, color: category.color })}><Pencil className="h-3.5 w-3.5" /></Button>
                              <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-500/10 hover:text-red-500" aria-label={`Excluir ${category.name}`} onClick={() => setDeleteIndex(index)}><Trash2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          ) : <span />}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {canWrite ? (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.025] p-4">
                <div className="mb-3">
                  <p className="font-semibold text-foreground">Adicionar categoria padrão</p>
                  <p className="text-xs text-muted-foreground">Ela ficará disponível para todos os workspaces que usam o perfil selecionado.</p>
                </div>
                <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto] md:items-end">
                  <div className="space-y-2"><Label htmlFor="new-default-category">Nome</Label><Input id="new-default-category" className="h-10 rounded-xl" value={newName} onChange={(event) => setNewName(event.target.value)} maxLength={60} placeholder="Ex.: Educação" /></div>
                  <div className="space-y-2"><Label>Tipo</Label><Select value={newType} onValueChange={(value) => setNewType(value as DefaultCategoryType)}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Cor</Label><Select value={newColor} onValueChange={setNewColor}><SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{CATEGORY_PRESET_COLOR_OPTIONS.map((option) => <SelectItem key={option.id} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
                  <Button type="button" className="h-10 rounded-xl" disabled={updateState.isLoading} onClick={() => void addCategory()}>{updateState.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />} Adicionar</Button>
                </div>
              </div>
            ) : null}
          </>
        )}

        {feedback ? (
          <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${feedback.type === "success" ? "border-emerald-500/25 bg-emerald-500/8 text-emerald-600" : "border-red-500/25 bg-red-500/8 text-red-500"}`}>
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <X className="h-4 w-4 shrink-0" />}{feedback.message}
          </div>
        ) : null}
      </CardContent>

      <Dialog open={deleteIndex != null} onOpenChange={(open) => { if (!open) setDeleteIndex(null); }}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Remover categoria padrão?</DialogTitle>
            <DialogDescription>
              Ela deixará de aparecer como opção futura em {SCOPE_LABELS[scope]}. Lançamentos já registrados não serão alterados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => setDeleteIndex(null)}>Cancelar</Button>
            <Button type="button" variant="destructive" className="rounded-xl" disabled={updateState.isLoading} onClick={() => void confirmDelete()}>{updateState.isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />} Remover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
