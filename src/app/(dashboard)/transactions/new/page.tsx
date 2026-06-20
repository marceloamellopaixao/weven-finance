"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Plus, Calendar, CreditCard, 
  Tag, AlignLeft, ReceiptText, AlertCircle, Settings2,
  Layers, TrendingDown, TrendingUp, Repeat, Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryLabel } from "@/components/categories/CategoryLabel";
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
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { usePlatformExperience } from "@/hooks/usePlatformExperience";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useFormatters } from "@/i18n/useFormatters";
import { useTranslations } from "@/i18n/T";
import { getCreditCardDueDateFromSelectedCard, isCreditCapableCard } from "@/lib/credit-card/due-date";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { getCurrencySymbol } from "@/lib/money/formatMoney";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { buildInstallmentPlan } from "@/lib/transactions/installments";
import { getCurrentMonthKey, getMonthKey } from "@/lib/transactions/recurring";
import { addTransaction } from "@/services/transactionService";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { InstallmentValueMode, PaymentMethod, TransactionType } from "@/types/transaction";
import { orderCategoryNames } from "@/lib/category-utils";
import { calculateDailyLimit } from "@/lib/finance/daily-limit";

const PAYMENT_METHODS: { value: PaymentMethod; labelKey: string; hasDueDate: boolean }[] = [
  { value: "pix", labelKey: "paymentMethods.pix", hasDueDate: false },
  { value: "boleto", labelKey: "paymentMethods.boleto", hasDueDate: true },
  { value: "cash", labelKey: "paymentMethods.cash", hasDueDate: false },
  { value: "transfer", labelKey: "paymentMethods.transfer", hasDueDate: false },
  { value: "debit_card", labelKey: "paymentMethods.debitCard", hasDueDate: false },
  { value: "credit_card", labelKey: "paymentMethods.creditCard", hasDueDate: false },
];

