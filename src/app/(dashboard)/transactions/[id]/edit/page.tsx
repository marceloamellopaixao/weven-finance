"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { 
  ArrowLeft, Save, Trash2, Calendar, CreditCard, 
  Tag, AlignLeft, Info, ReceiptText, AlertCircle, Settings2, Repeat, Layers, Eye, EyeOff
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
import { getCreditCardDueDateFromSelectedCard, isCreditCapableCard } from "@/lib/credit-card/due-date";
import { formatCategoryLabel, orderCategoryNames } from "@/lib/category-utils";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: false },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user, privacyMode, togglePrivacyMode } = useAuth();
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
  const formatCurrencyDisplay = (value: number) => (privacyMode ? "R$ ******" : formatCurrency(value));

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

  const isCreditCardPayment = editingTx?.paymentMethod === "credit_card";
  const selectedCard = useMemo(
    () => paymentCards.find((card) => card.id === editingTx?.cardId),
    [editingTx?.cardId, paymentCards]
  );
  const availablePaymentCards = useMemo(() => {
    if (!editingTx) return [];
    return paymentCards.filter((card) => {
      if (editingTx.paymentMethod === "credit_card") return isCreditCapableCard(card);
      if (editingTx.paymentMethod === "debit_card") return card.type === "debit_card" || card.type === "credit_and_debit";
      return false;
    });
  }, [editingTx, paymentCards]);
  const creditCardDueDate = useMemo(
    () =>
      isCreditCardPayment && editingTx
        ? getCreditCardDueDateFromSelectedCard(selectedCard, editingTx.date)
        : null,
    [editingTx, isCreditCardPayment, selectedCard]
  );

  useEffect(() => {
    if (!editingTx) return;
    if (editingTx.paymentMethod !== "credit_card" && editingTx.paymentMethod !== "debit_card") return;
    if (!editingTx.cardId) return;
    if (paymentCards.length === 0) return;
    if (availablePaymentCards.some((card) => card.id === editingTx.cardId)) return;
    setEditingTx((prev) =>
      prev ? { ...prev, cardId: undefined, cardLabel: undefined, cardType: undefined } : prev
    );
  }, [availablePaymentCards, editingTx, paymentCards.length]);

  useEffect(() => {
    if (!editingTx || editingTx.paymentMethod !== "credit_card" || !creditCardDueDate) return;
    if (editingTx.dueDate === creditCardDueDate) return;
    setEditingTx((prev) => (prev ? { ...prev, dueDate: creditCardDueDate } : prev));
  }, [creditCardDueDate, editingTx]);

  const save = async (updateGroup: boolean) => {
    if (!user || !editingTx?.id) return;
    setError("");
    if (editingTx.paymentMethod === "credit_card" && !selectedCard) {
      setError("Selecione um cartão de crédito para definir o vencimento da fatura.");
      return;
    }
    if (editingTx.paymentMethod === "credit_card" && !creditCardDueDate) {
      setError("O cartão de crédito selecionado não tem vencimento de fatura configurado.");
      return;
    }
    setSaving(true);
    try {
      const finalDueDate = editingTx.paymentMethod === "credit_card" ? creditCardDueDate! : editingTx.dueDate;
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
          dueDate: finalDueDate,
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
      <div className="flex min-h-screen items-center justify-center bg-transparent p-4 pt-32 md:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          <p className="text-sm text-zinc-500 font-medium">Buscando detalhes da transação</p>
        </div>
      </div>
    );
  }

  // ESTADO: NÃO ENCONTRADO
  if (!editingTx) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-transparent p-4 md:p-8">
        <div className="mx-auto max-w-full text-center  space-y-2">
          <div className="h-16 w-16 bg-red-400 text-red-600 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Lançamento não encontrado</h2>
          <p className="text-zinc-500">Este registro pode ter sido excluído ou você não tem permissão para acessá-lo.</p>
          <Button variant="default" className="mt-4 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const isIncome = editingTx.type === "income";
  const isRecurringGroup = Boolean(editingTx.groupId && editingTx.isRecurring);
  const isEndedRecurring = Boolean(isRecurringGroup && editingTx.recurrenceEnded);
  const groupLabel = editingTx.groupId
    ? isRecurringGroup
      ? isEndedRecurring
        ? `Recorrência encerrada ${editingTx.installmentCurrent || 1}/${editingTx.installmentTotal || groupedItems.length || 1}`
        : `Recorrência ${editingTx.installmentCurrent || 1}/${editingTx.installmentTotal || groupedItems.length || 1}`
      : `Parcela ${editingTx.installmentCurrent || 1}/${editingTx.installmentTotal || groupedItems.length || 1}`
    : null;

  return (
    <div className="min-h-screen bg-transparent p-4 pb-32 font-sans md:p-8">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-accent" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5 text-muted-foreground" />
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

        {groupLabel && (
          <div
            className={`mb-6 rounded-2xl border px-4 py-3 flex items-center gap-2 text-sm font-medium ${
              isRecurringGroup
                ? isEndedRecurring
                  ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-200"
                  : "border-primary/20 bg-accent text-primary"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            }`}
          >
            {isRecurringGroup ? <Repeat className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            <span>{groupLabel}</span>
          </div>
        )}

        {/* MAIN CONTAINER */}
        <div className="mb-6 overflow-hidden rounded-4xl border border-border/70 bg-card shadow-sm">
          
          {/* HERO: VALOR */}
          <div className={`p-8 pb-6 border-b border-border/70 ${isIncome ? 'bg-emerald-400/30' : 'bg-red-400/30'}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="flex justify-start text-sm font-medium">Valor da transação</Label>
              <button
                type="button"
                aria-label={privacyMode ? "Mostrar valores" : "Ocultar valores"}
                onClick={togglePrivacyMode}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
              >
                {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className={`text-3xl font-bold ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>R$</span>
              <Input 
                type={privacyMode ? "text" : "number"}
                value={privacyMode ? "******" : editingTx.amount}
                readOnly={privacyMode}
                onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value || 0) })} 
                className={`w-full max-w-full h-auto p-0 border-none shadow-none text-4xl md:text-5xl font-bold bg-transparent focus-visible:ring-0 text-start ${isIncome ? 'text-emerald-500 placeholder:text-emerald-500' : 'text-red-500 placeholder:text-red-500'}`}
              />
            </div>
          </div>

          {/* FORMULÁRIO (GRID) */}
          <div className="p-6 md:p-8 space-y-6">
            
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-foreground/85">
                <AlignLeft className="h-4 w-4 text-zinc-400" /> Descrição
              </Label>
              <Input 
                value={editingTx.description} 
                onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} 
                className="h-12 rounded-xl text-base"
                placeholder="Ex: Supermercado"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CATEGORIA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm text-foreground/85">
                    <Tag className="h-4 w-4 text-zinc-400" /> Categoria
                  </Label>
                  <button type="button" onClick={() => setIsCategoryManagerOpen(true)} className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Gerenciar
                  </button>
                </div>
                <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                  <SelectTrigger className="h-12 rounded-xl">
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
                <Label className="flex items-center gap-2 text-sm text-foreground/85">
                  <Calendar className="h-4 w-4 text-zinc-400" /> Data da Compra
                </Label>
                <Input 
                  type="date" 
                  value={editingTx.date} 
                  onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} 
                  className="h-12 rounded-xl"
                />
              </div>

              {/* MÉTODO DE PAGAMENTO */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm text-foreground/85">
                  <CreditCard className="h-4 w-4 text-zinc-400" /> Pagamento
                </Label>
                <Select
                  value={editingTx.paymentMethod}
                  onValueChange={(v) => {
                    const paymentMethod = v as PaymentMethod;
                    setEditingTx({
                      ...editingTx,
                      paymentMethod,
                      ...(paymentMethod === "credit_card" || paymentMethod === "debit_card"
                        ? {}
                        : { cardId: undefined, cardLabel: undefined, cardType: undefined }),
                    });
                  }}
                >
                  <SelectTrigger className="h-12 rounded-xl">
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
                  <Label className="flex items-center gap-2 text-sm text-foreground/85">
                    <Calendar className="h-4 w-4 text-zinc-400" /> Vencimento
                  </Label>
                  <Input 
                    type="date" 
                    value={editingTx.dueDate} 
                    onChange={(e) => setEditingTx({ ...editingTx, dueDate: e.target.value })} 
                    className="h-12 rounded-xl"
                  />
                </div>
              )}

              {isCreditCardPayment && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="flex items-center gap-2 text-sm text-foreground/85">
                    <Calendar className="h-4 w-4 text-zinc-400" /> Vencimento da Fatura
                  </Label>
                  <div className="flex min-h-12 items-center rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground">
                    {selectedCard?.dueDate
                      ? `Esta compra será considerada na fatura com vencimento dia ${String(selectedCard.dueDate).padStart(2, "0")}.`
                      : "Selecione um cartão de crédito para definir o vencimento da fatura."}
                  </div>
                </div>
              )}

              {/* CARTÃO VINCULADO (Condicional) */}
              {(editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card") && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in zoom-in-95">
                  <Label className="flex items-center gap-2 text-sm text-foreground/85">
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
                    <SelectTrigger className="h-12 rounded-xl">
                      <SelectValue placeholder="Selecione um cartão" />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePaymentCards.length === 0 ? (
                        <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
                      ) : (
                        availablePaymentCards.map((card) => (
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

        {/* GRUPO (Se houver) */}
        {groupedItems.length > 0 && (
          <div
            className={`rounded-3xl p-5 md:p-6 mb-6 border ${
              isRecurringGroup
                ? isEndedRecurring
                  ? "bg-slate-50/70 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800/40"
                  : "bg-accent/70 border-primary/20"
                : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30"
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              <Info className={`h-6 w-5 ${isRecurringGroup ? (isEndedRecurring ? "text-slate-600 dark:text-slate-300" : "text-primary") : "text-amber-600"}`} />
              <h3 className={`font-semibold ${isRecurringGroup ? (isEndedRecurring ? "text-slate-900 dark:text-slate-100" : "text-primary") : "text-amber-900 dark:text-amber-100"}`}>
                {isRecurringGroup ? "Visão da recorrência" : "Visão do parcelamento"}
              </h3>
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
              {groupedItems.map((item) => {
                const isCurrent = item.id === editingTx.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl text-sm transition-colors ${
                      isCurrent
                        ? isRecurringGroup
                          ? isEndedRecurring
                            ? "bg-card shadow-sm border border-slate-300 ring-1 ring-slate-400"
                            : "bg-card shadow-sm border border-primary/20 ring-1 ring-ring/35"
                          : "bg-card shadow-sm border border-amber-200 ring-1 ring-amber-500"
                        : isRecurringGroup
                          ? isEndedRecurring
                            ? "hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
                            : "hover:bg-accent/80"
                          : "hover:bg-amber-100/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono font-medium ${
                          isCurrent
                            ? isRecurringGroup
                              ? isEndedRecurring
                                ? "text-slate-700 dark:text-slate-200"
                                : "text-primary"
                              : "text-amber-700"
                            : "text-zinc-500"
                        }`}
                      >
                        {String(item.installmentCurrent).padStart(2, '0')}/{String(item.installmentTotal).padStart(2, '0')}
                      </span>
                      <span className={isCurrent ? "font-semibold text-zinc-900 dark:text-zinc-100" : "text-zinc-600"}>
                        {item.dueDate || item.date}
                      </span>
                    </div>
                    <span
                      className={`font-medium ${
                        isCurrent
                          ? isRecurringGroup
                            ? isEndedRecurring
                              ? "text-slate-700 dark:text-slate-200"
                              : "text-primary"
                            : "text-amber-700"
                          : "text-zinc-600"
                      }`}
                    >
                      {formatCurrencyDisplay(Number(item.amount || 0))}
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
            <Button onClick={() => save(false)} disabled={saving} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-base shadow-sm">
              <Save className="mr-2 h-5 w-5" /> {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button variant="outline" onClick={() => save(false)} disabled={saving} className="h-14 rounded-2xl">
                {isRecurringGroup ? "Salvar só esta ocorrência" : "Salvar só esta parcela"}
              </Button>
              <Button onClick={() => save(true)} disabled={saving} className="h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                {isRecurringGroup ? "Salvar toda a recorrência" : "Salvar todas as parcelas"}
              </Button>
            </div>
          )}

          <div className="pt-4 border-t border-border/70">
            {!editingTx.groupId ? (
              <Button variant="outline" onClick={() => remove(false)} disabled={deleting} className="w-full h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors">
                <Trash2 className="mr-2 h-4 w-4" /> {deleting ? "Excluindo..." : "Excluir Lançamento"}
              </Button>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="outline" onClick={() => remove(false)} disabled={deleting} className="h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
                  {isRecurringGroup ? "Excluir só esta ocorrência" : "Excluir só esta parcela"}
                </Button>
                <Button variant="outline" onClick={() => remove(true)} disabled={deleting} className="h-12 rounded-xl border-red-200 bg-red-50 text-red-700 hover:bg-red-100">
                  {isRecurringGroup ? "Excluir toda a recorrência" : "Excluir todas as parcelas"}
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
