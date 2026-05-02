"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { usePlans } from "@/hooks/usePlans";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { CATEGORY_PATH_SEPARATOR, useCategories } from "@/hooks/useCategories";
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  toggleTransactionStatus,
  cancelFutureInstallments,
} from "@/services/transactionService";
import AreaChart from "@/components/charts/AreaChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Plus, TrendingDown, TrendingUp, Eye, EyeOff,
  DollarSign, CalendarDays, MoreHorizontal, Pencil, Trash2,
  AlertCircle, Layers, Calendar, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, XCircle, Crown, Search, HelpCircle, CheckCircle2,
  Medal, Info, AlertTriangle,
  Calculator,
  Tag, Settings, Repeat
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { InstallmentValueMode, PaymentMethod, Transaction, TransactionType } from "@/types/transaction";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { confirmPreapproval } from "@/services/billingService";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOnboarding } from "@/hooks/useOnboarding";
import { Checkbox } from "@/components/ui/checkbox";
import { getPlanCapabilities } from "@/lib/plans/capabilities";
import { getOnboardingStepHref } from "@/lib/onboarding/flow";
import { buildInstallmentPlan } from "@/lib/transactions/installments";
import { getCurrentMonthKey, getMonthKey } from "@/lib/transactions/recurring";
import { buildUpgradeCheckoutPath } from "@/services/billing/checkoutIntent";

const PAYMENT_METHODS: { value: PaymentMethod; label: string, hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: false },
];

const formatDateDisplay = (dateString: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('pt-BR', options);
};

const ITEMS_PER_PAGE = 12;
const FREE_PLAN_LIMIT = 20;
const CHECKIN_MODAL_COOLDOWN_MS = 60 * 60 * 1000; // 1 hora

// Tipo para feedback genérico (validação de pagamento)
type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

const LEGACY_SUB_PREFIX = /^\s*[\*\-⬢]\s*/;

const toSafeCategory = (value: unknown) => (typeof value === "string" ? value : "");
const isLegacySubcategory = (value: unknown) => {
  const safe = toSafeCategory(value);
  return LEGACY_SUB_PREFIX.test(safe) && !safe.includes(CATEGORY_PATH_SEPARATOR);
};
const isLinkedSubcategory = (value: unknown) => toSafeCategory(value).includes(CATEGORY_PATH_SEPARATOR);
const isSubcategory = (value: unknown) => isLinkedSubcategory(value) || isLegacySubcategory(value);
const isOthersCategory = (value: unknown) => toSafeCategory(value) === "Outros";

const getSubcategoryName = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(value)) {
    const parts = safe.split(CATEGORY_PATH_SEPARATOR);
    return parts.slice(1).join(CATEGORY_PATH_SEPARATOR);
  }
  return safe.replace(LEGACY_SUB_PREFIX, "");
};

const getCategoryRoot = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(safe)) return safe.split(CATEGORY_PATH_SEPARATOR)[0];
  if (isLegacySubcategory(value)) return "";
  return safe;
};

const formatCategoryLabel = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(value)) {
    return `${getCategoryRoot(value)} > ${getSubcategoryName(value)}`;
  }
  if (isLegacySubcategory(value)) {
    return `⬢ ${getSubcategoryName(value)}`;
  }
  return safe;
};

const normalizeCardTypeForTransaction = (
  cardType: PaymentCard["type"] | undefined,
  method: PaymentMethod
): "credit_card" | "debit_card" | undefined => {
  if (cardType === "credit_card" || cardType === "debit_card") return cardType;
  if (method === "credit_card" || method === "debit_card") return method;
  return undefined;
};

