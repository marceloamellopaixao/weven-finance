"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Calendar, CreditCard, 
  Tag, AlignLeft, ReceiptText, AlertCircle, Settings2, 
  Layers, TrendingDown, TrendingUp, Info, Repeat, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryManagerDialog } from "@/components/categories/CategoryManagerDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { usePlans } from "@/hooks/usePlans";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useOnboarding } from "@/hooks/useOnboarding";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { addTransaction } from "@/services/transactionService";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { PaymentMethod, TransactionType } from "@/types/transaction";
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

export default function NewTransactionPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { plans } = usePlans();
  const {
    status: onboardingStatus,
    loading: onboardingLoading,
    activeStep: onboardingActiveStep,
    isActive: isOnboardingActive,
    completeStep,
  } = useOnboarding();
  const { transactions } = useTransactions();
  const {
    categories,
    defaultCategories,
    loadingCategories,
    addNewCategory,
    deleteCategory,
    renameCategory,
    toggleDefaultCategoryVisibility,
  } = useCategories();

  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Controles de Tipo de Cobrança (Com suas correções mantidas)
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [isRecurring, setIsRecurring] = useState(false);

  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draftStorageKey = useMemo(
    () => (user ? `wevenfinance:new-transaction-draft:v1:${user.uid}` : null),
    [user]
  );
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    return subscribeToPaymentCards(user.uid, setPaymentCards, () => setPaymentCards([]));
  }, [user]);

  const monthCategories = useMemo(() => {
    const filtered = categories.filter((c) => c.type === type || c.type === "both");
    const byName = new Map(filtered.map((cat) => [cat.name, cat]));
    return orderCategoryNames(filtered.map((cat) => cat.name))
      .map((name) => byName.get(name))
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));
  }, [categories, type]);

  const parsedAmount = useMemo(() => parseCurrencyInput(amountInput), [amountInput]);

  useEffect(() => {
    if (!draftStorageKey) {
      setDraftReady(true);
      return;
    }

    try {
      const storedDraft = window.localStorage.getItem(draftStorageKey);
      if (storedDraft) {
        const draft = JSON.parse(storedDraft) as Partial<{
          type: TransactionType;
          description: string;
          amountInput: string;
          category: string;
          paymentMethod: PaymentMethod;
          date: string;
          dueDate: string;
          isInstallment: boolean;
          installmentsCount: string;
          isRecurring: boolean;
          selectedCardId: string;
        }>;

        if (draft.type === "income" || draft.type === "expense") setType(draft.type);
        if (typeof draft.description === "string") setDescription(draft.description);
        if (typeof draft.amountInput === "string") setAmountInput(formatCurrencyInput(draft.amountInput));
        if (typeof draft.category === "string") setCategory(draft.category);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (typeof draft.date === "string") setDate(draft.date);
        if (typeof draft.dueDate === "string") setDueDate(draft.dueDate);
        if (typeof draft.isInstallment === "boolean") setIsInstallment(draft.isInstallment);
        if (typeof draft.installmentsCount === "string") setInstallmentsCount(draft.installmentsCount);
        if (typeof draft.isRecurring === "boolean") setIsRecurring(draft.isRecurring);
        if (typeof draft.selectedCardId === "string") setSelectedCardId(draft.selectedCardId);
      }
    } catch {
      window.localStorage.removeItem(draftStorageKey);
    } finally {
      setDraftReady(true);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    if (!draftStorageKey || !draftReady) return;

    window.localStorage.setItem(
      draftStorageKey,
      JSON.stringify({
        type,
        description,
        amountInput,
        category,
        paymentMethod,
        date,
        dueDate,
        isInstallment,
        installmentsCount,
        isRecurring,
        selectedCardId,
      })
    );
  }, [
    amountInput,
    category,
    date,
    description,
    draftReady,
    draftStorageKey,
    dueDate,
    installmentsCount,
    isInstallment,
    isRecurring,
    paymentMethod,
    selectedCardId,
    type,
  ]);

  useEffect(() => {
    if (!category) return;
    if (loadingCategories) return;
    if (monthCategories.some((item) => item.name === category)) return;
    setCategory("");
  }, [category, loadingCategories, monthCategories]);

  const showDueDateInput = useMemo(() => {
    const method = PAYMENT_METHODS.find((m) => m.value === paymentMethod);
    return Boolean(method?.hasDueDate);
  }, [paymentMethod]);

  const selectedCard = useMemo(
    () => paymentCards.find((card) => card.id === selectedCardId),
    [paymentCards, selectedCardId]
  );

  const currentBalance = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const paid = transactions.reduce((acc, t) => (t.status === "paid" ? (t.type === "income" ? acc + t.amount : acc - t.amount) : acc), 0);
    const overdue = transactions
      .filter((t) => t.status !== "paid" && typeof t.dueDate === "string" && t.dueDate < todayStr)
      .reduce((acc, t) => (t.type === "income" ? acc + t.amount : acc - t.amount), 0);
    return paid + overdue;
  }, [transactions]);

  const isBillingExemptRole = userProfile?.role === "admin" || userProfile?.role === "moderator";
  const effectivePlan = userProfile?.plan || "free";
  const effectivePlanCapabilities = useMemo(
    () => getPlanCapabilities(effectivePlan, plans),
    [effectivePlan, plans]
  );
  const canUseInstallments = isBillingExemptRole || effectivePlanCapabilities.hasInstallments;
  const isTransactionOnboardingActive =
    isOnboardingActive &&
    onboardingActiveStep === "firstTransaction" &&
    !onboardingStatus.steps.firstTransaction;

  const linkedCardTransactions = (card: PaymentCard) =>
    transactions.filter((tx) => {
      if (tx.type !== "expense") return false;
      if (tx.cardId && tx.cardId === card.id) return true;
      const label = String(tx.cardLabel || "").toLowerCase();
      return label.includes(card.last4) && label.includes(card.bankName.toLowerCase());
    });

  const validateLimit = (card: PaymentCard, method: PaymentMethod, amountTotal: number) => {
    if (amountTotal <= 0) return true;
    if (method === "debit_card") return amountTotal <= currentBalance;
    if (method !== "credit_card") return true;
    const used = linkedCardTransactions(card)
      .filter((tx) => tx.paymentMethod === "credit_card" && tx.status === "pending")
      .reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    return amountTotal <= Math.max(0, Number(card.creditLimit || 0) - used);
  };

  // Funções de Exclusividade Mútua mantidas intactas
  const handleToggleInstallment = (checked: boolean) => {
    if (checked && !canUseInstallments) {
      setError("Parcelamentos estão disponíveis apenas nos planos Premium e Pro.");
      return;
    }
    setIsInstallment(checked);
    if (checked) setIsRecurring(false);
  };

  const handleToggleRecurring = (checked: boolean) => {
    setIsRecurring(checked);
    if (checked) setIsInstallment(false);
  };

  const handleOpenCategoryManager = () => {
    if (isTransactionOnboardingActive) {
      setError("Conclua sua primeira transação antes de abrir outros modais.");
      return;
    }
    setIsCategoryManagerOpen(true);
  };

  const handleCategoryManagerOpenChange = (open: boolean) => {
    if (open && isTransactionOnboardingActive) return;
    setIsCategoryManagerOpen(open);
  };

  const onSubmit = async () => {
    if (!user) return;
    setError("");
    if (!description.trim() || parsedAmount <= 0 || !category) {
      setError("Preencha descrição, valor e categoria.");
      return;
    }

    const isCardPayment = paymentMethod === "credit_card" || paymentMethod === "debit_card";
    if (isCardPayment && !selectedCard) {
      setError("Selecione um cartão para continuar.");
      return;
    }

    const value = parsedAmount;
    const count = isInstallment ? Math.max(1, Number(installmentsCount || 1)) : 1;
    const totalAmountToReserve = Math.round(value * count * 100) / 100;

    if (isInstallment && !canUseInstallments) {
      setError("Parcelamentos estão disponíveis apenas nos planos Premium e Pro.");
      return;
    }

    if (isCardPayment && selectedCard && !validateLimit(selectedCard, paymentMethod, totalAmountToReserve)) {
      setError(
        paymentMethod === "debit_card"
          ? `Saldo insuficiente no débito. Disponível: ${formatCurrency(currentBalance)}`
          : "Limite insuficiente para esta compra."
      );
      return;
    }

    setSaving(true);
    try {
      // Passando as propriedades exatamente como nas suas correções
      await addTransaction(user.uid, {
        description: description.trim(),
        amount: value,
        type,
        category,
        paymentMethod,
        cardId: selectedCard?.id,
        cardLabel: selectedCard ? `${selectedCard.bankName} •••• ${selectedCard.last4}` : undefined,
        cardType: paymentMethod === "credit_card" || paymentMethod === "debit_card" ? paymentMethod : undefined,
        date,
        dueDate: showDueDateInput ? dueDate : date,
        isInstallment,
        installmentsCount: count,
        isRecurring, 
      });
      if (isTransactionOnboardingActive) {
        try {
          await completeStep("firstTransaction");
        } catch {}
      }
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a transação.");
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === "income";

  return (
    <div className="min-h-screen bg-zinc-50/30 dark:bg-zinc-950/30 p-4 md:p-8 pb-32 font-sans">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER NOVO DESIGN */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-zinc-200/50 bg-white dark:bg-zinc-900 shadow-sm border" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 text-zinc-600 dark:text-zinc-300" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Novo Lançamento
          </h1>
        </div>

        {/* ONBOARDING MESSAGE */}
        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.steps.firstTransaction && (
          <div className={`mb-6 rounded-2xl border p-4 flex items-center gap-3 text-sm shadow-sm ${
            isTransactionOnboardingActive
              ? "border-violet-300 bg-violet-50 text-violet-900 ring-2 ring-violet-200"
              : "border-violet-200 bg-violet-50 text-violet-800"
          }`}>
            <Info className="h-5 w-5 shrink-0 text-violet-600" />
            <p><strong>Etapa atual:</strong> salve sua primeira transação para concluir o início guiado.</p>
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-red-700 text-sm shadow-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* MAIN CONTAINER UNIFICADO */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-4xl shadow-lg overflow-hidden mb-6">
          
          {/* HERO: TIPO & VALOR */}
          <div className={`p-6 md:p-8 border-b border-zinc-100 dark:border-zinc-800/50 transition-colors duration-500 ${isIncome ? 'bg-emerald-300/50 dark:bg-emerald-950/20' : 'bg-red-300/50 dark:bg-red-950/20'}`}>
            
            {/* TOGGLE TIPO DE TRANSAÇÃO ELEGANTE */}
            <div className="flex justify-center mb-8">
              <div className="bg-white/60 dark:bg-zinc-950/40 p-1.5 rounded-2xl flex backdrop-blur-md shadow-sm border border-black/5 dark:border-white/5 w-full max-w-full">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${!isIncome ? 'bg-white dark:bg-zinc-800 text-red-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                  <TrendingDown className="h-4 w-4" /> Despesa
                </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${isIncome ? 'bg-white dark:bg-zinc-800 text-emerald-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                  >
                  <TrendingUp className="h-4 w-4" /> Receita
                </button>
              </div>
            </div>

            {/* INPUT DE VALOR SEM BORDAS */}
            <Label className="text-zinc-500 font-medium text-sm flex justify-start mb-2">Valor do lançamento</Label>
            <div className="flex items-center justify-center gap-2">
              <span className={`text-3xl font-bold transition-colors ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>R$</span>
              <Input 
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))}
                placeholder="0,00"
                className={`w-full max-w-full h-auto p-0 border-none shadow-none text-4xl md:text-5xl font-bold bg-transparent focus-visible:ring-0 text-start ${isIncome ? 'text-emerald-500 placeholder:text-emerald-500' : 'text-red-500 placeholder:text-red-500'}`}
              />
            </div>
          </div>

          {/* FORMULÁRIO GERAL */}
          <div className="p-6 md:p-8 space-y-6">
            
            {/* DESCRIÇÃO */}
            <div className="space-y-2">
              <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                <AlignLeft className="h-4 w-4 text-zinc-400" /> Descrição
              </Label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus-visible:ring-violet-500 text-base font-medium"
                placeholder="Ex: Supermercado"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CATEGORIA */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                    <Tag className="h-4 w-4 text-zinc-400" /> Categoria
                  </Label>
                  <button
                    type="button"
                    onClick={handleOpenCategoryManager}
                    disabled={isTransactionOnboardingActive}
                    className="text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="h-3 w-3" /> Gerenciar
                  </button>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium">
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
                <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4 text-zinc-400" /> Data da Compra
                </Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium"
                />
              </div>

              {/* MÉTODO DE PAGAMENTO */}
              <div className="space-y-2">
                <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                  <CreditCard className="h-4 w-4 text-zinc-400" /> Forma de Pagamento
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* DATA DE VENCIMENTO (Condicional) */}
              {showDueDateInput && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                    <Calendar className="h-4 w-4 text-zinc-400" /> Data de Vencimento
                  </Label>
                  <Input 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium"
                  />
                </div>
              )}

              {/* CARTÃO VINCULADO (Condicional) */}
              {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium">
                    <ReceiptText className="h-4 w-4 text-zinc-400" /> Cartão Vinculado
                  </Label>
                  <Select
                    value={selectedCardId}
                    onValueChange={setSelectedCardId}
                  >
                    <SelectTrigger className="h-12 rounded-xl bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 font-medium">
                      <SelectValue placeholder="Selecione um cartão para vincular" />
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

            {/* OPÇÕES AVANÇADAS: RECORRÊNCIA E PARCELAMENTO */}
            <div className="pt-6 mt-6 space-y-4 border-t border-zinc-100 dark:border-zinc-800/50">
              <Label className="text-zinc-500 font-semibold text-xs tracking-wider uppercase">Opções Avançadas</Label>
              
              {/* ASSINATURA / FIXA (Disponível para Receita e Despesa) */}
              <div className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${isRecurring ? 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 hover:border-blue-200'}`} onClick={() => handleToggleRecurring(!isRecurring)}>
                <div className="flex items-center justify-between">
                  <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Repeat className={`h-4 w-4 ${isRecurring ? 'text-blue-600' : 'text-zinc-400'}`} /> 
                    Lançamento Fixo / Assinatura
                  </Label>
                  <Switch checked={isRecurring} onCheckedChange={handleToggleRecurring} onClick={(e) => e.stopPropagation()} />
                </div>
                {isRecurring && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 ml-6 animate-in fade-in">
                    Este lançamento será repetido automaticamente todos os meses.
                  </p>
                )}
              </div>

              {/* PARCELAMENTO (Apenas para Despesas) */}
              {!isIncome && (
                <div
                  className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    !canUseInstallments
                      ? 'bg-zinc-50/80 dark:bg-zinc-950/40 border-dashed border-zinc-300 dark:border-zinc-700'
                      : isInstallment
                        ? 'bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-900'
                        : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 hover:border-violet-200'
                  }`}
                  onClick={() => handleToggleInstallment(!isInstallment)}
                >
                  <div className="flex items-center justify-between">
                    <Label className="text-zinc-700 dark:text-zinc-300 flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <Layers className={`h-4 w-4 ${isInstallment ? 'text-violet-600' : 'text-zinc-400'}`} /> 
                      Compra Parcelada
                    </Label>
                    <Switch checked={isInstallment} disabled={!canUseInstallments} onCheckedChange={handleToggleInstallment} onClick={(e) => e.stopPropagation()} />
                  </div>

                  {!canUseInstallments && (
                    <div className="mt-3 rounded-xl border border-violet-200 bg-violet-50 px-3 py-3 text-sm text-violet-800">
                      <p className="flex items-center gap-2 font-semibold">
                        <Crown className="h-4 w-4 text-violet-600" />
                        Disponível no Premium e no Pro
                      </p>
                      <p className="mt-1 text-xs text-violet-700">
                        Faça upgrade para lançar compras parceladas e acompanhar o mês com mais precisão.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-9 rounded-xl border-violet-200 text-violet-700 hover:bg-violet-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/settings?tab=billing");
                        }}
                      >
                        Ver planos
                      </Button>
                    </div>
                  )}

                  {canUseInstallments && isInstallment && (
                    <div className="pt-4 mt-3 border-t border-violet-100 dark:border-violet-900/50 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-zinc-500 text-xs mb-1.5 block">Em quantas vezes?</Label>
                      <Input
                        type="number"
                        min={2}
                        max={360}
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(e.target.value)}
                        placeholder="Número de parcelas"
                        className="h-11 rounded-xl bg-white dark:bg-zinc-900 border-violet-200 dark:border-violet-800 focus-visible:ring-violet-500 font-medium"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" onClick={() => router.back()} className="h-14 sm:flex-1 rounded-2xl border-zinc-200 text-zinc-700 bg-white hover:bg-zinc-50 text-base shadow-sm hover:cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={onSubmit}
            disabled={saving}
            className={`h-14 sm:flex-2 rounded-2xl bg-violet-600 hover:bg-violet-700 text-white shadow-sm text-base hover:cursor-pointer ${
              isTransactionOnboardingActive ? "ring-2 ring-violet-300 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950" : ""
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">{saving ? <><div className="h-10 w-10 rounded-full border-4 border-zinc-200 border-t-violet-600 animate-spin" /> Salvando...</> : <><Plus className="h-5 w-5" /> Adicionar Lançamento</>}</span>
            )}
          </Button>
        </div>

      </div>

      <CategoryManagerDialog
        open={isTransactionOnboardingActive ? false : isCategoryManagerOpen}
        onOpenChange={handleCategoryManagerOpenChange}
        type={type}
        selectedCategory={category}
        onSelectCategory={setCategory}
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
