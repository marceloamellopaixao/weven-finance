"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Save, Trash2, Calendar, CreditCard, 
  Tag, AlignLeft, Info, ReceiptText, AlertCircle, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryManagerDialog } from "@/components/categories/CategoryManagerDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { PaymentMethod, Transaction } from "@/types/transaction";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { deleteTransaction, updateTransaction } from "@/services/transactionService";
import { formatCategoryLabel, orderCategoryNames } from "@/lib/category-utils";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: true },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { transactions, loading: loadingTransactions } = useTransactions();
  const {
    categories,
    defaultCategories,
    loadingCategories,
    addNewCategory,
    deleteCategory,
    renameCategory,
    toggleDefaultCategoryVisibility,
  } = useCategories();

  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [error, setError] = useState("");
  const [resolvedTransaction, setResolvedTransaction] = useState(false);

  const txId = String(params?.id || "");

  useEffect(() => {
    if (!user) return;
    return subscribeToPaymentCards(user.uid, setPaymentCards, () => setPaymentCards([]));
  }, [user]);

  useEffect(() => {
    if (!txId) {
      setEditingTx(null);
      setResolvedTransaction(true);
      return;
    }
    if (loadingTransactions) return;

    const found = transactions.find((t) => t.id === txId) || null;
    setEditingTx(found ? { ...found } : null);
    setResolvedTransaction(true);
  }, [transactions, txId, loadingTransactions]);

  const groupedItems = useMemo(() => {
    if (!editingTx?.groupId) return [];
    return transactions
      .filter((t) => t.groupId === editingTx.groupId)
      .sort((a, b) => Number(a.installmentCurrent || 0) - Number(b.installmentCurrent || 0));
  }, [transactions, editingTx?.groupId]);

  const monthCategories = useMemo(() => {
    if (!editingTx) return [];
    const filtered = categories.filter((c) => c.type === editingTx.type || c.type === "both");
    const byName = new Map(filtered.map((cat) => [cat.name, cat]));
    return orderCategoryNames(filtered.map((cat) => cat.name))
      .map((name) => byName.get(name))
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));
  }, [categories, editingTx]);

  useEffect(() => {
    if (!editingTx?.category) return;
    if (loadingCategories) return;
    if (monthCategories.some((item) => item.name === editingTx.category)) return;
    setEditingTx((prev) => (prev ? { ...prev, category: "" } : prev));
  }, [editingTx?.category, loadingCategories, monthCategories]);

  const showDueDate = useMemo(() => {
    if (!editingTx) return false;
    const method = PAYMENT_METHODS.find((m) => m.value === editingTx.paymentMethod);
    return Boolean(method?.hasDueDate);
  }, [editingTx]);

  const save = async (updateGroup: boolean) => {
    if (!user || !editingTx?.id) return;
    setError("");
    setSaving(true);
    try {
      await updateTransaction(
        user.uid,
        editingTx.id,
        {
          description: editingTx.description,
          amount: Number(editingTx.amount || 0),
          category: editingTx.category,
          paymentMethod: editingTx.paymentMethod,
          cardId: editingTx.cardId,
          cardLabel: editingTx.cardLabel,
          cardType: editingTx.cardType,
          date: editingTx.date,
          dueDate: editingTx.dueDate,
        },
        updateGroup
      );
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (deleteGroup: boolean) => {
    if (!user || !editingTx?.id) return;
    setDeleting(true);
    setError("");
    try {
      await deleteTransaction(user.uid, editingTx.id, deleteGroup);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  // ESTADO: CARREGANDO
  if (loadingTransactions || !resolvedTransaction) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 flex justify-center items-center pt-32">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-zinc-200 border-t-violet-600 animate-spin" />
          <p className="text-sm text-zinc-500 font-medium">Buscando detalhes da transação</p>
        </div>
      </div>
    );
  }

  // ESTADO: NÃO ENCONTRADO
  if (!editingTx) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 flex justify-center items-center">
        <div className="mx-auto max-w-full text-center  space-y-2">
          <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Lançamento não encontrado</h2>
          <p className="text-zinc-500">Este registro pode ter sido excluído ou você não tem permissão para acessá-lo.</p>
          <Button variant="default" className="rounded-xl mt-4 bg-zinc-900 hover:bg-zinc-800 text-white" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const isIncome = editingTx.type === "income";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4 md:p-8 pb-32 font-sans">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-zinc-200/50" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5 text-zinc-700 dark:text-zinc-300" />
            </Button>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Editar Lançamento
            </h1>
          </div>
          <Badge variant="secondary" className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border-none ${isIncome ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {isIncome ? "Receita" : "Despesa"}
          </Badge>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* MAIN CONTAINER */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-4xl shadow-sm overflow-hidden mb-6">
          
          {/* HERO: VALOR */}
          <div className={`p-8 pb-6 border-b border-zinc-100 dark:border-zinc-800/50 ${isIncome ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
            <Label className="text-zinc-500 font-medium text-sm flex justify-start mb-2">Valor da transação</Label>
            <div className="flex items-center justify-center gap-2">
              <span className={`text-3xl font-bold ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>R$</span>
              <Input 
                type="number" 
                value={editingTx.amount} 
                onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value || 0) })} 
                className={`w-full max-w-full h-auto p-0 border-none shadow-none text-4xl md:text-5xl font-bold bg-transparent focus-visible:ring-0 text-start ${isIncome ? 'text-emerald-500 placeholder:text-emerald-500' : 'text-red-500 placeholder:text-red-500'}`}
              />
            </div>
          </div>

          {/* FORMULÁRIO (GRID) */}
          <div className="p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                <AlignLeft className="h-4 w-4 text-zinc-400" /> Descrição
              </Label>
              <Input 
                value={editingTx.description} 
                onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} 
                className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-violet-500 text-base"
                placeholder="Ex: Supermercado"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CATEGORIA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4 text-zinc-400" /> Categoria
                  </Label>
                  <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Gerenciar
                  </button>
                </div>
                <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {monthCategories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        {formatCategoryLabel(cat.name)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DATA */}
              <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-zinc-400" /> Data da Compra
                </Label>
                <Input 
                  type="date" 
                  value={editingTx.date} 
                  onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} 
                  className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                />
              </div>

              {/* MÉTODO DE PAGAMENTO */}
              <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                  <CreditCard className="h-4 w-4 text-zinc-400" /> Pagamento
                </Label>
                <Select
                  value={editingTx.paymentMethod}
                  onValueChange={(v) => setEditingTx({ ...editingTx, paymentMethod: v as PaymentMethod })}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* DATA DE VENCIMENTO (Condicional) */}
              {showDueDate && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-zinc-400" /> Vencimento
                  </Label>
                  <Input 
                    type="date" 
                    value={editingTx.dueDate} 
                    onChange={(e) => setEditingTx({ ...editingTx, dueDate: e.target.value })} 
                    className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              )}

              {/* CARTÃO VINCULADO (Condicional) */}
              {(editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card") && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in zoom-in-95">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm">
                    <ReceiptText className="h-4 w-4 text-zinc-400" /> Cartão Vinculado
                  </Label>
                  <Select
                    value={editingTx.cardId || ""}
                    onValueChange={(id) => {
                      const card = paymentCards.find((c) => c.id === id);
                      if (!card) return;
                      setEditingTx({
                        ...editingTx,
                        cardId: card.id,
                        cardLabel: `${card.bankName} •••• ${card.last4}`,
                        cardType: editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card" ? editingTx.paymentMethod : undefined,
                      });
                    }}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800">
                      <SelectValue placeholder="Selecione um cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentCards.length === 0 ? (
                        <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
                      ) : (
                        paymentCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>{card.bankName} •••• {card.last4}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* PARCELAMENTO (Se houver) */}
        {groupedItems.length > 0 && (
          <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/30 rounded-3xl p-5 md:p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Info className="h-6 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">Visão do Parcelamento</h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
              {groupedItems.map((item) => {
                const isCurrent = item.id === editingTx.id;
                return (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl text-sm transition-colors ${isCurrent ? "bg-white dark:bg-zinc-900 shadow-sm border border-blue-200 ring-1 ring-blue-500" : "hover:bg-blue-100/50"}`}>
                    <div className="flex items-center gap-3">
                      <span className={`font-mono font-medium ${isCurrent ? 'text-blue-700' : 'text-zinc-500'}`}>
                        {String(item.installmentCurrent).padStart(2, '0')}/{String(item.installmentTotal).padStart(2, '0')}
                      </span>
                      <span className={isCurrent ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-600'}>
                        {item.dueDate || item.date}
                      </span>
                    </div>
                    <span className={`font-medium ${isCurrent ? 'text-blue-700' : 'text-zinc-600'}`}>
                      {formatCurrency(Number(item.amount || 0))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="space-y-4 pt-2">
          {!editingTx.groupId ? (
            <Button onClick={() => save(false)} disabled={saving} className="w-full h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white text-base shadow-sm">
              <Save className="mr-2 h-5 w-5" /> {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => save(false)} disabled={saving} className="h-14 rounded-2xl border-zinc-200 text-zinc-700 hover:bg-zinc-50">
                Salvar Apenas Esta
              </Button>
              <Button onClick={() => save(true)} disabled={saving} className="h-14 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                Salvar Todas as Parcelas
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
            {!editingTx.groupId ? (
              <Button variant="outline" onClick={() => remove(false)} disabled={deleting} className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors">
                <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Excluindo..." : "Excluir Lançamento"}
              </Button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => remove(false)} disabled={deleting} className="h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                  Excluir Apenas Esta
                </Button>
                <Button variant="outline" onClick={() => remove(true)} disabled={deleting} className="h-12 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                  Excluir Todas
                </Button>
              </div>
            )}
          </div>
        </div>

      </div>

      <CategoryManagerDialog
        open={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
        type={editingTx.type}
        selectedCategory={editingTx.category}
        onSelectCategory={(category) => setEditingTx({ ...editingTx, category })}
        categories={categories}
        defaultCategories={defaultCategories}
        addNewCategory={addNewCategory}
        deleteCategory={deleteCategory}
        renameCategory={renameCategory}
        toggleDefaultCategoryVisibility={toggleDefaultCategoryVisibility}
      />
    </div>
  );
}