const orderCategoryNames = (names: unknown[]) => {
  const unique = Array.from(new Set(names.map((name) => toSafeCategory(name).trim()).filter(Boolean)));
  const roots = unique.filter((name) => !isSubcategory(name));
  const linkedSubs = unique.filter((name) => isLinkedSubcategory(name));
  const legacySubs = unique.filter((name) => isLegacySubcategory(name));

  const groupedRootSet = new Set(linkedSubs.map((sub) => getCategoryRoot(sub)));

  const simpleRoots = roots
    .filter((root) => !isOthersCategory(root) && !groupedRootSet.has(root))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const groupedRoots = roots
    .filter((root) => !isOthersCategory(root) && groupedRootSet.has(root))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const groupedTree = groupedRoots.flatMap((root) => {
    const children = linkedSubs
      .filter((sub) => getCategoryRoot(sub) === root)
      .sort((a, b) => getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR"));
    return [root, ...children];
  });

  const orphanLinked = linkedSubs
    .filter((sub) => !roots.includes(getCategoryRoot(sub)))
    .sort((a, b) => {
      const rootCompare = getCategoryRoot(a).localeCompare(getCategoryRoot(b), "pt-BR");
      if (rootCompare !== 0) return rootCompare;
      return getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR");
    });

  const orphanLegacy = legacySubs.sort((a, b) => getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR"));
  const others = roots.filter((root) => isOthersCategory(root));

  return [...simpleRoots, ...groupedTree, ...orphanLinked, ...orphanLegacy, ...others];
};

export default function DashboardPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, userProfile, privacyMode, togglePrivacyMode } = useAuth();
  const { transactions, loading } = useTransactions();
  const { plans } = usePlans();
  const { featureAccess } = useFeatureAccess();
  const {
    categories,
    defaultCategories,
    addNewCategory,
    deleteCategory,
    renameCategory,
    toggleDefaultCategoryVisibility,
  } = useCategories();
  const isBillingExemptRole = userProfile?.role === "admin" || userProfile?.role === "moderator";
  const effectivePlan = userProfile?.plan || "free";
  const effectivePlanCapabilities = getPlanCapabilities(effectivePlan, plans, featureAccess);
  const {
    status: onboardingStatus,
    loading: onboardingLoading,
    dismiss: dismissOnboarding,
    completeTour,
    activeStep: onboardingActiveStep,
    isActive: isOnboardingActive,
  } = useOnboarding();
  const shouldForceTour = searchParams.get("tour") === "1";
  usePlatformTour({
    route: "dashboard",
    disabled: onboardingLoading || isOnboardingActive,
    hasSeen: onboardingStatus.tourCompleted,
    forceStart: shouldForceTour,
    stepVisibility: {
      monthlyForecast: isBillingExemptRole || effectivePlanCapabilities.hasMonthlyForecast,
      smartDailyLimit: isBillingExemptRole || effectivePlanCapabilities.hasSmartDailyLimit,
    },
    onComplete: completeTour,
  });

  // --- 1. STATES ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [isMonthBootstrapped, setIsMonthBootstrapped] = useState(false);

  // Filtros do Extrato
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "pending">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  // Form States
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit_card");
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [selectedPaymentCardId, setSelectedPaymentCardId] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [installmentValueMode, setInstallmentValueMode] = useState<InstallmentValueMode>("split_total");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modais
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [bulkDeleteTargetIds, setBulkDeleteTargetIds] = useState<string[] | null>(null);
  const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState<string[]>([]);
  const [txToCancelSubscription, setTxToCancelSubscription] = useState<Transaction | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason] = useState<"transactions" | "installments">("transactions");
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);
  const [isRecoveringBilling, setIsRecoveringBilling] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingCheckins, setPendingCheckins] = useState<Transaction[]>([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [hasRunCheckin, setHasRunCheckin] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });
  const [isNewCategoryOpen, setIsNewCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryMode, setNewCategoryMode] = useState<"root" | "sub">("root");
  const [newCategoryParent, setNewCategoryParent] = useState("");
  const [deletingCategoryName, setDeletingCategoryName] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState<string | null>(null);
  const [editingCategoryInput, setEditingCategoryInput] = useState("");
  const [editingCategoryParent, setEditingCategoryParent] = useState("");
  const [renamingCategoryName, setRenamingCategoryName] = useState<string | null>(null);
  const [customParentFilter, setCustomParentFilter] = useState<string>("all");

  const checkinStorageKey = useMemo(() => (
    user ? `wevenfinance:last-checkin-modal:${user.uid}` : "wevenfinance:last-checkin-modal:anonymous"
  ), [user]);

  const handleOpenCardFromTransaction = (cardId: string) => {
    if (!cardId) return;
    try {
      window.localStorage.setItem("wevenfinance:cards:selectedCardId", cardId);
    } catch { }
    router.push(`/cards?cardId=${encodeURIComponent(cardId)}`);
  };

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";

  // Helper para formatar moeda com privacidade
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Helper para display na UI (com blur)
  const formatCurrencyDisplay = (value: number) => {
    if (privacyMode) return "R$ ******";
    return formatCurrency(value);
  };

  // --- 2. LIMPAR FLAG DE TOUR NA URL ---
  useEffect(() => {
    if (shouldForceTour) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("tour");
      const nextHref = params.toString() ? `${pathname}?${params.toString()}` : pathname;
      router.replace(nextHref);
    }
  }, [pathname, router, searchParams, shouldForceTour]);

  // --- 3. CHECK-IN DIÁRIO (Pop-up Inteligente) ---
  useEffect(() => {
    if (loading || !user || hasRunCheckin || isOnboardingActive) return;

    if (transactions.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
      const toCheck = transactions.filter(t => {
        return t.status === 'pending' && t.dueDate <= todayStr;
      });

      if (toCheck.length > 0) {
        const now = Date.now();
        const lastShownRaw = window.localStorage.getItem(checkinStorageKey);
        const lastShown = lastShownRaw ? Number(lastShownRaw) : 0;
        const canShowModal = !lastShown || Number.isNaN(lastShown) || (now - lastShown) >= CHECKIN_MODAL_COOLDOWN_MS;

        if (canShowModal) {
          setPendingCheckins(toCheck);
          setShowCheckinModal(true);
          window.localStorage.setItem(checkinStorageKey, String(now));
        }
      }

      setHasRunCheckin(true);
    }
  }, [transactions, loading, user, hasRunCheckin, checkinStorageKey, isOnboardingActive]);

  useEffect(() => {
    if (!isOnboardingActive || !showCheckinModal) return;
    setShowCheckinModal(false);
  }, [isOnboardingActive, showCheckinModal]);

  // --- 4. MEMOS ---

  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    monthsSet.add(new Date().toISOString().slice(0, 7));
    transactions.forEach(t => { if (t.dueDate) monthsSet.add(t.dueDate.slice(0, 7)); });
    return Array.from(monthsSet).sort().map(monthStr => {
      const [year, month] = monthStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, 2);
      const label = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return { value: monthStr, label: label.charAt(0).toUpperCase() + label.slice(1) };
    });
  }, [transactions]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const paidCurrentBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.status === 'paid') {
        return t.type === 'income' ? acc + t.amount : acc - t.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  const overduePendingNet = useMemo(() => {
    return transactions
      .filter((t) => t.status !== "paid" && typeof t.dueDate === "string" && t.dueDate < todayStr)
      .reduce((acc, t) => (t.type === "income" ? acc + t.amount : acc - t.amount), 0);
  }, [transactions, todayStr]);

  const realCurrentBalance = useMemo(() => {
    return paidCurrentBalance + overduePendingNet;
  }, [paidCurrentBalance, overduePendingNet]);

  const selectedMonthEnd = selectedMonth + "-31";

  const projectedAccumulatedBalance = useMemo(() => {
    const pendingTransactions = transactions.filter(t => {
      if (t.status === 'paid') return false;
      if (typeof t.dueDate !== "string") return false;
      if (t.dueDate < todayStr) return false; // Já considerado no Saldo Atual
      return t.dueDate <= selectedMonthEnd;
    });
    const pendingNet = pendingTransactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
    return realCurrentBalance + pendingNet;
  }, [transactions, realCurrentBalance, selectedMonthEnd, todayStr]);

  // Filtra categorias baseado no estado (lista dinâmica do Hook)
  const availableCategories = useMemo(() => {
    return categories.filter(c => c.type === type || c.type === 'both');
  }, [type, categories]);

  const orderedAvailableCategories = useMemo(() => {
    const byName = new Map(availableCategories.map((cat) => [cat.name, cat]));
    return orderCategoryNames(availableCategories.map((cat) => cat.name))
      .map((name) => byName.get(name))
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));
  }, [availableCategories]);

  const allRootCategories = useMemo(() => {
    return categories
      .filter((cat) => !isSubcategory(cat.name))
      .sort((a, b) => {
        if (isOthersCategory(a.name)) return 1;
        if (isOthersCategory(b.name)) return -1;
        return a.name.localeCompare(b.name, "pt-BR");
      });
  }, [categories]);

  const customCategories = useMemo(() => {
    const custom = categories.filter((cat) => cat.isCustom);
    const byName = new Map(custom.map((cat) => [cat.name, cat]));
    return orderCategoryNames(custom.map((cat) => cat.name))
      .map((name) => byName.get(name))
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));
  }, [categories]);

  const filteredCustomCategories = useMemo(() => {
    if (customParentFilter === "all") return customCategories;
    return customCategories.filter((cat) => {
      if (!isSubcategory(cat.name)) return cat.name === customParentFilter;
      return getCategoryRoot(cat.name) === customParentFilter;
    });
  }, [customCategories, customParentFilter]);

  const transactionsThisMonthCount = useMemo(() => {
    return transactions.filter((t) => typeof t.dueDate === "string" && t.dueDate.startsWith(selectedMonth)).length;
  }, [transactions, selectedMonth]);

  const showDueDateInput = useMemo(() => {
    const method = PAYMENT_METHODS.find(pm => pm.value === paymentMethod);
    return method ? method.hasDueDate : false;
  }, [paymentMethod]);

  const availablePaymentCards = useMemo(() => {
    if (paymentMethod !== "credit_card" && paymentMethod !== "debit_card") return [];
    return paymentCards;
  }, [paymentCards, paymentMethod]);

  const selectedPaymentCard = useMemo(
    () => paymentCards.find((card) => card.id === selectedPaymentCardId),
    [paymentCards, selectedPaymentCardId]
  );

  const getLinkedCardTransactions = useCallback((card: PaymentCard) => {
    return transactions.filter((tx) => {
      if (tx.type !== "expense") return false;
      if (tx.cardId && tx.cardId === card.id) return true;
      const label = String(tx.cardLabel || "").toLowerCase();
      return label.includes(card.last4) && label.includes(card.bankName.toLowerCase());
    });
  }, [transactions]);

  const selectedCardIndicator = useMemo(() => {
    if (!selectedPaymentCard) return null;

    const linkedTransactions = getLinkedCardTransactions(selectedPaymentCard);

    if (paymentMethod === "debit_card") {
      return {
        kind: "debit" as const,
        label: "Saldo disponível para débito",
        value: realCurrentBalance,
      };
    }

    const currentMonthKey = getCurrentMonthKey();
    const pendingCredit = linkedTransactions
      .filter((tx) => tx.paymentMethod === "credit_card" && tx.status === "pending")
      .filter((tx) => getMonthKey(tx.dueDate || tx.date) === currentMonthKey);
    const used = pendingCredit.reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    const limit = Number(selectedPaymentCard.creditLimit || 0);
    const remaining = limit - used;

    return {
      kind: "credit" as const,
      label: "Limite restante deste cartão",
      value: remaining,
      used,
      limit,
    };
  }, [selectedPaymentCard, paymentMethod, realCurrentBalance, getLinkedCardTransactions]);

  const filteredStatementTransactions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return transactions
      .filter((tx) => typeof tx.dueDate === "string" && tx.dueDate.startsWith(selectedMonth))
      .filter((tx) => !optimisticallyDeletedIds.includes(String(tx.id || "")))
      .filter((tx) => filterType === "all" || tx.type === filterType)
      .filter((tx) => filterStatus === "all" || tx.status === filterStatus)
      .filter((tx) => filterCategory === "all" || tx.category === filterCategory)
      .filter((tx) => {
        if (!normalizedSearch) return true;
        const description = String(tx.description || "").toLowerCase();
        const amount = String(tx.amount || "").toLowerCase();
        return description.includes(normalizedSearch) || amount.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const dueCompare = String(b.dueDate || "").localeCompare(String(a.dueDate || ""));
        if (dueCompare !== 0) return dueCompare;
        const createdCompare = String(b.date || "").localeCompare(String(a.date || ""));
        if (createdCompare !== 0) return createdCompare;
        return String(b.id || "").localeCompare(String(a.id || ""));
      });
  }, [transactions, selectedMonth, filterType, filterStatus, filterCategory, searchTerm, optimisticallyDeletedIds]);

  const pagedTransactions = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredStatementTransactions.slice(start, start + ITEMS_PER_PAGE);
  }, [currentPage, filteredStatementTransactions]);

  const currentPageSelectableIds = useMemo(
    () => pagedTransactions.map((tx) => String(tx.id || "")).filter(Boolean),
    [pagedTransactions]
  );

  const bulkDeleteTransactions = useMemo(() => {
    const selectedIdSet = new Set(bulkDeleteTargetIds || []);
    return transactions.filter((tx) => {
      const id = String(tx.id || "");
      return id && selectedIdSet.has(id);
    });
  }, [bulkDeleteTargetIds, transactions]);

  const showAutomaticInsights = false;
  const monthlyInsights: {
    biggestExpense: Transaction | null;
    topRisk: { card: PaymentCard; usagePct: number } | null;
  } = {
    biggestExpense: null,
    topRisk: null,
  };

  const validateCardLimitBeforeSave = ({
    card,
    method,
    amountTotal,
    excludeIds = [],
  }: {
    card: PaymentCard;
    method: PaymentMethod;
    amountTotal: number;
    excludeIds?: string[];
  }) => {
    if (amountTotal <= 0) return { ok: true as const };
    if (method === "debit_card") {
      if (amountTotal > realCurrentBalance) {
        return {
          ok: false as const,
          title: "Saldo insuficiente no débito",
          message: `Saldo disponível: ${formatCurrency(realCurrentBalance)}. Valor informado: ${formatCurrency(amountTotal)}.`,
        };
      }
      return { ok: true as const };
    }

    if (method !== "credit_card") return { ok: true as const };
    const linked = getLinkedCardTransactions(card);
    const currentMonthKey = getCurrentMonthKey();
    const usedPending = linked
      .filter((tx) => tx.status === "pending" && !excludeIds.includes(String(tx.id || "")))
      .filter((tx) => getMonthKey(tx.dueDate || tx.date) === currentMonthKey)
      .reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    const limit = Number(card.creditLimit || 0);
    const remaining = limit - usedPending;
    if (amountTotal > remaining) {
      return {
        ok: false as const,
        title: "Limite insuficiente no cartão",
        message: `Limite restante em ${card.bankName} **** ${card.last4}: ${formatCurrency(remaining)}. Valor informado: ${formatCurrency(amountTotal)}.`,
      };
    }
    return { ok: true as const };
  };

  const chartData = useMemo(() => {
    const monthlyGroups: Record<string, number> = {};

    transactions.forEach(t => {
      if (!t.dueDate || typeof t.dueDate !== "string") return;
      const monthKey = t.dueDate.slice(0, 7);
      const val = t.type === 'expense' ? -t.amount : t.amount;

      if (!monthlyGroups[monthKey]) monthlyGroups[monthKey] = 0;
      monthlyGroups[monthKey] += val;
    });

    const sortedKeys = Object.keys(monthlyGroups).sort();

    return sortedKeys.map(key => {
      const [year, month] = key.split('-').map(Number);
      const date = new Date(year, month - 1, 2);
      const label = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '').replace(' de ', '/');

      return {
        name: label.charAt(0).toUpperCase() + label.slice(1),
        amount: monthlyGroups[key]
      };
    });
  }, [transactions]);

  const editingGroupTransactions = useMemo(() => {
    const groupId = editingTx?.groupId;
    if (!groupId) return [];
    return transactions
      .filter((tx) => tx.groupId === groupId)
      .sort((a, b) => Number(a.installmentCurrent || 0) - Number(b.installmentCurrent || 0));
  }, [transactions, editingTx?.groupId]);

  // --- 5. EFFECTS ---

  useEffect(() => {
    if (isMonthBootstrapped) return;
    const monthFromUrl = searchParams.get("month");
    if (monthFromUrl && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthFromUrl)) {
      setSelectedMonth(monthFromUrl);
    }
    setIsMonthBootstrapped(true);
  }, [isMonthBootstrapped, searchParams]);

  useEffect(() => {
    if (!isMonthBootstrapped) return;
    const monthFromUrl = searchParams.get("month");
    if (monthFromUrl !== selectedMonth) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("month", selectedMonth);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [isMonthBootstrapped, pathname, router, searchParams, selectedMonth]);

  useEffect(() => { setCurrentPage(1); }, [selectedMonth, filterType, filterStatus, filterCategory, searchTerm]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredStatementTransactions.length / ITEMS_PER_PAGE));
    setCurrentPage((prev) => Math.min(prev, totalPages));
  }, [filteredStatementTransactions.length]);

  useEffect(() => {
    const validIds = new Set(filteredStatementTransactions.map((tx) => String(tx.id || "")).filter(Boolean));
    setSelectedTransactionIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [filteredStatementTransactions]);

  useEffect(() => {
    const liveIds = new Set(transactions.map((tx) => String(tx.id || "")).filter(Boolean));
    setOptimisticallyDeletedIds((prev) => prev.filter((id) => liveIds.has(id)));
  }, [transactions]);

  useEffect(() => {
    if (!isNewCategoryOpen) return;
    setNewCategoryName("");
    setNewCategoryMode("root");
    setNewCategoryParent("");
    setCustomParentFilter("all");
    setEditingCategoryName(null);
    setEditingCategoryInput("");
    setEditingCategoryParent("");
  }, [isNewCategoryOpen]);

  useEffect(() => {
    if (!user) {
      setPaymentCards([]);
      return;
    }
    const unsubscribe = subscribeToPaymentCards(
      user.uid,
      (cards) => setPaymentCards(cards),
      () => setPaymentCards([])
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (paymentMethod !== "credit_card" && paymentMethod !== "debit_card") {
      setSelectedPaymentCardId("");
      return;
    }
    if (!availablePaymentCards.some((card) => card.id === selectedPaymentCardId)) {
      const fallbackCard =
        paymentCards.find((card) => card.type === paymentMethod || card.type === "credit_and_debit") ||
        availablePaymentCards[0];
      setSelectedPaymentCardId(fallbackCard?.id || "");
      if (fallbackCard && fallbackCard.type !== "credit_and_debit" && fallbackCard.type !== paymentMethod) {
        setPaymentMethod(fallbackCard.type);
      }
    }
  }, [availablePaymentCards, paymentCards, paymentMethod, selectedPaymentCardId]);

  // --- RETORNO CONDICIONAL ---
  if (loading) return <DashboardSkeleton />;

  // --- 6. HANDLERS ---
  const changeType = (newType: TransactionType) => {
    setType(newType);
    setIsInstallment(false);
    setIsRecurring(false);
    setInstallmentsCount("2");
    if (newType === 'income') {
      setCategory("Salário");
      setPaymentMethod("pix");
    } else {
      setCategory("");
      setPaymentMethod("credit_card");
    }
  };

  const handleToggleRecurring = (checked: boolean) => {
    setIsRecurring(checked);
    if (checked) setIsInstallment(false);
  };

  const handleToggleInstallment = (checked: boolean) => {
    if (!isBillingExemptRole && checked && !effectivePlanCapabilities.hasInstallments) {
      setUpgradeReason("installments");
      if (!isOnboardingActive) {
        setShowUpgradeModal(true);
      }
      return;
    }
    setIsInstallment(checked);
    if (checked) setIsRecurring(false);
  };

  const handleGoToOnboardingStep = (step: "firstTransaction" | "firstCard" | "firstGoal" | "profileMenu") => {
    if (step === "profileMenu") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(getOnboardingStepHref(step));
  };

  const changeMonth = (offset: number) => {
    const currentIndex = availableMonths.findIndex(m => m.value === selectedMonth);
    const safeIndex = currentIndex === -1 ? 0 : currentIndex;
    const newIndex = safeIndex + offset;
    if (newIndex >= 0 && newIndex < availableMonths.length) {
      setSelectedMonth(availableMonths[newIndex].value);
    } else {
      const [year, month] = selectedMonth.split('-').map(Number);
      const newDate = new Date(year, month - 1 + offset, 1);
      setSelectedMonth(newDate.toISOString().slice(0, 7));
    }
  };

  const canGoBack = availableMonths.findIndex(m => m.value === selectedMonth) > 0;
  const canGoForward = availableMonths.findIndex(m => m.value === selectedMonth) < availableMonths.length - 1;
  const handleAdd = async () => {
    const transactionLimit = effectivePlanCapabilities.maxTransactionsPerMonth;

    if (!isBillingExemptRole && transactionLimit !== null && transactionsThisMonthCount >= transactionLimit) {
      setUpgradeReason("transactions");
      setShowUpgradeModal(true);
      return;
    }

    if (!isBillingExemptRole && isInstallment && !effectivePlanCapabilities.hasInstallments) {
      setUpgradeReason("installments");
      setShowUpgradeModal(true);
      return;
    }

    if (!desc || !amount || !category) return;
    const isCardPayment = paymentMethod === "credit_card" || paymentMethod === "debit_card";
    if (isCardPayment && !selectedPaymentCard) {
      setFeedbackModal({
        isOpen: true,
        type: "error",
        title: "Selecione um cartão",
        message: "Cadastre um cartão em /cards e selecione antes de confirmar.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const count = isInstallment ? Math.max(1, Number(installmentsCount || 1)) : 1;
      const typedAmount = Number(amount);
      const installmentPlan = isInstallment
        ? buildInstallmentPlan(typedAmount, count, installmentValueMode)
        : null;
      const totalAmountToReserve = installmentPlan ? installmentPlan.totalAmount : typedAmount;

      if (isCardPayment && selectedPaymentCard) {
        const validation = validateCardLimitBeforeSave({
          card: selectedPaymentCard,
          method: paymentMethod,
          amountTotal: totalAmountToReserve,
        });
        if (!validation.ok) {
          setFeedbackModal({
            isOpen: true,
            type: "error",
            title: validation.title,
            message: validation.message,
          });
          return;
        }
      }

      let transactionDate = date; // Data do Registro (compra ou crédito)
      let transactionDueDate = date; // Data de Vencimento (ou Crédito)

      // Lógica para definir as datas corretamente dependendo do tipo e método de pagamento
      if (type === 'income') {
        // Renda
        transactionDate = dueDate; // Para rendas, a data do crédito é a data principal
        transactionDueDate = dueDate;
      } else {
        // Gasto
        if (showDueDateInput) {
          // Cartão de Crédito/Boleto: Data da Compra (date) != Data de Vencimento (dueDate)
          transactionDate = date;
          transactionDueDate = dueDate;
        } else {
          transactionDate = date;
          transactionDueDate = date;
        }
      }

      await addTransaction(user!.uid, {
        description: desc, // Descrição
        amount: typedAmount,
        type: type, // Tipo (Despesa ou Renda)
        category: category, // Categoria
        paymentMethod: paymentMethod, // Método de Pagamento
        cardId: selectedPaymentCard?.id,
        cardLabel: selectedPaymentCard ? `${selectedPaymentCard.bankName} **** ${selectedPaymentCard.last4}` : undefined,
        cardType: normalizeCardTypeForTransaction(selectedPaymentCard?.type, paymentMethod),
        date: transactionDate, // Data do Gasto (para despesas) ou Data de Crédito (para rendas)
        dueDate: transactionDueDate, // Data de Vencimento (para despesas) ou Data de Crédito (para rendas)
        isInstallment, // Flag de Parcela
        installmentsCount: count, // Número de Parcelas (se aplicável)
        installmentValueMode,
        isRecurring,
      });

      // Resetar form após adicionar
      setDesc("");
      setAmount("");
      setIsInstallment(false);
      setIsRecurring(false);
      setInstallmentsCount("2");
      setInstallmentValueMode("split_total");
      if (isCardPayment) setSelectedPaymentCardId("");
      if (type === 'income') setCategory("Salário");
      setIsFormOpen(false); // Fecha o modal após adicionar
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
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
      setCategory(fullCategoryName);
      setNewCategoryName("");
      setNewCategoryParent("");
      setNewCategoryMode("root");
      setIsNewCategoryOpen(false);
    } catch (error) {
      console.error("Erro ao criar categoria:", error);
    }
  }

  const handleDeleteCategory = async (categoryName: string) => {
    setDeletingCategoryName(categoryName);
    try {
      await deleteCategory(categoryName);
      if (category === categoryName || category.startsWith(`${categoryName}${CATEGORY_PATH_SEPARATOR}`)) {
        setCategory("Outros");
      }
      if (editingTx && (editingTx.category === categoryName || editingTx.category.startsWith(`${categoryName}${CATEGORY_PATH_SEPARATOR}`))) {
        setEditingTx({ ...editingTx, category: "Outros" });
      }
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
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

      if (category === targetName || category.startsWith(`${targetName}${CATEGORY_PATH_SEPARATOR}`)) {
        const suffix = category.slice(targetName.length);
        setCategory(`${nextName}${suffix}`);
      }
      if (editingTx && (editingTx.category === targetName || editingTx.category.startsWith(`${targetName}${CATEGORY_PATH_SEPARATOR}`))) {
        const suffix = editingTx.category.slice(targetName.length);
        setEditingTx({ ...editingTx, category: `${nextName}${suffix}` });
      }

      handleCancelEditCategory();
    } catch (error) {
      console.error("Erro ao editar categoria:", error);
    } finally {
      setRenamingCategoryName(null);
    }
  };

  const handleConfirmDelete = async (deleteGroup: boolean) => {
    if (!user || !txToDelete || !txToDelete.id) return;
    const deletedIds = deleteGroup && txToDelete.groupId
      ? transactions
        .filter((tx) => tx.groupId === txToDelete.groupId)
        .map((tx) => String(tx.id || ""))
        .filter(Boolean)
      : [String(txToDelete.id)];
    setOptimisticallyDeletedIds((prev) => Array.from(new Set([...prev, ...deletedIds])));
    await deleteTransaction(user.uid, txToDelete.id, deleteGroup);
    setSelectedTransactionIds((prev) => prev.filter((id) => id !== String(txToDelete.id)));
    setTxToDelete(null);
  };

  const handleConfirmBulkDelete = async (deleteGroup: boolean) => {
    if (!user || !bulkDeleteTargetIds || bulkDeleteTargetIds.length === 0) return;

    const selectedIdSet = new Set(bulkDeleteTargetIds);
    const selected = transactions.filter((tx) => {
      const id = String(tx.id || "");
      return id && selectedIdSet.has(id);
    });

    if (selected.length === 0) {
      setBulkDeleteTargetIds(null);
      setSelectedTransactionIds([]);
      return;
    }

    if (deleteGroup) {
      const processedGroupIds = new Set<string>();
      const optimisticIds: string[] = [];
      for (const tx of selected) {
        if (!tx.id) continue;
        if (tx.groupId) {
          if (processedGroupIds.has(tx.groupId)) continue;
          processedGroupIds.add(tx.groupId);
          optimisticIds.push(
            ...transactions
              .filter((item) => item.groupId === tx.groupId)
              .map((item) => String(item.id || ""))
              .filter(Boolean)
          );
          continue;
        }
        optimisticIds.push(String(tx.id));
      }
      setOptimisticallyDeletedIds((prev) => Array.from(new Set([...prev, ...optimisticIds])));
      processedGroupIds.clear();
      for (const tx of selected) {
        if (!tx.id) continue;
        if (tx.groupId) {
          if (processedGroupIds.has(tx.groupId)) continue;
          processedGroupIds.add(tx.groupId);
          await deleteTransaction(user.uid, tx.id, true);
          continue;
        }
        await deleteTransaction(user.uid, tx.id, false);
      }
    } else {
      const optimisticIds = selected.map((tx) => String(tx.id || "")).filter(Boolean);
      setOptimisticallyDeletedIds((prev) => Array.from(new Set([...prev, ...optimisticIds])));
      for (const tx of selected) {
        if (!tx.id) continue;
        await deleteTransaction(user.uid, tx.id, false);
      }
    }

    setSelectedTransactionIds([]);
    setBulkDeleteTargetIds(null);
  };

  const handleConfirmCancelSubscription = async () => {
    if (!user || !txToCancelSubscription || !txToCancelSubscription.groupId || !txToCancelSubscription.dueDate) return;
    const description = txToCancelSubscription.description;
    await cancelFutureInstallments(user.uid, txToCancelSubscription.groupId, txToCancelSubscription.dueDate);
    setTxToCancelSubscription(null);
    setFeedbackModal({
      isOpen: true,
      type: "success",
      title: "Recorrência encerrada",
      message: `As próximas cobranças de "${description}" foram removidas.`,
    });
  };

  const handleConfirmEdit = async (updateGroup: boolean) => {
    if (!editingTx || !user || !editingTx.id) return;
    const isCardPayment = editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card";
    if (isCardPayment && !editingTx.cardId) {
      setFeedbackModal({
        isOpen: true,
        type: "error",
        title: "Selecione um cartão",
        message: "Cadastre um cartão em /cards e selecione antes de salvar.",
      });
      return;
    }

    if (isCardPayment && editingTx.cardId) {
      const selectedCard = paymentCards.find((card) => card.id === editingTx.cardId);
      if (selectedCard) {
        const groupItems = updateGroup && editingTx.groupId
          ? transactions.filter((tx) => tx.groupId === editingTx.groupId)
          : [editingTx];
        const affectedIds = groupItems.map((tx) => String(tx.id || "")).filter(Boolean);
        const totalAmountToReserve = Math.round(Number(editingTx.amount || 0) * groupItems.length * 100) / 100;

        const validation = validateCardLimitBeforeSave({
          card: selectedCard,
          method: editingTx.paymentMethod,
          amountTotal: totalAmountToReserve,
          excludeIds: affectedIds,
        });
        if (!validation.ok) {
          setFeedbackModal({
            isOpen: true,
            type: "error",
            title: validation.title,
            message: validation.message,
          });
          return;
        }
      }
    }

    // Normalização das datas na edição para manter consistência
    const finalDate = editingTx.date;
    let finalDueDate = editingTx.dueDate;

    const method = PAYMENT_METHODS.find(pm => pm.value === editingTx.paymentMethod);
    const hasDueDate = method ? method.hasDueDate : false;

    if (editingTx.type === 'income') {
      finalDueDate = finalDate;
    } else {
      if (!hasDueDate) {
        finalDueDate = finalDate
      }
    }

    await updateTransaction(user.uid, editingTx.id, {
      description: editingTx.description,
      amount: Number(editingTx.amount),
      category: editingTx.category,
      paymentMethod: editingTx.paymentMethod,
      cardId: editingTx.cardId || undefined,
      cardLabel: editingTx.cardLabel || undefined,
      cardType: editingTx.cardType || undefined,
      dueDate: finalDueDate,
      date: finalDate
    }, updateGroup);

    setIsEditOpen(false);
    setEditingTx(null);
  };

  const handleCheckinAction = async (tx: Transaction, markAsPaid: boolean) => {
    if (!user || !tx.id) return;

    if (markAsPaid && tx.type === 'expense') {
      if (realCurrentBalance < tx.amount) {
        setFeedbackModal({
          isOpen: true,
          type: 'error',
          title: 'Saldo Insuficiente',
          message: `Você possui ${formatCurrency(realCurrentBalance)} em caixa, mas a conta é de ${formatCurrency(tx.amount)}. A operação foi cancelada.`
        });
        return;
      }
    }

    const currentStatus = markAsPaid ? 'pending' : 'paid';
    await toggleTransactionStatus(user.uid, tx.id, currentStatus);

    setFeedbackModal({
      isOpen: true,
      type: 'success',
      title: markAsPaid ? (tx.type === 'income' ? 'Recebido!' : 'Pago!') : (tx.type === 'income' ? 'Cancelado Recebimento' : 'Pagamento Cancelado'),
      message: markAsPaid
        ? `A transação "${tx.description}" foi confirmada com sucesso.`
        : `A transação "${tx.description}" voltou para pendente.`
    });

    const newList = pendingCheckins.filter(p => p.id !== tx.id);
    setPendingCheckins(newList);

    if (newList.length === 0) {
      setShowCheckinModal(false);
    }
  };

  const openEditModal = (tx: Transaction) => {
    if (!tx.id) return;
    router.push(`/transactions/${encodeURIComponent(tx.id)}/edit`);
  };

  // --- COMPONENTE DO FORMULÁRIO ---
  const TransactionFormContent = (
    <div className="space-y-5 pb-3">
      <div className="app-panel-subtle grid grid-cols-2 gap-1 rounded-xl border p-1.5">
        <button onClick={() => changeType('expense')} className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 hover:cursor-pointer ${type === 'expense' ? 'bg-card shadow-sm text-red-600' : 'text-zinc-500 hover:text-zinc-700'}`}>Gasto</button>
        <button onClick={() => changeType('income')} className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 hover:cursor-pointer ${type === 'income' ? 'bg-card shadow-sm text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}>Renda</button>
      </div>
      <div className="space-y-4">
        <div>
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Titulo {type === 'expense' ? 'do Gasto' : 'da Renda'}</Label>
          <Input className="mt-1.5 h-12 rounded-xl" placeholder={type === 'expense' ? "Ex: Netflix" : "Ex: Salário"} value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">
            {isInstallment && installmentValueMode === "repeat_value" ? "Valor por parcela" : "Valor total"}
          </Label>
          <div className="relative mt-1.5">
            <span className="absolute left-3.5 top-3 text-zinc-400 font-semibold">R$</span>
            <Input type="number" className="h-12 rounded-xl pl-10 text-lg font-semibold" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <p className="text-[10px] text-zinc-400 mt-1.5 text-right font-medium">
            {isInstallment
              ? installmentValueMode === "split_total"
                ? "O sistema vai dividir este total pelas parcelas."
                : "O valor digitado sera repetido em cada parcela."
              : isRecurring
                ? "Este valor sera usado como modelo mensal."
                : "Valor único"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-400 ml-1 uppercase">Categoria</Label>
          <div className="flex gap-2">
            <Select onValueChange={setCategory} value={category}>
              <SelectTrigger className="h-12 w-full rounded-xl">
                <SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {orderedAvailableCategories.map((cat) => (
                  <SelectItem key={cat.name} value={cat.name}>
                    {isSubcategory(cat.name) ? `* ${getSubcategoryName(cat.name)}` : cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider delayDuration={0}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => {
                      if (isOnboardingActive && onboardingActiveStep === "firstTransaction") return;
                      setIsNewCategoryOpen(true);
                    }}
                    variant="outline"
                    className="h-12 w-12 rounded-xl shrink-0 p-0 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isOnboardingActive && onboardingActiveStep === "firstTransaction"}
                  >
                    <Settings className="h-5 w-5 text-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="border-primary/40 bg-primary text-primary-foreground font-bold shadow-xl">
                  <p>Gerenciar Categorias</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-400 ml-1 uppercase">Método</Label>
          <Select onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} value={paymentMethod}>
            <SelectTrigger className="h-12 rounded-xl"><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-400 ml-1 uppercase">
            Cartão Vinculado
          </Label>
          <Select
            value={selectedPaymentCardId}
            onValueChange={(value) => {
              setSelectedPaymentCardId(value);
              const card = paymentCards.find((item) => item.id === value);
              if (card && card.type !== "credit_and_debit") {
                setPaymentMethod(card.type);
              }
            }}
          >
            <SelectTrigger className="h-12 rounded-xl">
              <SelectValue placeholder="Selecione um cartão cadastrado em /cards" />
            </SelectTrigger>
            <SelectContent>
              {availablePaymentCards.length === 0 ? (
                <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
              ) : (
                availablePaymentCards.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.bankName} **** {card.last4} ({card.type === "credit_card" ? "Crédito" : card.type === "debit_card" ? "Débito" : "Crédito e Débito"})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {availablePaymentCards.length === 0 && (
            <p className="text-[11px] text-amber-600">
              Cadastre o cartão na página `/cards` para vincular este lançamento.
            </p>
          )}
          {selectedPaymentCard && selectedCardIndicator && (
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${selectedCardIndicator.kind === "debit"
                  ? "border-primary/20 bg-accent text-primary"
                  : selectedCardIndicator.value < 0
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                }`}
            >
              <p className="font-semibold">{selectedCardIndicator.label}: {formatCurrencyDisplay(selectedCardIndicator.value)}</p>
              {selectedCardIndicator.kind === "credit" && (
                <p className="mt-0.5 opacity-90">
                  Limite: {formatCurrencyDisplay(selectedCardIndicator.limit)} ⬢ Usado: {formatCurrencyDisplay(selectedCardIndicator.used)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="app-panel-subtle space-y-4 rounded-xl border p-4">
        <div className="grid grid-cols-2 gap-3">
          {type === 'expense' && (
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data do Gasto</Label>
              <Input type="date" className="h-10 rounded-lg text-xs" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          )}
          {(showDueDateInput || type === 'income') && (
            <div className={`space-y-1.5 ${type === 'income' ? 'col-span-2' : ''}`}>
              <Label className={`text-[10px] font-bold uppercase tracking-wider ${type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>{type === 'expense' ? 'Vencimento' : 'Data Crédito'}</Label>
              <Input type="date" className="h-10 rounded-lg text-xs" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 pt-1">
          <Label htmlFor="recurring-switch" className="text-xs font-medium cursor-pointer flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <Repeat className="h-3.5 w-3.5 text-primary" />
            Lançamento Fixo / Assinatura
          </Label>
          <Switch
            id="recurring-switch"
            className="scale-100 data-[state=checked]:bg-primary"
            checked={isRecurring}
            onCheckedChange={handleToggleRecurring}
          />
        </div>
        {isRecurring && (
          <div className="rounded-xl border border-primary/20 bg-accent px-3 py-3 text-xs text-accent-foreground animate-in fade-in">
            Este lançamento será mantido como recorrência mensal. Apenas a cobrança necessária do mês será criada. Próxima cobrança: {showDueDateInput ? dueDate : date}.
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border/60 pt-1">
          <Label htmlFor="inst-switch" className="text-xs font-medium cursor-pointer flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
            <Layers className="h-3.5 w-3.5 text-primary" />
            {type === 'expense' ? 'Compra Parcelada' : 'Recebimento Parcelado'}
          </Label>
          <Switch
            id="inst-switch"
            className="scale-100 data-[state=checked]:bg-primary"
            checked={isInstallment}
            disabled={!isBillingExemptRole && !effectivePlanCapabilities.hasInstallments}
            onCheckedChange={handleToggleInstallment}
          />
        </div>
        {!isBillingExemptRole && !effectivePlanCapabilities.hasInstallments && (
          <div className="rounded-xl border border-primary/20 bg-accent px-3 py-3 text-xs text-accent-foreground">
            <p className="font-semibold">Parcelamentos disponíveis no Premium e no Pro.</p>
            <p className="mt-1 text-primary">
              Faça upgrade para lançar compras parceladas e acompanhar melhor o fechamento do mês.
            </p>
          </div>
        )}
        {isInstallment && (
          <div className="animate-in slide-in-from-top-2 pt-1">
            <Label className="text-xs font-medium text-zinc-500">
              Numero de parcelas
            </Label>
            <Input type="number" className="mt-1.5 h-10 rounded-lg" min="2" max="60" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} />
            <div className="mt-3 rounded-xl border border-primary/20 bg-accent px-3 py-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="dashboard-installment-split-mode" className="text-sm font-semibold text-accent-foreground">
                    Dividir o valor total
                  </Label>
                  <p className="mt-1 text-xs text-primary">
                    Ative para informar o total da compra. Desative se o valor digitado já for o de cada parcela.
                  </p>
                </div>
                <Switch
                  id="dashboard-installment-split-mode"
                  checked={installmentValueMode === "split_total"}
                  onCheckedChange={(checked) => setInstallmentValueMode(checked ? "split_total" : "repeat_value")}
                />
              </div>
            </div>
          </div>
        )}
      </div>
      <Button onClick={handleAdd} className={`w-full h-12 font-bold text-white shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] hover:cursor-pointer duration-200 ${type === 'expense' ? 'bg-linear-to-r from-red-500 to-orange-500 shadow-red-500/25 hover:shadow-red-500/40' : 'bg-linear-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'}`} disabled={isSubmitting}>{isSubmitting ? "Processando..." : (type === 'expense' ? "Confirmar Despesa" : "Confirmar Receita")}</Button>
      <Button
        variant="ghost"
        onClick={() => setIsFormOpen(false)}
        className="w-full h-12 font-medium bg-red-500 text-white hover:bg-red-600 hover:text-white transition-all hover:cursor-pointer duration-200"
      >
        Cancelar
      </Button>
    </div>
  );

  // --- 7. RENDERIZAO E FILTRAGEM ---

  const monthTransactions = transactions.filter(t => t.dueDate && t.dueDate.startsWith(selectedMonth));

  const totalPages = Math.max(1, Math.ceil(filteredStatementTransactions.length / ITEMS_PER_PAGE));

  const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const monthBalance = monthIncome - monthExpense;
  const effectivePaymentStatus = userProfile?.paymentStatus || "pending";
  const freeLimit = effectivePlanCapabilities.maxTransactionsPerMonth ?? plans.free.limit ?? FREE_PLAN_LIMIT;
  const freeUsagePct = freeLimit > 0 ? (transactionsThisMonthCount / freeLimit) * 100 : 0;
  const overduePendingCount = transactions.filter((t) => t.status === "pending" && typeof t.dueDate === "string" && t.dueDate < todayStr).length;
  const hasBillingIssue =
    !isBillingExemptRole &&
    effectivePlan !== "free" &&
    (effectivePaymentStatus === "pending" || effectivePaymentStatus === "overdue" || effectivePaymentStatus === "not_paid");
  const pendingPreapprovalId = typeof userProfile?.billing?.pendingPreapprovalId === "string" ? userProfile.billing.pendingPreapprovalId : "";
  const pendingPlan = userProfile?.billing?.pendingPlan;
  const recoveryPlan: "premium" | "pro" =
    pendingPlan === "pro" || effectivePlan === "pro" ? "pro" : "premium";
  const selectedMonthLabel =
    availableMonths.find((month) => month.value === selectedMonth)?.label.toLowerCase() ?? selectedMonth;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedYear, selectedMonthNumber] = selectedMonth.split("-").map(Number);
  const daysInSelectedMonth =
    Number.isInteger(selectedYear) && Number.isInteger(selectedMonthNumber)
      ? new Date(selectedYear, selectedMonthNumber, 0).getDate()
      : 0;
  const remainingDaysInSelectedMonth =
    selectedMonth < currentMonthKey
      ? 0
      : selectedMonth === currentMonthKey
        ? Math.max(1, daysInSelectedMonth - new Date().getDate() + 1)
        : daysInSelectedMonth;
  const smartDailyLimit =
    effectivePlanCapabilities.hasSmartDailyLimit && remainingDaysInSelectedMonth > 0
      ? projectedAccumulatedBalance / remainingDaysInSelectedMonth
      : null;
  const smartDailyHeadline =
    !effectivePlanCapabilities.hasSmartDailyLimit
      ? ""
      : remainingDaysInSelectedMonth <= 0 || smartDailyLimit === null
        ? "Selecione o mês atual ou um mês futuro"
        : smartDailyLimit > 0.01
          ? `Você pode gastar até ${formatCurrencyDisplay(smartDailyLimit)} hoje`
          : smartDailyLimit < -0.01
            ? "Seu mês já está acima do ideal"
            : "Hoje você está no limite do mês";
  const smartDailyDescription =
    !effectivePlanCapabilities.hasSmartDailyLimit
      ? ""
      : remainingDaysInSelectedMonth <= 0 || smartDailyLimit === null
        ? "Esse cálculo funciona melhor com o mês em andamento para orientar sua decisão diária."
        : smartDailyLimit > 0.01
          ? `Com base na sua previsão atual, esse é o valor diário médio para fechar ${selectedMonthLabel} com controle.`
          : smartDailyLimit < -0.01
            ? `Para terminar ${selectedMonthLabel} sem aperto, reduza cerca de ${formatCurrencyDisplay(Math.abs(smartDailyLimit))} por dia.`
            : `Para fechar ${selectedMonthLabel} com segurança, o ideal é evitar novos gastos hoje.`;

  const upgradePrompt = (() => {
    if (hasBillingIssue) {
      return {
        kind: "billing" as const,
        title: "Seu plano está com pendência de pagamento",
        description: "Regularize a assinatura para manter recursos premium e evitar bloqueios de acesso.",
        ctaPrimary: "Regularizar agora",
      };
    }

    if (!isBillingExemptRole && effectivePlan === "free" && freeUsagePct >= 80) {
      return {
        kind: "upgrade" as const,
        title: "Você está perto do limite do plano grátis",
        description: `Você já usou ${transactionsThisMonthCount}/${freeLimit} lançamentos neste mês.`,
        ctaPrimary: "Fazer upgrade",
        targetPlan: "premium" as const,
      };
    }

    if (!isBillingExemptRole && effectivePlan === "free" && monthlyInsights.topRisk) {
      return {
        kind: "upgrade" as const,
        title: "Seu uso financeiro está evoluindo",
        description: "Upgrade libera mais controle para cartões e crescimento sem limite mensal de lançamentos.",
        ctaPrimary: "Conhecer planos",
        targetPlan: "premium" as const,
      };
    }

    if (!isBillingExemptRole && effectivePlan === "premium") {
      return {
        kind: "upgrade" as const,
        title: "O próximo nível é clareza diária",
        description: "No Pro, o dashboard mostra quanto você ainda pode gastar hoje sem comprometer o fechamento do mês.",
        ctaPrimary: "Conhecer o Pro",
        targetPlan: "pro" as const,
      };
    }

    return null;
  })();

  const getCategoryStyle = (catName: string) => {
    const direct = categories.find(c => c.name === catName);
    if (direct) return direct.color;
    const root = getCategoryRoot(catName);
    return categories.find(c => c.name === root)?.color || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200";
  };

  const handleStartCheckout = async (plan: "premium" | "pro") => {
    if (!user) return;
    if (isBillingExemptRole) {
      setFeedbackModal({
        isOpen: true,
        type: "info",
        title: "Conta isenta",
        message: "Administradores e moderadores não precisam de pagamento.",
      });
      return;
    }

    setIsOpeningCheckout(plan);
    try {
      router.push(buildUpgradeCheckoutPath(plan));
    } catch (error) {
      console.error(error);
      setFeedbackModal({
        isOpen: true,
        type: "error",
        title: "Falha no checkout",
        message: "Não foi possível abrir o pagamento agora.",
      });
    } finally {
      setIsOpeningCheckout(null);
    }
  };

  const handleRecoverPayment = async () => {
    if (!user) return;
    setIsRecoveringBilling(true);
    try {
      const token = await user.getIdToken();
      if (pendingPreapprovalId) {
        const result = await confirmPreapproval(pendingPreapprovalId, token, recoveryPlan);
        setFeedbackModal({
          isOpen: true,
          type: "success",
          title: "Assinatura confirmada",
          message: `Plano atualizado para ${result.targetPlan}.`,
        });
        return;
      }

      router.push(buildUpgradeCheckoutPath(recoveryPlan));
    } catch (error) {
      console.error(error);
      setFeedbackModal({
        isOpen: true,
        type: "error",
        title: "Falha na recuperação",
        message: "Não foi possível regularizar o pagamento agora.",
      });
    } finally {
      setIsRecoveringBilling(false);
    }
  };

  const isOverdue = (tx: Transaction) => {
    if (tx.status === 'paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return tx.dueDate < today;
  };

  const uniqueCategories = orderCategoryNames(transactions.map(t => t.category));

  const renderTransactionActions = (tx: Transaction) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg hover:bg-accent hover:cursor-pointer duration-200">
          <MoreHorizontal className="h-4 w-4 text-zinc-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 p-1 rounded-xl shadow-xl border-zinc-100 dark:border-zinc-800">
        {tx.status === 'pending' && (
          <DropdownMenuItem onClick={() => handleCheckinAction(tx, true)} className="cursor-pointer rounded-lg text-xs font-medium text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50">
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            {tx.type === 'income' ? 'Receber' : 'Pagar'}
          </DropdownMenuItem>
        )}

        {tx.status === 'paid' && (
          <DropdownMenuItem onClick={() => handleCheckinAction(tx, false)} className="cursor-pointer rounded-lg text-xs font-medium text-red-600 focus:text-red-700 focus:bg-red-50">
            <XCircle className="mr-2 h-3.5 w-3.5" />
            {tx.type === 'income' ? 'Não Recebido' : 'Não Pago'}
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => openEditModal(tx)} className="cursor-pointer rounded-lg text-xs font-medium">
          <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
        </DropdownMenuItem>

        {tx.groupId && tx.isRecurring && !tx.recurrenceEnded && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTxToCancelSubscription(tx)} className="text-amber-600 focus:text-amber-700 cursor-pointer rounded-lg text-xs font-medium focus:bg-amber-50 dark:focus:bg-amber-900/20">
              <XCircle className="mr-2 h-3.5 w-3.5" /> Encerrar Assinatura
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem onClick={() => setTxToDelete(tx)} className="text-red-600 focus:text-red-600 cursor-pointer rounded-lg text-xs font-medium focus:bg-red-50 dark:focus:bg-red-900/20">
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderTransactionStatusButton = (tx: Transaction) => {
    const isPending = tx.status === "pending";
    const isIncome = tx.type === "income";
    const label = isPending
      ? (isIncome ? "Receber" : "Pagar")
      : (isIncome ? "Não recebido" : "Não pago");

    return (
      <Button
        type="button"
        size="sm"
        variant={isPending ? "default" : "outline"}
        className={`h-8 rounded-lg px-2 text-[11px] font-semibold ${isPending
            ? "bg-emerald-600 text-white hover:bg-emerald-700"
            : "border-border/70 text-muted-foreground hover:bg-accent hover:text-foreground"
          }`}
        onClick={() => handleCheckinAction(tx, isPending)}
      >
        {label}
      </Button>
    );
  };

  return (
    <div className="min-h-screen font-sans selection:bg-primary/20 selection:text-primary pb-20">

      <main className="container mx-auto p-3 md:p-8 space-y-6 max-w-7xl">

        {/* TOP BAR: TÍTULO + CONTROLES + BOTO NOVA TRANSAO */}
        <div className={`${fadeInUp} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div id="tour-welcome-header">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Visão Geral</h1>
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Gerencie seu fluxo de caixa e previsões.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Botão de Nova Transação (Visível em Mobile e Desktop) */}
            <Button
              id="tour-new-transaction"
              onClick={() => router.push("/transactions/new")}
              className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 active:scale-[0.98] hover:cursor-pointer hover:bg-primary/90 sm:w-auto"
            >
              <Plus className="mr-2 h-4 w-4" /> Nova Transação
            </Button>

            {/* Seletor de Mês */}
            <div id="tour-month-select" className="app-panel-subtle flex items-center justify-between gap-2 rounded-2xl border p-1 shadow-sm w-full sm:w-auto md:justify-start">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-accent disabled:opacity-30 shrink-0 hover:cursor-pointer duration-200" onClick={() => changeMonth(-1)} disabled={!canGoBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-40 h-7 border-none shadow-none focus:ring-0 font-semibold text-sm bg-transparent flex justify-center text-center hover:cursor-pointer duration-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <SelectValue placeholder="Selecione" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {availableMonths.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-accent disabled:opacity-30 shrink-0 hover:cursor-pointer duration-200" onClick={() => changeMonth(1)} disabled={!canGoForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.completed && (
          <Card className={`${fadeInUp} delay-100 app-panel-soft rounded-2xl border border-color:var(--app-panel-border) shadow-lg shadow-primary/10`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" /> Primeiros passos
              </CardTitle>
              <CardDescription>
                Complete o onboarding para liberar o melhor da plataforma.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${(onboardingStatus.progress / onboardingStatus.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-zinc-500">
                Progresso: {onboardingStatus.progress}/{onboardingStatus.total}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleGoToOnboardingStep("firstTransaction")}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${onboardingStatus.steps.firstTransaction
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : onboardingActiveStep === "firstTransaction"
                        ? "border-primary/35 bg-accent text-primary ring-2 ring-ring/35"
                        : "app-panel-subtle hover:border-primary/20 hover:bg-accent/70"
                    }`}
                >
                  {onboardingStatus.steps.firstTransaction ? "✓ " : onboardingActiveStep === "firstTransaction" ? "• " : ""}Primeira transação
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToOnboardingStep("firstCard")}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${onboardingStatus.steps.firstCard
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : onboardingActiveStep === "firstCard"
                        ? "border-primary/35 bg-accent text-primary ring-2 ring-ring/35"
                        : "app-panel-subtle hover:border-primary/20 hover:bg-accent/70"
                    }`}
                >
                  {onboardingStatus.steps.firstCard ? "✓ " : onboardingActiveStep === "firstCard" ? "• " : ""}Primeiro cartão
                </button>
                <button
                  type="button"
                  onClick={() => handleGoToOnboardingStep("firstGoal")}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${onboardingStatus.steps.firstGoal
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : onboardingActiveStep === "firstGoal"
                        ? "border-primary/35 bg-accent text-primary ring-2 ring-ring/35"
                        : "app-panel-subtle hover:border-primary/20 hover:bg-accent/70"
                    }`}
                >
                  {onboardingStatus.steps.firstGoal ? "✓ " : onboardingActiveStep === "firstGoal" ? "• " : ""}Primeira meta
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleGoToOnboardingStep("profileMenu")}
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${onboardingStatus.steps.profileMenu
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : onboardingActiveStep === "profileMenu"
                        ? "border-primary/35 bg-accent text-primary ring-2 ring-ring/35"
                        : "app-panel-subtle hover:border-primary/20 hover:bg-accent/70"
                    }`}
                >
                  {onboardingStatus.steps.profileMenu ? "✓ " : onboardingActiveStep === "profileMenu" ? "• " : ""}Abrir menu da conta (foto no topo)
                </button>
              </div>
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => void dismissOnboarding()} className="text-zinc-500 hover:cursor-pointer">
                  Fechar onboarding
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {showAutomaticInsights && (
          <Card className={`${fadeInUp} delay-120 app-panel-soft rounded-2xl border border-color:var(--app-panel-border) shadow-lg`}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Insights Automáticos</CardTitle>
              <CardDescription className="text-zinc-500">Resumo inteligente do mês selecionado.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="app-panel-subtle rounded-xl border px-3 py-2">
                <p className="text-xs text-zinc-500">Maior gasto do mês</p>
                {monthlyInsights.biggestExpense ? (
                  <p className="text-sm font-semibold text-zinc-900 mt-1">
                    {monthlyInsights.biggestExpense.description} • {formatCurrencyDisplay(monthlyInsights.biggestExpense.amount)}
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-zinc-600 mt-1">Sem despesas no período.</p>
                )}
              </div>
              <div
                className={`rounded-xl border px-3 py-2 ${monthlyInsights.topRisk ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"
                  }`}
              >
                <p className="text-xs text-zinc-500">Risco de estourar limite</p>
                {monthlyInsights.topRisk ? (
                  <p className="text-sm font-semibold text-amber-700 mt-1">
                    {monthlyInsights.topRisk.card.bankName} •••• {monthlyInsights.topRisk.card.last4} em {monthlyInsights.topRisk.usagePct.toFixed(1)}%
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-emerald-700 mt-1">Nenhum cartão em risco no momento.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {upgradePrompt && (
          <Card className={`${fadeInUp} delay-130 border-none shadow-lg rounded-2xl ${upgradePrompt.kind === "billing"
              ? "bg-linear-to-r from-amber-600 to-orange-600 text-white"
              : "bg-primary text-primary-foreground"
            }`}>
            <CardContent className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-bold">{upgradePrompt.title}</p>
                <p className="text-xs text-white/90">
                  {upgradePrompt.description}
                  {overduePendingCount > 0 ? ` Você também tem ${overduePendingCount} lançamento(s) vencido(s).` : ""}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 min-w-fit">
                {upgradePrompt.kind === "billing" ? (
                  <Button
                    className="h-9 bg-card text-amber-700 hover:bg-accent"
                    onClick={() => void handleRecoverPayment()}
                    disabled={isRecoveringBilling}
                  >
                    {isRecoveringBilling ? "Processando..." : upgradePrompt.ctaPrimary}
                  </Button>
                ) : (
                  <>
                    <Button
                      className="h-9 bg-card text-primary hover:bg-accent"
                      onClick={() => handleStartCheckout(upgradePrompt.targetPlan)}
                      disabled={isOpeningCheckout === upgradePrompt.targetPlan}
                    >
                      {isOpeningCheckout === upgradePrompt.targetPlan ? "Abrindo..." : upgradePrompt.ctaPrimary}
                    </Button>
                    <Button
                      className="h-9 bg-card text-primary hover:bg-accent"
                      onClick={() => router.push("/settings?tab=billing")}
                    >
                      Ver planos
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {effectivePlanCapabilities.hasSmartDailyLimit && (
          <Card id="tour-smart-daily-limit" className={`${fadeInUp} delay-140 app-panel-soft text-card-foreground relative rounded-2xl border border-color:var(--app-panel-border) shadow-lg overflow-hidden`}>
            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-primary/12 via-primary/6 to-transparent" />
            <CardContent className="p-5 md:p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-primary">
                  <CalendarDays className="h-4 w-4" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em]">Limite diário inteligente</p>
                </div>
                <p className="text-lg md:text-xl font-bold">{smartDailyHeadline}</p>
                <p className="text-sm text-muted-foreground max-w-2xl">{smartDailyDescription}</p>
              </div>
              <div className="app-panel-subtle rounded-2xl border border-color:var(--app-panel-border) px-4 py-3 min-w-[220px]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Base do cálculo</p>
                <p className="mt-2 text-2xl font-bold">
                  {remainingDaysInSelectedMonth > 0 ? `${remainingDaysInSelectedMonth} dia(s)` : "Mês encerrado"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Restantes para distribuir sua folga prevista.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* --- KPI Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* SALDO EM CAIXA */}
          <Card id="tour-balance-card" className={`${fadeInUp} delay-150 app-panel-soft relative overflow-hidden rounded-2xl border border-color:var(--app-panel-border) shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 group active:scale-[0.99] transition-transform`}>
            <div className="absolute inset-0 bg-linear-to-br from-primary/10 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Saldo Atual (Hoje)</CardTitle>
                <button
                  id="tour-privacy-toggle"
                  type="button"
                  aria-label={privacyMode ? "Mostrar valores" : "Ocultar valores"}
                  onClick={togglePrivacyMode}
                  className="block text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Explicação do saldo atual"
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Dinheiro que realmente entrou menos o que já saiu (Pago/Recebido).</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="rounded-xl bg-primary/10 p-2 text-primary"><DollarSign className="h-5 w-5" /></div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (realCurrentBalance < 0 ? 'text-red-500' : 'text-primary')}`}>
                {formatCurrencyDisplay(realCurrentBalance)}
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">O que você tem hoje (Realizado).</p>
            </CardContent>
          </Card>

          {/* MOVIMENTAÇÃO */}
          <Card id="tour-movement-card" className={`${fadeInUp} delay-300 app-panel-soft relative overflow-hidden rounded-2xl border border-color:var(--app-panel-border) shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20`}>
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/6 to-transparent" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Movimentação (Mês)</CardTitle>
                <button
                  type="button"
                  aria-label={privacyMode ? "Mostrar valores" : "Ocultar valores"}
                  onClick={togglePrivacyMode}
                  className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                >
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="Explicação da movimentação do mês"
                        className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Total de Receitas e Despesas agendadas para este mês.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className={`p-2 rounded-xl ${monthBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                {monthBalance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className="flex flex-col items-start font-bold gap-2 text-xs md:flex-col md:items-start sm:flex-row sm:items-start">
                <span className="text-3xl flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md"><ArrowUpCircle className="w-6 h-6 mr-1" />{formatCurrencyDisplay(monthIncome)}</span>
                <span className="text-3xl font-bold flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md"><ArrowDownCircle className="w-6 h-6 mr-1" />{formatCurrencyDisplay(monthExpense)}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Total de entradas e saídas do mês.</p>
            </CardContent>
          </Card>

          {/* Previsão */}
          {(isBillingExemptRole || effectivePlanCapabilities.hasMonthlyForecast) ? (
            <Card id="tour-forecast-card" className={`${fadeInUp} delay-500 app-panel-soft relative overflow-hidden rounded-2xl border border-color:var(--app-panel-border) shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 ring-2 ${projectedAccumulatedBalance >= 0 ? 'ring-emerald-500/20' : 'ring-red-500/20'}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Previsão de Fechamento</CardTitle>
                  <button
                    type="button"
                    aria-label={privacyMode ? "Mostrar valores" : "Ocultar valores"}
                    onClick={togglePrivacyMode}
                    className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <TooltipProvider>
                    <Tooltip delayDuration={200}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Explicação da previsão de fechamento"
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Cálculo: Saldo Atual + (A Receber - A Pagar) no mês.</p></TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><Calculator className="h-5 w-5" /></div>
              </CardHeader>
              <CardContent className="relative h-full flex flex-col justify-center">
                <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (projectedAccumulatedBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                  {formatCurrencyDisplay(projectedAccumulatedBalance)}
                </div>
                <p className="text-xs text-zinc-400 mt-2 font-medium">Estimativa para o fim do mês.</p>
              </CardContent>
            </Card>
          ) : (
            <Card className={`${fadeInUp} delay-500 app-panel-soft relative overflow-hidden rounded-2xl border border-color:var(--app-panel-border) text-card-foreground shadow-lg shadow-primary/10 md:shadow-xl`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
                <div>
                  <CardTitle className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Previsão de Fechamento</CardTitle>
                  <CardDescription className="text-zinc-500 dark:text-zinc-400">Disponível no Premium e no Pro</CardDescription>
                </div>
                <div className="rounded-xl bg-primary/10 p-2 text-primary"><Calculator className="h-5 w-5" /></div>
              </CardHeader>
              <CardContent className="relative h-full flex flex-col justify-between gap-4">
                <div>
                  <p className="text-xl font-bold tracking-tight">Entenda antes se o mês vai fechar no verde.</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    No Premium, o dashboard mostra sua previsão de fechamento com base no saldo atual, contas a pagar e valores a receber.
                  </p>
                </div>
                <Button
                  className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => handleStartCheckout("premium")}
                  disabled={isOpeningCheckout === "premium"}
                >
                  {isOpeningCheckout === "premium" ? "Abrindo..." : "Liberar previsão"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* --- Layout Principal (Agora coluna única) --- */}
        <div className="w-full space-y-8">

          {/* Gráfico do Fluxo Mensal */}
          <Card className={`${fadeInUp} delay-700 app-panel-soft rounded-2xl border border-color:var(--app-panel-border) shadow-lg shadow-zinc-200/50 dark:shadow-black/20`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Fluxo Mensal</CardTitle>
              <CardDescription className="text-zinc-500">Evolução do saldo ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <AreaChart data={chartData} />
            </CardContent>
          </Card>

          {/* Tabela de Transações */}
          <Card id="tour-transactions-table" className={`${fadeInUp} delay-700 app-panel-soft rounded-2xl border border-color:var(--app-panel-border) shadow-lg shadow-zinc-200/50 dark:shadow-black/20 overflow-hidden`}>
            <CardHeader className="border-b border-color:var(--app-panel-border) py-5 px-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Extrato</CardTitle>
                  <CardDescription>
                    Lançamentos de {formatDateDisplay(selectedMonth + '-02', { month: 'long', year: 'numeric' })}.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2">
                  {/* Campo de Busca */}
                  <div className="relative w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <Input
                      placeholder="Buscar..."
                      className="pl-9 h-9 text-xs rounded-lg"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "income" | "expense")}>
                      <SelectTrigger className="w-[100px] h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="expense">Despesas</SelectItem>
                        <SelectItem value="income">Receitas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "paid" | "pending")}>
                      <SelectTrigger className="w-[200px] h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-full h-9 text-xs rounded-lg"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Categ.</SelectItem>
                        {uniqueCategories.map(c => <SelectItem key={c} value={c}>{isSubcategory(c) ? `* ${getSubcategoryName(c)}` : c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-2 text-xs text-zinc-500">
                  <Checkbox
                    checked={currentPageSelectableIds.length > 0 && currentPageSelectableIds.every((id) => selectedTransactionIds.includes(id))}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedTransactionIds((prev) => Array.from(new Set([...prev, ...currentPageSelectableIds])));
                        return;
                      }
                      setSelectedTransactionIds((prev) => prev.filter((id) => !currentPageSelectableIds.includes(id)));
                    }}
                    className="cursor-pointer"
                  />
                  Selecionar itens desta página
                </label>
                {selectedTransactionIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-zinc-500">
                      {selectedTransactionIds.length} selecionada(s)
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs rounded-lg hover:cursor-pointer duration-200"
                      onClick={() => setSelectedTransactionIds([])}
                    >
                      Limpar seleção
                    </Button>
                    <Button
                      size="sm"
                      className="h-8 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200"
                      onClick={() => setBulkDeleteTargetIds(selectedTransactionIds)}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir selecionadas
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <div className="p-3">
              {pagedTransactions.length === 0 ? (
                <div className="app-panel-subtle flex h-28 items-center justify-center rounded-xl border text-sm text-zinc-400">
                  Nenhum lançamento encontrado com estes filtros.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                  {pagedTransactions.map((tx) => {
                    const overdue = isOverdue(tx);
                    const txId = String(tx.id || "");
                    return (
                      <div key={tx.id} className={`rounded-2xl border p-3 space-y-2.5 ${overdue ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-900/10" : "border-color:var(--app-panel-border) app-panel-subtle"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <Checkbox
                              checked={selectedTransactionIds.includes(txId)}
                              onCheckedChange={(checked) => {
                                if (!txId) return;
                                setSelectedTransactionIds((prev) => {
                                  if (checked) return Array.from(new Set([...prev, txId]));
                                  return prev.filter((id) => id !== txId);
                                });
                              }}
                              className="mt-0.5 cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold truncate ${tx.status === "paid" ? "line-through text-zinc-400" : "text-zinc-800 dark:text-zinc-100"}`}>
                                {tx.description}
                              </p>
                              <p className={`text-xs mt-1 flex items-center gap-1 ${overdue ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}>
                                <CalendarDays className="h-3.5 w-3.5" />
                                {formatDateDisplay(tx.dueDate)}
                                {overdue && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {renderTransactionStatusButton(tx)}
                            {renderTransactionActions(tx)}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getCategoryStyle(tx.category)}`}>
                            {formatCategoryLabel(tx.category)}
                          </span>
                          {tx.cardLabel && (
                            tx.cardId ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCardFromTransaction(tx.cardId as string)}
                                className="rounded-full border border-primary/20 bg-accent px-2 py-0.5 text-[10px] font-medium text-primary transition-colors hover:bg-accent/80"
                              >
                                Cartão: {tx.cardLabel}
                              </button>
                            ) : (
                              <span className="rounded-full border border-primary/20 bg-accent px-2 py-0.5 text-[10px] font-medium text-primary">
                                Cartão: {tx.cardLabel}
                              </span>
                            )
                          )}
                          {tx.groupId && (
                            <span
                              className={`flex items-center text-[10px] px-2 py-0.5 rounded-full border ${tx.isRecurring
                                  ? tx.recurrenceEnded
                                  ? "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-300"
                                    : "border-primary/20 bg-accent text-primary dark:border-primary/20 dark:bg-accent dark:text-primary"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700"
                                }`}
                            >
                              {tx.isRecurring ? <Repeat className="h-3 w-3 mr-1" /> : <Layers className="h-3 w-3 mr-1" />}
                              {tx.isRecurring
                                ? tx.recurrenceEnded
                                  ? "Recorrência encerrada"
                                  : "Recorrência mensal"
                                : `Parcela ${(tx.installmentCurrent || 0)}/${(tx.installmentTotal || 0)}`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-end">
                          <span className={`font-bold text-base tracking-tight ${tx.status === 'paid' ? 'text-zinc-400' : (tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-800 dark:text-zinc-200')}`}>
                            {tx.type === 'expense' ? '- ' : '+ '}
                            {formatCurrencyDisplay(tx.amount)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Paginação Footer */}
            <div className="app-panel-subtle flex items-center justify-between border-t border-border/70 px-6 py-4">
              <div className="text-xs text-zinc-500 font-medium">
                Página {currentPage} de {totalPages || 1}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs disabled:opacity-50 rounded-lg hover:cursor-pointer duration-200"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs disabled:opacity-50 rounded-lg hover:cursor-pointer duration-200"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                >
                  Próximo
                </Button>
              </div>
            </div>
          </Card>

        </div>

        {/* --- DIALOGS (MODAIS) --- */}

        {/* MODAL FORMULÁRIO (UNIFICADO) */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[680px] max-h-[95vh] rounded-2xl sm:rounded-3xl p-0 gap-0 overflow-hidden">
            <div className={`h-2 w-full ${type === 'expense' ? 'bg-red-500' : 'bg-emerald-500'}`} />
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain max-h-[calc(95vh-8px)]">
              <DialogHeader className="flex flex-row items-center justify-between">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  {type === 'expense' ? 'Novo Gasto' : 'Nova Renda'}
                </DialogTitle>
              </DialogHeader>

              <div className="mt-4">
                {TransactionFormContent}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="w-[calc(100vw-1rem)] max-w-[680px] max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl sm:rounded-3xl p-0 gap-0">
            {editingTx && (
              <>
                <div className={`h-2 w-full ${editingTx.type === 'expense' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="p-4 sm:p-6">
                  <DialogHeader className="mb-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-xl flex items-center gap-2">
                        {editingTx.type === 'expense' ? (
                          <div className="p-2 bg-red-100 text-red-600 rounded-full"><TrendingDown className="h-5 w-5" /></div>
                        ) : (
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp className="h-5 w-5" /></div>
                        )}
                        <span>Editar {editingTx.type === 'expense' ? 'Despesa' : 'Receita'}</span>
                      </DialogTitle>
                      {editingTx.groupId && (
                        <span className={`flex items-center text-[10px] px-2 py-1 rounded-full border font-medium ${editingTx.isRecurring
                            ? editingTx.recurrenceEnded
                              ? "bg-slate-50 text-slate-700 border-slate-200"
                              : "border-primary/20 bg-accent text-primary"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}>
                          {editingTx.isRecurring ? <Repeat className="h-3 w-3 mr-1" /> : <Layers className="h-3 w-3 mr-1" />}
                          {editingTx.isRecurring ? (editingTx.recurrenceEnded ? "Encerrada" : "Recorrente") : "Parcelado"}
                        </span>
                      )}
                    </div>
                    <DialogDescription className="mt-1 ml-1">
                      {editingTx.groupId
                        ? editingTx.isRecurring
                          ? "Este item faz parte de uma recorrência mensal."
                          : "Este item faz parte de um parcelamento."
                        : "detalhes da transação única."}
                    </DialogDescription>
                  </DialogHeader>

                  {editingTx.groupId && editingGroupTransactions.length > 0 && (
                    <div className={`mb-5 rounded-xl border p-3 ${editingTx.isRecurring
                        ? "border-primary/20 bg-accent/70"
                        : "border-amber-200 bg-amber-50/70"
                      }`}>
                      <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${editingTx.isRecurring ? "text-primary" : "text-amber-700"
                        }`}>
                        {editingTx.isRecurring ? "Ocorrências desta recorrência" : "Parcelas deste grupo"}
                      </p>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {editingGroupTransactions.map((parcel) => (
                          <div
                            key={parcel.id}
                            className={`text-xs rounded-lg border px-2 py-1.5 flex items-center justify-between ${parcel.id === editingTx.id
                                ? "border-primary/35 bg-accent text-primary"
                                : editingTx.isRecurring
                                  ? "border-primary/20 bg-card text-zinc-600 dark:text-zinc-300"
                                  : "border-amber-200 bg-white text-zinc-600"
                              }`}
                          >
                            <span className="font-medium">
                              {editingTx.isRecurring
                                ? `Ocorrência ${parcel.recurringMonth || String(parcel.dueDate || "").slice(0, 7)}`
                                : `Parcela ${parcel.installmentCurrent || 1}/${parcel.installmentTotal || editingGroupTransactions.length}`}
                            </span>
                            <span>{formatDateDisplay(parcel.dueDate, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                            <span className="font-semibold">{formatCurrencyDisplay(parcel.amount)}</span>
                          </div>
                        ))}
                      </div>
                      <p className={`text-[11px] mt-2 ${editingTx.isRecurring ? "text-primary" : "text-amber-700"}`}>
                        {editingTx.isRecurring
                          ? "Você pode salvar só esta ocorrência ou aplicar a edição para toda a recorrência."
                          : "Você pode salvar só esta parcela ou aplicar a edição para todas."}
                      </p>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Descrição</Label>
                      <Input
                        className="h-11 rounded-xl"
                        value={editingTx.description}
                        onChange={e => setEditingTx({ ...editingTx, description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Valor</Label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-zinc-400 font-semibold">R$</span>
                          <Input
                            type="number"
                            className="h-11 rounded-xl pl-10 text-lg font-semibold"
                            placeholder="0,00"
                            value={editingTx.amount}
                            onChange={e => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Categoria</Label>
                        <div className="flex gap-2">
                          <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                            <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {(() => {
                                const availableForEdit = categories.filter(cat => cat.type === editingTx.type || cat.type === 'both');
                                const byName = new Map(availableForEdit.map((cat) => [cat.name, cat]));
                                return orderCategoryNames(availableForEdit.map((cat) => cat.name))
                                  .map((name) => byName.get(name))
                                  .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat))
                                  .map((cat) => (
                                    <SelectItem key={cat.name} value={cat.name}>
                                      {isSubcategory(cat.name) ? `* ${getSubcategoryName(cat.name)}` : cat.name}
                                    </SelectItem>
                                  ));
                              })()}
                            </SelectContent>
                          </Select>
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  onClick={() => setIsNewCategoryOpen(true)}
                                  variant="outline"
                                  className="h-11 w-11 rounded-xl shrink-0 p-0"
                                >
                                  <Settings className="h-4 w-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="border-primary/40 bg-primary text-primary-foreground font-bold shadow-xl">
                                <p>Gerenciar Categorias</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Método de Pagamento</Label>
                      <Select
                        value={editingTx.paymentMethod}
                        onValueChange={(v) => {
                          const nextMethod = v as PaymentMethod;
                          if (nextMethod !== "credit_card" && nextMethod !== "debit_card") {
                            setEditingTx({ ...editingTx, paymentMethod: nextMethod, cardId: undefined, cardLabel: undefined, cardType: undefined });
                            return;
                          }
                          const fallbackCard = paymentCards.find((card) => card.type === nextMethod || card.type === "credit_and_debit") || paymentCards[0];
                          setEditingTx({
                            ...editingTx,
                            paymentMethod: fallbackCard.type === "credit_card" || fallbackCard.type === "debit_card" ? fallbackCard.type : nextMethod,
                            cardId: fallbackCard.id,
                            cardLabel: fallbackCard ? `${fallbackCard.bankName} **** ${fallbackCard.last4}` : undefined,
                            cardType: normalizeCardTypeForTransaction(fallbackCard.type, nextMethod),
                          });
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {(editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card") && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Cartão Vinculado</Label>
                        <Select
                          value={editingTx.cardId || ""}
                          onValueChange={(value) => {
                            const card = paymentCards.find((item) => item.id === value);
                            if (!card) return;
                            setEditingTx({
                              ...editingTx,
                              paymentMethod: card.type === "credit_and_debit" ? editingTx.paymentMethod : card.type,
                              cardId: card.id,
                              cardLabel: `${card.bankName} **** ${card.last4}`,
                              cardType: normalizeCardTypeForTransaction(card.type, editingTx.paymentMethod),
                            });
                          }}
                        >
                          <SelectTrigger className="h-11 rounded-xl">
                            <SelectValue placeholder="Selecione um cartão cadastrado em /cards" />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentCards.length === 0 ? (
                              <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
                            ) : (
                              paymentCards.map((card) => (
                                <SelectItem key={card.id} value={card.id}>
                                  {card.bankName} **** {card.last4} ({card.type === "credit_card" ? "Crédito" : card.type === "debit_card" ? "Débito" : "Crédito e Débito"})
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="app-panel-subtle rounded-xl border p-4">
                      {editingTx.type === 'income' ? (
                        <div className="w-full space-y-2">
                          <Label className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Data de Crédito</Label>
                          <Input type="date" className="h-10 rounded-lg text-xs" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data Compra</Label>
                            <Input type="date" className="h-10 rounded-lg text-xs" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                          </div>
                          {(editingTx.paymentMethod === 'boleto' || editingTx.paymentMethod === 'credit_card') && (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Vencimento</Label>
                              <Input type="date" className="h-10 rounded-lg border-red-200 text-xs" value={editingTx.dueDate} onChange={e => setEditingTx({ ...editingTx, dueDate: e.target.value })} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3 pb-2">
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto h-11 bg-red-500 text-white hover:bg-red-600 hover:text-white rounded-xl font-medium"
                      onClick={() => setIsEditOpen(false)}
                    >
                      Cancelar
                    </Button>
                    {editingTx.groupId ? (
                      <>
                        <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl font-medium border-zinc-200" onClick={() => handleConfirmEdit(false)}>Salvar Apenas Esta</Button>
                        <Button className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto" onClick={() => handleConfirmEdit(true)}>Salvar Todas</Button>
                      </>
                    ) : (
                      <Button className="h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90 sm:w-auto" onClick={() => handleConfirmEdit(false)}>Salvar Alterações</Button>
                    )}
                  </DialogFooter>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Modal de Exclusão */}
        <Dialog open={!!txToDelete} onOpenChange={(open) => !open && setTxToDelete(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="h-5 w-5" />
                </div>
                Excluir Transação
              </DialogTitle>
              <DialogDescription className="pt-3 text-base">
                Tem certeza Você vai apagar: <br /> <span className="font-bold text-zinc-900 dark:text-white mt-1 block">{txToDelete?.description}</span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="ghost" onClick={() => setTxToDelete(null)}>
                Cancelar
              </Button>

              {txToDelete?.groupId ? (
                <>
                  <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="outline" onClick={() => handleConfirmDelete(false)}>
                    Apenas Esta
                  </Button>
                  <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200" onClick={() => handleConfirmDelete(true)}>
                    Todas as Parcelas
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200" onClick={() => handleConfirmDelete(false)}>
                  Confirmar Exclusão
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!bulkDeleteTargetIds} onOpenChange={(open) => !open && setBulkDeleteTargetIds(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" /> Excluir Selecionadas
              </DialogTitle>
              <DialogDescription className="pt-2 text-base">
                Você selecionou <strong>{bulkDeleteTransactions.length}</strong> lançamento(s).
                {bulkDeleteTransactions.some((tx) => !!tx.groupId)
                  ? " Alguns itens fazem parte de parcelamentos ou recorrências."
                  : " Essa ação não poderá ser desfeita."}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 flex flex-col gap-2">
              {bulkDeleteTransactions.some((tx) => !!tx.groupId) ? (
                <>
                  <Button
                    className="w-full rounded-xl h-10 hover:cursor-pointer duration-200"
                    variant="outline"
                    onClick={() => void handleConfirmBulkDelete(false)}
                  >
                    Excluir apenas os itens selecionados
                  </Button>
                  <Button
                    className="w-full rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200"
                    onClick={() => void handleConfirmBulkDelete(true)}
                  >
                    Excluir também todas as parcelas dos grupos
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200"
                  onClick={() => void handleConfirmBulkDelete(false)}
                >
                  Confirmar exclusao
                </Button>
              )}
              <Button
                className="w-full rounded-xl h-10 hover:cursor-pointer duration-200"
                variant="ghost"
                onClick={() => setBulkDeleteTargetIds(null)}
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Encerrar Recorrência */}
        <Dialog open={!!txToCancelSubscription} onOpenChange={(open) => !open && setTxToCancelSubscription(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-full">
                  <XCircle className="h-5 w-5" />
                </div>
                Encerrar recorrência
              </DialogTitle>
              <DialogDescription className="pt-3 text-base">
                Você vai encerrar a recorrência de <strong>{txToCancelSubscription?.description}</strong>.
                <br /><br />
                A ocorrência de <strong>{formatDateDisplay(txToCancelSubscription?.dueDate || "")}</strong> será a última mantida.
                <br />
                As cobranças futuras serão removidas e este lançamento ficará marcado como encerrado.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="ghost" onClick={() => setTxToCancelSubscription(null)}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto rounded-xl h-10 bg-amber-600 hover:bg-amber-700 text-white hover:cursor-pointer duration-200" onClick={handleConfirmCancelSubscription}>
                Confirmar Encerramento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Check-in Diário */}
        <Dialog open={showCheckinModal} onOpenChange={setShowCheckinModal}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-6 w-6" /> Check-in Diário
              </DialogTitle>
              <DialogDescription className="pt-2 text-base">
                Você tem <strong>{pendingCheckins.length}</strong> contas vencidas ou vencendo hoje. Vamos atualizar
              </DialogDescription>
            </DialogHeader>

            {pendingCheckins.length > 0 && (
              <div className="app-panel-subtle my-2 rounded-xl border p-4">
                <p className="font-semibold text-lg">{pendingCheckins[0].description}</p>
                <p className="text-sm text-zinc-500 mb-2">Venceu em: {formatDateDisplay(pendingCheckins[0].dueDate)}</p>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrencyDisplay(pendingCheckins[0].amount)}
                </div>
              </div>
            )}

            <DialogFooter className="grid grid-cols-2 gap-3 mt-2">
              <Button
                variant="outline"
                className="rounded-xl h-12 hover:cursor-pointer duration-200"
                onClick={() => handleCheckinAction(pendingCheckins[0], false)}
              >
                Ainda Não
              </Button>
              <Button
                className="rounded-xl h-12 bg-green-600 hover:bg-green-700 text-white hover:cursor-pointer duration-200"
                onClick={() => handleCheckinAction(pendingCheckins[0], true)}
              >
                Já Paguei/Recebi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de UPGRADE */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="max-h-[85vh] w-[calc(100vw-2rem)] max-w-[520px] rounded-2xl border-2 border-primary/35 p-6 sm:max-w-md sm:p-8 overflow-y-auto">
            <DialogHeader className="text-center items-center">
              <div className="mb-4 animate-bounce rounded-full bg-primary/10 p-4">
                <Crown className="h-8 w-8 text-primary" />
              </div>

              <DialogTitle className="text-2xl font-bold text-primary">
                Limite Atingido!
              </DialogTitle>

              <DialogDescription className="text-base text-zinc-600 dark:text-zinc-400 mt-2">
                {upgradeReason === "transactions" ? (
                  <>
                    Você atingiu o limite de {freeLimit} lançamentos mensais do plano Grátis.
                    <br /><br />
                    Faça o upgrade para o <strong>Plano Premium ou Pro</strong> e remova esse limite para continuar organizando sua vida financeira.
                  </>
                ) : (
                  <>
                    Parcelamentos estão disponíveis apenas nos planos pagos.
                    <br /><br />
                    Faça o upgrade para o <strong>Plano Premium ou Pro</strong> para lançar compras parceladas e acompanhar melhor o fechamento do mês.
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 w-full">
              <div className="grid grid-cols-2 gap-3 w-full">
                <Button
                  onClick={() => handleStartCheckout("premium")}
                  disabled={isOpeningCheckout === "premium"}
                  variant="outline"
                  className="h-12 w-full rounded-xl border-primary/20 text-primary shadow-lg shadow-primary/15 transition-all duration-400 hover:cursor-pointer hover:bg-accent sm:text-lg font-bold"
                >
                  <Medal className="inline-block h-6 w-6 text-primary" /> {isOpeningCheckout === "premium" ? "Abrindo..." : "Premium"}
                </Button>

                <Button
                  onClick={() => handleStartCheckout("pro")}
                  disabled={isOpeningCheckout === "pro"}
                  className="h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-400 hover:cursor-pointer hover:bg-primary/90 sm:text-lg"
                >
                  <Medal className="inline-block h-6 w-6 text-zinc-100 dark:text-zinc-200" /> {isOpeningCheckout === "pro" ? "Abrindo..." : "Pro"}
                </Button>

                <Button
                  variant="ghost"
                  className="col-span-2 h-12 w-full rounded-xl bg-accent text-primary shadow-lg shadow-primary/10 transition-all duration-400 hover:cursor-pointer hover:bg-accent/80 sm:text-lg"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Continuar no Grátis
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Nova Categoria */}
        <Dialog open={isNewCategoryOpen} onOpenChange={setIsNewCategoryOpen}>
          <DialogContent className="rounded-2xl w-[calc(100vw-1rem)] max-w-[680px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="mx-auto mb-2 w-fit rounded-full bg-primary/10 p-3">
                <Tag className="h-6 w-6 text-primary" />
              </div>
              <DialogTitle className="text-center">Gerenciar Categorias</DialogTitle>
              <DialogDescription className="text-center pt-2">
                Adicione uma nova categoria personalizada para seus lançamentos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={newCategoryMode} onValueChange={(v) => setNewCategoryMode(v as "root" | "sub")}>
                  <SelectTrigger className="rounded-xl h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="root">Categoria principal</SelectItem>
                    <SelectItem value="sub">Subcategoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {newCategoryMode === "sub" && (
                <div className="space-y-2">
                  <Label>Categoria pai</Label>
                  <Select value={newCategoryParent} onValueChange={setNewCategoryParent}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue placeholder="Selecione a categoria pai" />
                    </SelectTrigger>
                    <SelectContent>
                      {allRootCategories.map((cat) => (
                        <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <Label>{newCategoryMode === "sub" ? "Nome da Subcategoria" : "Nome da Categoria"}</Label>
                <Input
                  placeholder={newCategoryMode === "sub" ? "Ex: Reforma" : "Ex: Casa"}
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-2 border-t border-border/70 pt-2">
                <Label>Categorias padrão</Label>
                <p className="text-xs text-zinc-500">Você pode ocultar as categorias padrão sem apagar.</p>
                <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                  {defaultCategories
                    .slice()
                    .sort((a, b) => {
                      if (a.name === "Outros") return 1;
                      if (b.name === "Outros") return -1;
                      return a.name.localeCompare(b.name, "pt-BR");
                    })
                    .map((cat) => {
                      const hidden = cat.name !== "Outros" && !categories.some((c) => c.name === cat.name);
                      return (
                        <div key={`default-${cat.name}`} className="app-panel-subtle flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-medium truncate">{cat.name}</p>
                          <Button
                            type="button"
                            size="sm"
                            className={`h-8 px-2 shrink-0 w-full sm:w-auto text-white ${cat.name === "Outros"
                                ? "bg-primary/75 hover:bg-primary/90"
                                : hidden
                                  ? "bg-emerald-600 hover:bg-emerald-700"
                                  : "bg-amber-500 hover:bg-amber-600"
                              }`}
                            disabled={cat.name === "Outros"}
                            onClick={() => toggleDefaultCategoryVisibility(cat.name, !hidden)}
                          >
                            {cat.name === "Outros" ? "Sempre visível" : hidden ? "Mostrar" : "Ocultar"}
                          </Button>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="space-y-2 border-t border-border/70 pt-2">
                <Label>Gerenciar categorias personalizadas</Label>
                <p className="text-xs text-zinc-500">Ao excluir, lançamentos vinculados são movidos para <strong>Outros</strong>.</p>
                <Select value={customParentFilter} onValueChange={setCustomParentFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Filtrar por categoria pai" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {allRootCategories.map((root) => (
                      <SelectItem key={`filter-${root.name}`} value={root.name}>{root.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                  {filteredCustomCategories.length === 0 && (
                    <p className="text-sm text-zinc-400 py-2">Nenhuma categoria personalizada criada ainda.</p>
                  )}
                  {filteredCustomCategories.map((cat) => {
                    const isEditing = editingCategoryName === cat.name;
                    const sub = isSubcategory(cat.name);
                    const linked = isLinkedSubcategory(cat.name);
                    return (
                      <div key={cat.name} className="app-panel-subtle space-y-2 rounded-lg border px-3 py-2">
                        {isEditing ? (
                          <>
                            <div className="grid grid-cols-1 gap-2">
                              {sub && (
                                <Select value={editingCategoryParent} onValueChange={setEditingCategoryParent}>
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Escolha o pai" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allRootCategories.map((root) => (
                                      <SelectItem key={root.name} value={root.name}>{root.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              <Input value={editingCategoryInput} onChange={(e) => setEditingCategoryInput(e.target.value)} className="h-9" />
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2">
                              <Button type="button" size="sm" className="h-8 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white" onClick={handleCancelEditCategory}>Cancelar</Button>
                              <Button type="button" size="sm" className="h-8 w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white" disabled={renamingCategoryName === cat.name || (sub && !editingCategoryParent)} onClick={() => handleSaveEditCategory(cat.name)}>
                                {renamingCategoryName === cat.name ? "Salvando..." : "Salvar"}
                              </Button>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{formatCategoryLabel(cat.name)}</p>
                              {sub && !linked && (
                                <p className="text-[11px] text-amber-600">Sem pai vinculado</p>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1 shrink-0 sm:justify-end">
                              <Button type="button" size="sm" className="h-8 px-2 w-full sm:w-auto justify-center bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => handleStartEditCategory(cat.name)}>
                                <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                              </Button>
                              <Button type="button" size="sm" className="h-8 px-2 w-full sm:w-auto justify-center bg-red-600 hover:bg-red-700 text-white" disabled={deletingCategoryName === cat.name} onClick={() => handleDeleteCategory(cat.name)}>
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                {deletingCategoryName === cat.name ? "Excluindo..." : "Excluir"}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button onClick={() => setIsNewCategoryOpen(false)} className="rounded-xl w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white">Cancelar</Button>
              <Button onClick={handleCreateCategory} disabled={!newCategoryName.trim() || (newCategoryMode === "sub" && !newCategoryParent)} className="rounded-xl w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white">Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Genérico de Feedback (Validação de Saldo, Sucesso, etc.) */}
        <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => !open && setFeedbackModal({ ...feedbackModal, isOpen: false })}>
          <DialogContent className="rounded-2xl sm:max-w-[400px]">
            <DialogHeader>
              <div className={`mx-auto p-3 rounded-full mb-2 w-fit ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : feedbackModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-primary/10 text-primary'}`}>
                {feedbackModal.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : feedbackModal.type === 'error' ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
              </div>
              <DialogTitle className="text-center">{feedbackModal.title}</DialogTitle>
              <DialogDescription className="text-center pt-2">
                {feedbackModal.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} className="w-full rounded-xl hover:cursor-pointer duration-200">Entendido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}








