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
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { buildInstallmentPlan } from "@/lib/transactions/installments";
import { addTransaction } from "@/services/transactionService";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { InstallmentValueMode, PaymentMethod, TransactionType } from "@/types/transaction";
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
  const { isPlatformTourActive } = usePlatformExperience();
  const { plans } = usePlans();
  const { featureAccess } = useFeatureAccess();
  const {
    status: onboardingStatus,
    loading: onboardingLoading,
    activeStep: onboardingActiveStep,
    isActive: isOnboardingActive,
    completeStep,
    completeTour,
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
  const [installmentValueMode, setInstallmentValueMode] = useState<InstallmentValueMode>("divide_total");
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
          installmentValueMode: InstallmentValueMode;
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
        if (draft.installmentValueMode === "divide_total" || draft.installmentValueMode === "repeat_value") {
          setInstallmentValueMode(draft.installmentValueMode);
        }
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
        installmentValueMode,
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
    installmentValueMode,
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
    () => getPlanCapabilities(effectivePlan, plans, featureAccess),
    [effectivePlan, plans, featureAccess]
  );
  const canUseInstallments = isBillingExemptRole || effectivePlanCapabilities.hasInstallments;
  const isTransactionOnboardingActive =
    isOnboardingActive &&
    onboardingActiveStep === "firstTransaction" &&
    !onboardingStatus.steps.firstTransaction;

  usePlatformTour({
    route: "transactions-new",
    disabled: onboardingLoading || isOnboardingActive,
    stepVisibility: {
      installments: canUseInstallments,
    },
    onComplete: completeTour,
  });

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
    if (isTransactionOnboardingActive || isPlatformTourActive) {
      setError(
        isPlatformTourActive
          ? "Conclua o tour guiado antes de abrir outros modais."
          : "Conclua sua primeira transação antes de abrir outros modais."
      );
      return;
    }
    setIsCategoryManagerOpen(true);
  };

  const handleCategoryManagerOpenChange = (open: boolean) => {
    if (open && (isTransactionOnboardingActive || isPlatformTourActive)) return;
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
    const installmentPlan = isInstallment
      ? buildInstallmentPlan(value, count, installmentValueMode)
      : null;
    const totalAmountToReserve = installmentPlan ? installmentPlan.totalAmount : value;

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
        installmentValueMode,
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
    <div className="min-h-screen bg-transparent p-4 pb-32 font-sans md:p-8">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER NOVO DESIGN */}
        <div id="tour-transactions-header" className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/70 bg-card shadow-sm hover:bg-accent" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Novo Lançamento
          </h1>
        </div>

        {/* ONBOARDING MESSAGE */}
        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.steps.firstTransaction && (
          <div className={`mb-6 rounded-2xl border p-4 flex items-center gap-3 text-sm shadow-sm ${
            isTransactionOnboardingActive
              ? "border-primary/30 bg-primary/8 text-primary ring-2 ring-primary/15"
              : "border-primary/20 bg-primary/6 text-primary/90"
          }`}>
            <Info className="h-5 w-5 shrink-0 text-primary" />
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
        <div className="mb-6 overflow-hidden rounded-4xl border border-border/70 bg-card shadow-lg">
          
          {/* HERO: TIPO & VALOR */}
          <div className={`p-6 md:p-8 border-b border-border/70 transition-colors duration-500 ${isIncome ? 'bg-emerald-300/50 dark:bg-emerald-950/20' : 'bg-red-300/50 dark:bg-red-950/20'}`}>
            
            {/* TOGGLE TIPO DE TRANSAÇÃO ELEGANTE */}
            <div className="flex justify-center mb-8">
              <div id="tour-transactions-type" className="app-panel-soft flex w-full max-w-full rounded-2xl border p-1.5 shadow-sm backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setType("expense")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${!isIncome ? 'bg-card text-red-600 shadow-sm' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'}`}
                  >
                  <TrendingDown className="h-4 w-4" /> Despesa
                </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${isIncome ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'}`}
                  >
                  <TrendingUp className="h-4 w-4" /> Receita
                </button>
              </div>
            </div>

            {/* INPUT DE VALOR SEM BORDAS */}
            <Label className="text-zinc-500 font-medium text-sm flex justify-start mb-2">
              {isInstallment && installmentValueMode === "repeat_value" ? "Valor de cada parcela" : "Valor do lancamento"}
            </Label>
            <div id="tour-transactions-amount" className="flex items-center justify-center gap-2">
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
            <p className="mt-3 text-sm text-zinc-500">
              {isInstallment
                ? installmentValueMode === "divide_total"
                  ? "Voce informa o valor total e o sistema divide automaticamente entre as parcelas."
                  : "Voce informa o valor de cada parcela e o sistema repete esse valor nas proximas parcelas."
                : isRecurring
                  ? "Esse valor sera repetido nos proximos 12 meses."
                  : "Esse valor sera salvo exatamente como voce digitou."}
            </p>
          </div>

          {/* FORMULÁRIO GERAL */}
          <div className="p-6 md:p-8 space-y-6">
            
            {/* DESCRIÇÃO */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <AlignLeft className="h-4 w-4 text-zinc-400" /> Descrição
              </Label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="h-12 rounded-xl text-base font-medium"
                placeholder="Ex: Supermercado"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CATEGORIA */}
              <div id="tour-transactions-category" className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <Tag className="h-4 w-4 text-zinc-400" /> Categoria
                  </Label>
                  <button
                    type="button"
                    onClick={handleOpenCategoryManager}
                    disabled={isTransactionOnboardingActive}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="h-3 w-3" /> Gerenciar
                  </button>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 rounded-xl font-medium">
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
                <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                  <Calendar className="h-4 w-4 text-zinc-400" /> Data da Compra
                </Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)} 
                  className="h-12 rounded-xl font-medium"
                />
              </div>

              {/* MÉTODO DE PAGAMENTO */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                  <CreditCard className="h-4 w-4 text-zinc-400" /> Forma de Pagamento
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger className="h-12 rounded-xl font-medium">
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
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <Calendar className="h-4 w-4 text-zinc-400" /> Data de Vencimento
                  </Label>
                  <Input 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-12 rounded-xl font-medium"
                  />
                </div>
              )}

              {/* CARTÃO VINCULADO (Condicional) */}
              {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <ReceiptText className="h-4 w-4 text-zinc-400" /> Cartão Vinculado
                  </Label>
                  <Select
                    value={selectedCardId}
                    onValueChange={setSelectedCardId}
                  >
                    <SelectTrigger className="h-12 rounded-xl font-medium">
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
            <div className="pt-6 mt-6 space-y-4 border-t border-border/70">
              <Label className="text-zinc-500 font-semibold text-xs tracking-wider uppercase">Opções Avançadas</Label>
              
              {/* ASSINATURA / FIXA (Disponível para Receita e Despesa) */}
              <div id="tour-transactions-recurring" className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${isRecurring ? 'border-primary/25 bg-accent text-accent-foreground ring-1 ring-primary/10' : 'app-panel-subtle hover:border-primary/20'}`} onClick={() => handleToggleRecurring(!isRecurring)}>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-foreground/85">
                    <Repeat className={`h-4 w-4 ${isRecurring ? 'text-primary' : 'text-zinc-400'}`} /> 
                    Lançamento Fixo / Assinatura
                  </Label>
                  <Switch className="data-[state=checked]:bg-primary" checked={isRecurring} onCheckedChange={handleToggleRecurring} onClick={(e) => e.stopPropagation()} />
                </div>
                {isRecurring && (
                  <p className="mt-2 ml-6 animate-in fade-in text-xs text-primary">
                    Este lançamento será repetido automaticamente todos os meses.
                  </p>
                )}
              </div>

              {/* PARCELAMENTO (Apenas para Despesas) */}
              {!isIncome && (
                <div
                  id="tour-transactions-installment"
                  className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                    !canUseInstallments
                      ? 'app-panel-subtle border-dashed border-border/80'
                      : isInstallment
                        ? 'bg-primary/6 border-primary/20'
                        : 'app-panel-subtle hover:border-primary/20'
                  }`}
                  onClick={() => handleToggleInstallment(!isInstallment)}
                >
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-foreground/85">
                      <Layers className={`h-4 w-4 ${isInstallment ? 'text-primary' : 'text-zinc-400'}`} /> 
                      Compra Parcelada
                    </Label>
                    <Switch checked={isInstallment} disabled={!canUseInstallments} onCheckedChange={handleToggleInstallment} onClick={(e) => e.stopPropagation()} />
                  </div>

                  {!canUseInstallments && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/8 px-3 py-3 text-sm text-primary">
                      <p className="flex items-center gap-2 font-semibold">
                        <Crown className="h-4 w-4 text-primary" />
                        Disponível no Premium e no Pro
                      </p>
                      <p className="mt-1 text-xs text-primary/80">
                        Faça upgrade para lançar compras parceladas e acompanhar o mês com mais precisão.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="mt-3 h-9 rounded-xl border-primary/20 text-primary hover:bg-primary/10"
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
                    <div className="pt-4 mt-3 border-t border-primary/12 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-zinc-500 text-xs mb-1.5 block">Em quantas vezes?</Label>
                      <Input
                        type="number"
                        min={2}
                        max={360}
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(e.target.value)}
                        placeholder="Número de parcelas"
                        className="h-11 rounded-xl border-primary/20 font-medium"
                      />
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/8 px-3 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <Label htmlFor="installment-split-mode" className="text-sm font-semibold text-primary">
                              Dividir o valor total
                            </Label>
                            <p className="mt-1 text-xs text-primary/80">
                              Ative para informar o valor total da compra. Desative se o valor digitado já for o de cada parcela.
                            </p>
                          </div>
                          <Switch
                            id="installment-split-mode"
                            checked={installmentValueMode === "divide_total"}
                            onCheckedChange={(checked) => setInstallmentValueMode(checked ? "divide_total" : "repeat_value")}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="outline" onClick={() => router.back()} className="h-14 text-base shadow-sm hover:cursor-pointer sm:flex-1 rounded-2xl">
            Cancelar
          </Button>
          <Button
            id="tour-transactions-submit"
            onClick={onSubmit}
            disabled={saving}
            className={`h-14 sm:flex-2 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm text-base hover:cursor-pointer ${
              isTransactionOnboardingActive ? "ring-2 ring-ring/45 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Salvando...
              </span>
            ) : (
              <span className="flex items-center gap-2">{saving ? <><div className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white animate-spin" /> Salvando...</> : <><Plus className="h-5 w-5" /> Adicionar Lançamento</>}</span>
            )}
          </Button>
        </div>

      </div>

      <CategoryManagerDialog
        open={isTransactionOnboardingActive || isPlatformTourActive ? false : isCategoryManagerOpen}
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