export default function NewTransactionPage() {
  const t = useTranslations("transactions");
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { isPlatformTourActive } = usePlatformExperience();
  const { activeWorkspaceId } = useWorkspaces();
  const { plans } = usePlans();
  const { featureAccess } = useFeatureAccess();
  const {
    loading: onboardingLoading,
    isActive: isOnboardingActive,
    completeTour,
  } = useOnboarding();
  const { transactions } = useTransactions();
  const currency = usePreferredCurrency();
  const { money } = useFormatters(currency);
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
  const [transactionNotes, setTransactionNotes] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  
  // Controles de Tipo de Cobrança (Com suas correções mantidas)
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [installmentValueMode, setInstallmentValueMode] = useState<InstallmentValueMode>("split_total");
  const [isRecurring, setIsRecurring] = useState(false);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const draftStorageKey = useMemo(
    () => (user ? `wevenfinance:new-transaction-draft:v2:${user.uid}:${activeWorkspaceId || "default"}` : null),
    [activeWorkspaceId, user]
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
          transactionNotes: string;
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
        if (typeof draft.transactionNotes === "string") setTransactionNotes(draft.transactionNotes);
        if (typeof draft.amountInput === "string") setAmountInput(formatCurrencyInput(draft.amountInput));
        if (typeof draft.category === "string") setCategory(draft.category);
        if (draft.paymentMethod) setPaymentMethod(draft.paymentMethod);
        if (typeof draft.date === "string") setDate(draft.date);
        if (typeof draft.dueDate === "string") setDueDate(draft.dueDate);
        if (typeof draft.isInstallment === "boolean") setIsInstallment(draft.isInstallment);
        if (typeof draft.installmentsCount === "string") setInstallmentsCount(draft.installmentsCount);
        if (draft.installmentValueMode === "split_total" || draft.installmentValueMode === "repeat_value") {
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
        transactionNotes,
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
    transactionNotes,
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

  const isCreditCardPayment = paymentMethod === "credit_card";

  const selectedCard = useMemo(
    () => paymentCards.find((card) => card.id === selectedCardId),
    [paymentCards, selectedCardId]
  );

  const availablePaymentCards = useMemo(
    () =>
      paymentCards.filter((card) => {
        if (paymentMethod === "credit_card") return isCreditCapableCard(card);
        if (paymentMethod === "debit_card") return card.type === "debit_card" || card.type === "credit_and_debit";
        return false;
      }),
    [paymentCards, paymentMethod]
  );

  const creditCardDueDate = useMemo(
    () =>
      isCreditCardPayment
        ? getCreditCardDueDateFromSelectedCard(selectedCard, date)
        : null,
    [date, isCreditCardPayment, selectedCard]
  );

  useEffect(() => {
    if (paymentMethod !== "credit_card" && paymentMethod !== "debit_card") {
      setSelectedCardId("");
      return;
    }
    if (!selectedCardId) return;
    if (paymentCards.length === 0) return;
    if (availablePaymentCards.some((card) => card.id === selectedCardId)) return;
    setSelectedCardId("");
  }, [availablePaymentCards, paymentCards.length, paymentMethod, selectedCardId]);

  const currentBalance = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const paid = transactions.reduce((acc, t) => (t.status === "paid" ? (t.type === "income" ? acc + t.amount : acc - t.amount) : acc), 0);
    const overdue = transactions
      .filter((t) => t.status !== "paid" && typeof t.dueDate === "string" && t.dueDate < todayStr)
      .reduce((acc, t) => (t.type === "income" ? acc + t.amount : acc - t.amount), 0);
    return paid + overdue;
  }, [transactions]);

  const dailyLimitAfterTransaction = useMemo(() => {
    if (type !== "expense" || parsedAmount <= 0) return null;
    const simulatedDueDate = paymentMethod === "credit_card" ? creditCardDueDate || date : showDueDateInput ? dueDate : date;
    const result = calculateDailyLimit({
      transactions: [
        ...transactions,
        {
          type: "expense",
          amount: parsedAmount,
          amountForLimit: parsedAmount,
          status: "pending",
          dueDate: simulatedDueDate,
          date,
          paymentMethod,
          cardId: selectedCard?.id,
        },
      ],
      cards: paymentCards,
      today: new Date().toISOString().slice(0, 10),
    });
    return result.amount;
  }, [creditCardDueDate, date, dueDate, parsedAmount, paymentCards, paymentMethod, selectedCard?.id, showDueDateInput, transactions, type]);

  const isBillingExemptRole = userProfile?.role === "admin" || userProfile?.role === "moderator";
  const effectivePlan = userProfile?.plan || "free";
  const effectivePlanCapabilities = useMemo(
    () => getPlanCapabilities(effectivePlan, plans, featureAccess),
    [effectivePlan, plans, featureAccess]
  );
  const canUseInstallments = isBillingExemptRole || effectivePlanCapabilities.hasInstallments;
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
    const currentMonthKey = getCurrentMonthKey();
    const used = linkedCardTransactions(card)
      .filter((tx) => tx.paymentMethod === "credit_card" && tx.status === "pending")
      .filter((tx) => getMonthKey(tx.dueDate || tx.date) === currentMonthKey)
      .reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    return amountTotal <= Math.max(0, Number(card.creditLimit || 0) - used);
  };

  // Funções de Exclusividade Mútua mantidas intactas
  const handleToggleInstallment = (checked: boolean) => {
    if (checked && !canUseInstallments) {
      setError(t("new.errors.installmentsPremium"));
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
    if (isPlatformTourActive) {
      setError(
        t("new.errors.tourModal")
      );
      return;
    }
    setIsCategoryManagerOpen(true);
  };

  const handleCategoryManagerOpenChange = (open: boolean) => {
    if (open && isPlatformTourActive) return;
    setIsCategoryManagerOpen(open);
  };

  const onSubmit = async () => {
    if (!user) return;
    setError("");
    if (!description.trim() || parsedAmount <= 0 || !category) {
      setError(t("new.errors.requiredFields"));
      return;
    }

    const isCardPayment = paymentMethod === "credit_card" || paymentMethod === "debit_card";
    if (paymentMethod === "credit_card" && !selectedCard) {
      setError(t("new.errors.selectCreditCard"));
      return;
    }
    if (paymentMethod === "credit_card" && !creditCardDueDate) {
      setError(t("new.errors.missingCreditDueDate"));
      return;
    }
    if (isCardPayment && !selectedCard) {
      setError(t("new.errors.selectCard"));
      return;
    }

    const value = parsedAmount;
    const count = isInstallment ? Math.max(1, Number(installmentsCount || 1)) : 1;
    const installmentPlan = isInstallment
      ? buildInstallmentPlan(value, count, installmentValueMode)
      : null;
    const totalAmountToReserve = installmentPlan ? installmentPlan.totalAmount : value;

    if (isInstallment && !canUseInstallments) {
      setError(t("new.errors.installmentsPremium"));
      return;
    }

    if (isCardPayment && selectedCard && !validateLimit(selectedCard, paymentMethod, totalAmountToReserve)) {
      setError(
        paymentMethod === "debit_card"
          ? t("new.errors.debitInsufficient", { amount: money(currentBalance) })
          : t("new.errors.creditInsufficient")
      );
      return;
    }

    setSaving(true);
    try {
      // Passando as propriedades exatamente como nas suas correções
      await addTransaction(user.uid, {
        title: description.trim(),
        description: transactionNotes.trim(),
        amount: value,
        type,
        category,
        paymentMethod,
        cardId: selectedCard?.id,
        cardLabel: selectedCard ? `${selectedCard.bankName} •••• ${selectedCard.last4}` : undefined,
        cardType: paymentMethod === "credit_card" || paymentMethod === "debit_card" ? paymentMethod : undefined,
        date,
        dueDate: paymentMethod === "credit_card" ? creditCardDueDate! : showDueDateInput ? dueDate : date,
        isInstallment,
        installmentsCount: count,
        installmentValueMode,
        isRecurring,
      });
      if (draftStorageKey) {
        window.localStorage.removeItem(draftStorageKey);
      }
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("new.errors.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const isIncome = type === "income";

  return (
    <div className="min-h-screen bg-transparent p-4 pb-[calc(env(safe-area-inset-bottom)+10rem)] font-sans md:p-8 md:pb-25">
      <div className="mx-auto max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* HEADER NOVO DESIGN */}
        <div id="tour-transactions-header" className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full border border-border/70 bg-card shadow-sm hover:bg-accent" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {t("new.title")}
          </h1>
        </div>

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
                  <TrendingDown className="h-4 w-4" /> {t("types.expense")}
                </button>
                  <button
                    type="button"
                    onClick={() => setType("income")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:cursor-pointer ${isIncome ? 'bg-card text-emerald-600 shadow-sm' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'}`}
                  >
                  <TrendingUp className="h-4 w-4" /> {t("types.income")}
                </button>
              </div>
            </div>

            {/* INPUT DE VALOR SEM BORDAS */}
            <Label className="text-zinc-500 font-medium text-sm flex justify-start mb-2">
              {isInstallment && installmentValueMode === "repeat_value" ? t("new.amountPerInstallment") : t("new.amount")}
            </Label>
            <div id="tour-transactions-amount" className="flex items-center justify-center gap-2">
              <span className={`text-2xl font-bold transition-colors sm:text-3xl ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>{getCurrencySymbol(currency)}</span>
              <Input 
                type="text"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))}
                placeholder={t("new.amountPlaceholder")}
                className={`financial-value w-full max-w-full h-auto p-0 border-none shadow-none text-3xl sm:text-4xl md:text-5xl font-bold bg-transparent focus-visible:ring-0 text-start ${isIncome ? 'text-emerald-500 placeholder:text-emerald-500' : 'text-red-500 placeholder:text-red-500'}`}
              />
            </div>
            <p className="mt-3 text-sm text-zinc-500">
              {isInstallment
                ? installmentValueMode === "split_total"
                  ? t("new.splitTotalHelp")
                  : t("new.repeatValueHelp")
                : isRecurring
                  ? t("new.recurringHelp")
                  : t("new.simpleAmountHelp")}
            </p>
          </div>

          {dailyLimitAfterTransaction !== null && !isInstallment && !isRecurring && (
            <div className="border-b border-border/70 px-6 py-3 md:px-8">
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                {t("new.dailyLimitAfter", { amount: money(dailyLimitAfterTransaction) })}
              </p>
            </div>
          )}

          {/* FORMULÁRIO GERAL */}
          <div className="p-6 md:p-8 space-y-6">
            
            {/* DESCRIÇÃO */}
            <div id="tour-transactions-description" className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <AlignLeft className="h-4 w-4 text-zinc-400" /> {t("common.title")}
              </Label>
              <Input 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="h-12 rounded-xl text-base font-medium"
                placeholder={t("common.exampleTitle")}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                <ReceiptText className="h-4 w-4 text-zinc-400" /> {t("common.description")}
              </Label>
              <textarea
                value={transactionNotes}
                onChange={(e) => setTransactionNotes(e.target.value)}
                className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder={t("new.notesPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* CATEGORIA */}
              <div id="tour-transactions-category" className="space-y-2">
                <div className="flex items-center justify-start gap-2">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <Tag className="h-4 w-4 text-zinc-400" /> {t("common.category")}
                  </Label>
                  <button
                    id="tour-transactions-category-manage"
                    type="button"
                    onClick={handleOpenCategoryManager}
                    disabled={isPlatformTourActive}
                    className="text-xs font-semibold text-primary hover:text-primary/80 flex items-center gap-1 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Settings2 className="h-4 w-4" /> {t("common.manage")}
                  </button>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-12 rounded-xl font-medium">
                    <SelectValue placeholder={t("common.select")} />
                  </SelectTrigger>
                  <SelectContent>
                    {monthCategories.map((cat) => (
                      <SelectItem key={cat.name} value={cat.name}>
                        <CategoryLabel value={cat.name} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DATA */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                  <Calendar className="h-4 w-4 text-zinc-400" /> {t("common.purchaseDate")}
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
                  <CreditCard className="h-4 w-4 text-zinc-400" /> {t("common.paymentMethod")}
                </Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger className="h-12 rounded-xl font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* DATA DE VENCIMENTO (Condicional) */}
              {showDueDateInput && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <Calendar className="h-4 w-4 text-zinc-400" /> {t("common.dueDate")}
                  </Label>
                  <Input 
                    type="date" 
                    value={dueDate} 
                    onChange={(e) => setDueDate(e.target.value)} 
                    className="h-12 rounded-xl font-medium"
                  />
                </div>
              )}

              {isCreditCardPayment && (
                <div className="space-y-2 animate-in fade-in zoom-in-95">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <Calendar className="h-4 w-4 text-zinc-400" /> {t("common.invoiceDueDate")}
                  </Label>
                  <div className="flex min-h-12 items-center rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-muted-foreground">
                    {selectedCard?.dueDate
                      ? selectedCard.closingDay
                        ? t("new.creditCardClosingHelp", { closingDay: String(selectedCard.closingDay).padStart(2, "0"), dueDay: String(selectedCard.dueDate).padStart(2, "0") })
                        : t("new.creditCardDueHelp", { dueDay: String(selectedCard.dueDate).padStart(2, "0") })
                      : t("new.creditCardSelectHelp")}
                  </div>
                </div>
              )}

              {/* CARTÃO VINCULADO (Condicional) */}
              {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
                <div className="space-y-2 md:col-span-2 animate-in fade-in slide-in-from-top-2">
                  <Label className="flex items-center gap-2 text-sm font-medium text-foreground/85">
                    <ReceiptText className="h-4 w-4 text-zinc-400" /> {t("common.linkedCard")}
                  </Label>
                  <Select
                    value={selectedCardId}
                    onValueChange={setSelectedCardId}
                  >
                    <SelectTrigger className="h-12 rounded-xl font-medium">
                      <SelectValue placeholder={t("new.cardPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePaymentCards.length === 0 ? (
                        <SelectItem value="__none" disabled>{t("new.noCards")}</SelectItem>
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

            {/* OPÇÕES AVANÇADAS: RECORRÊNCIA E PARCELAMENTO */}
            <div className="pt-6 mt-6 space-y-4 border-t border-border/70">
              <button
                id="tour-transactions-advanced"
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-muted/30 px-4 py-3 text-left"
                onClick={() => setShowAdvancedOptions((value) => !value)}
              >
                <span>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500">{t("new.advanced.title")}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{t("new.advanced.description")}</span>
                </span>
                <Settings2 className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvancedOptions ? "rotate-45" : ""}`} />
              </button>
              {showAdvancedOptions && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              
              {/* ASSINATURA / FIXA (Disponível para Receita e Despesa) */}
              <div id="tour-transactions-recurring" className={`cursor-pointer rounded-2xl border p-4 transition-all duration-300 ${isRecurring ? 'border-primary/25 bg-accent text-accent-foreground ring-1 ring-primary/10' : 'app-panel-subtle hover:border-primary/20'}`} onClick={() => handleToggleRecurring(!isRecurring)}>
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2 text-sm font-medium cursor-pointer text-foreground/85">
                    <Repeat className={`h-4 w-4 ${isRecurring ? 'text-primary' : 'text-zinc-400'}`} /> 
                    {t("new.advanced.recurringTitle")}
                  </Label>
                  <Switch className="data-[state=checked]:bg-primary" checked={isRecurring} onCheckedChange={handleToggleRecurring} onClick={(e) => e.stopPropagation()} />
                </div>
                {isRecurring && (
                  <p className="mt-2 ml-6 animate-in fade-in text-xs text-primary">
                    {t("new.advanced.recurringActive", { date: showDueDateInput ? dueDate : date })}
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
                      {t("new.advanced.installmentTitle")}
                    </Label>
                    <Switch checked={isInstallment} disabled={!canUseInstallments} onCheckedChange={handleToggleInstallment} onClick={(e) => e.stopPropagation()} />
                  </div>

                  {!canUseInstallments && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/8 px-3 py-3 text-sm text-primary">
                      <p className="flex items-center gap-2 font-semibold">
                        <Crown className="h-4 w-4 text-primary" />
                        {t("new.advanced.premiumTitle")}
                      </p>
                      <p className="mt-1 text-xs text-primary/80">
                        {t("new.advanced.premiumDescription")}
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
                        {t("new.advanced.viewPlans")}
                      </Button>
                    </div>
                  )}

                  {canUseInstallments && isInstallment && (
                    <div className="pt-4 mt-3 border-t border-primary/12 animate-in fade-in slide-in-from-top-2" onClick={(e) => e.stopPropagation()}>
                      <Label className="text-zinc-500 text-xs mb-1.5 block">{t("new.advanced.countLabel")}</Label>
                      <Input
                        type="number"
                        min={2}
                        max={360}
                        value={installmentsCount}
                        onChange={(e) => setInstallmentsCount(e.target.value)}
                        placeholder={t("new.advanced.countPlaceholder")}
                        className="h-11 rounded-xl border-primary/20 font-medium"
                      />
                      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/8 px-3 py-3">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <Label htmlFor="installment-split-mode" className="text-sm font-semibold text-primary">
                              {t("new.advanced.splitModeLabel")}
                            </Label>
                            <p className="mt-1 text-xs text-primary/80">
                              {t("new.advanced.splitModeDescription")}
                            </p>
                          </div>
                          <Switch
                            id="installment-split-mode"
                            checked={installmentValueMode === "split_total"}
                            onCheckedChange={(checked) => setInstallmentValueMode(checked ? "split_total" : "repeat_value")}
                          />
                        </div>
                      </div>
                    </div>
                  )}
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
            {t("common.cancel")}
          </Button>
          <Button
            id="tour-transactions-submit"
            onClick={onSubmit}
            disabled={saving}
            className="h-14 sm:flex-2 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm text-base hover:cursor-pointer"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> {t("common.saving")}
              </span>
            ) : (
              <span className="flex items-center gap-2">{saving ? <><div className="h-10 w-10 rounded-full border-4 border-white/30 border-t-white animate-spin" /> {t("common.saving")}</> : <><Plus className="h-5 w-5" /> {t("new.actions.add")}</>}</span>
            )}
          </Button>
        </div>

      </div>

      <CategoryManagerDialog
        open={isPlatformTourActive ? false : isCategoryManagerOpen}
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
