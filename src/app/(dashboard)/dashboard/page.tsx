"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { usePlans } from "@/hooks/usePlans";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { CATEGORY_PATH_SEPARATOR, useCategories } from "@/hooks/useCategories";
import {
  deleteTransaction,
  toggleTransactionStatus,
  cancelFutureInstallments,
} from "@/services/transactionService";
import AreaChart from "@/components/charts/AreaChart";
import { CategoryLabel } from "@/components/categories/CategoryLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Plus, TrendingDown, TrendingUp, Eye, EyeOff,
  DollarSign, CalendarDays, MoreHorizontal, Pencil, Trash2,
  AlertCircle, Layers, Calendar, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, XCircle, Crown, Search, HelpCircle, CheckCircle2,
  Medal, Info, AlertTriangle,
  Calculator, FileBarChart2,
  Repeat,
} from "lucide-react";
import { Transaction } from "@/types/transaction";
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
import { buildUpgradeCheckoutPath } from "@/services/billing/checkoutIntent";
import { calculateDailyLimit } from "@/lib/finance/daily-limit";


const formatDateDisplay = (dateString: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('pt-BR', options);
};

const getTransactionTitle = (tx?: Pick<Transaction, "title" | "description"> | null) =>
  String(tx?.title || tx?.description || "");

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

const LEGACY_SUB_PREFIX = /^\s*[\*\-?]\s*/;

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
  const { categories } = useCategories();
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

  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);

  // Modais
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [bulkDeleteTargetIds, setBulkDeleteTargetIds] = useState<string[] | null>(null);
  const [optimisticallyDeletedIds, setOptimisticallyDeletedIds] = useState<string[]>([]);
  const [txToCancelSubscription, setTxToCancelSubscription] = useState<Transaction | null>(null);
  const [deleteAction, setDeleteAction] = useState<"single" | "group" | null>(null);
  const [bulkDeleteAction, setBulkDeleteAction] = useState<"selected" | "groups" | null>(null);
  const [isCancelingSubscription, setIsCancelingSubscription] = useState(false);
  const [checkinAction, setCheckinAction] = useState<"paid" | "pending" | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason] = useState<"transactions" | "installments">("transactions");
  const [isOpeningCheckout, setIsOpeningCheckout] = useState<"premium" | "pro" | null>(null);
  const [isRecoveringBilling, setIsRecoveringBilling] = useState(false);
  const [pendingCheckins, setPendingCheckins] = useState<Transaction[]>([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [hasRunCheckin, setHasRunCheckin] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });

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

  // --- 3. CHECK-IN DI?RIO (Pop-up Inteligente) ---
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
      if (t.dueDate < todayStr) return false;
      return t.dueDate <= selectedMonthEnd;
    });
    const pendingNet = pendingTransactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
    return realCurrentBalance + pendingNet;
  }, [transactions, realCurrentBalance, selectedMonthEnd, todayStr]);

  // Filtra categorias baseado no estado (lista dinámica do Hook)
  const transactionsThisMonthCount = useMemo(() => {
    return transactions.filter((t) => typeof t.dueDate === "string" && t.dueDate.startsWith(selectedMonth)).length;
  }, [transactions, selectedMonth]);

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
        const description = `${getTransactionTitle(tx)} ${tx.description || ""}`.toLowerCase();
        const amount = String(tx.amount || "").toLowerCase();
        return description.includes(normalizedSearch) || amount.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const statusCompare = Number(a.status === "paid") - Number(b.status === "paid");
        if (statusCompare !== 0) return statusCompare;
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

  // --- RETORNO CONDICIONAL ---
  if (loading) return <DashboardSkeleton />;

  // --- 6. HANDLERS ---
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
  const handleConfirmDelete = async (deleteGroup: boolean) => {
    if (!user || !txToDelete || !txToDelete.id) return;
    if (deleteAction) return;
    setDeleteAction(deleteGroup ? "group" : "single");
    const deletedIds = deleteGroup && txToDelete.groupId
      ? transactions
        .filter((tx) => tx.groupId === txToDelete.groupId)
        .map((tx) => String(tx.id || ""))
        .filter(Boolean)
      : [String(txToDelete.id)];
    try {
      setOptimisticallyDeletedIds((prev) => Array.from(new Set([...prev, ...deletedIds])));
      await deleteTransaction(user.uid, txToDelete.id, deleteGroup);
      setSelectedTransactionIds((prev) => prev.filter((id) => id !== String(txToDelete.id)));
      setTxToDelete(null);
    } finally {
      setDeleteAction(null);
    }
  };

  const handleConfirmBulkDelete = async (deleteGroup: boolean) => {
    if (!user || !bulkDeleteTargetIds || bulkDeleteTargetIds.length === 0) return;
    if (bulkDeleteAction) return;
    setBulkDeleteAction(deleteGroup ? "groups" : "selected");

    try {
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
    } finally {
      setBulkDeleteAction(null);
    }
  };

  const handleConfirmCancelSubscription = async () => {
    if (!user || !txToCancelSubscription || !txToCancelSubscription.groupId || !txToCancelSubscription.dueDate) return;
    if (isCancelingSubscription) return;

    setIsCancelingSubscription(true);
    try {
      const description = getTransactionTitle(txToCancelSubscription);
      await cancelFutureInstallments(user.uid, txToCancelSubscription.groupId, txToCancelSubscription.dueDate);
      setTxToCancelSubscription(null);
      setFeedbackModal({
        isOpen: true,
        type: "success",
        title: "Recorrência encerrada",
        message: `As próximas cobranças de "${description}" foram removidas.`,
      });
    } finally {
      setIsCancelingSubscription(false);
    }
  };

  const handleCheckinAction = async (tx: Transaction, markAsPaid: boolean) => {
    if (!user || !tx.id) return;
    if (checkinAction) return;

    setCheckinAction(markAsPaid ? "paid" : "pending");
    try {
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
          ? `A transação "${getTransactionTitle(tx)}" foi confirmada com sucesso.`
          : `A transação "${getTransactionTitle(tx)}" voltou para pendente.`
      });

      const newList = pendingCheckins.filter(p => p.id !== tx.id);
      setPendingCheckins(newList);

      if (newList.length === 0) {
        setShowCheckinModal(false);
      }
    } finally {
      setCheckinAction(null);
    }
  };
  const openEditModal = (tx: Transaction) => {
    if (!tx.id) return;
    router.push(`/transactions/${encodeURIComponent(tx.id)}/edit`);
  };

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
  const dailyLimit = calculateDailyLimit({
    transactions,
    cards: paymentCards,
    today: todayStr,
    month: selectedMonth,
  });
  const remainingDaysInSelectedMonth = dailyLimit.daysRemaining;
  const smartDailyLimit = effectivePlanCapabilities.hasSmartDailyLimit ? dailyLimit.amount : null;
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
      : (isIncome ? "Não Recebido" : "Não Pago");

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

        {/* TOP BAR: TÍTULO + CONTROLES + BOTÃO NOVA TRANSAÇÃO */}
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

            <Button
              id="tour-reports-button"
              variant="outline"
              onClick={() => router.push("/reports")}
              className="h-11 w-full rounded-xl border-primary/25 font-bold text-primary transition-all duration-200 active:scale-[0.98] hover:cursor-pointer hover:bg-accent sm:w-auto"
            >
              <FileBarChart2 className="mr-2 h-4 w-4" /> Relatórios
            </Button>
            {/* Seletor de M?s */}
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
                  {onboardingStatus.steps.firstTransaction ? "âœ“ " : onboardingActiveStep === "firstTransaction" ? "â€¢ " : ""}Primeira transação 
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
                  {onboardingStatus.steps.firstCard ? "âœ“ " : onboardingActiveStep === "firstCard" ? "â€¢ " : ""}Primeiro cartão
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
                  {onboardingStatus.steps.firstGoal ? "âœ“ " : onboardingActiveStep === "firstGoal" ? "â€¢ " : ""}Primeira meta
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
                  {onboardingStatus.steps.profileMenu ? "âœ“ " : onboardingActiveStep === "profileMenu" ? "â€¢ " : ""}Abrir menu da conta (foto no topo)
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
                    {getTransactionTitle(monthlyInsights.biggestExpense)} â€¢ {formatCurrencyDisplay(monthlyInsights.biggestExpense.amount)}
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
                    {monthlyInsights.topRisk.card.bankName} â€¢â€¢â€¢â€¢ {monthlyInsights.topRisk.card.last4} em {monthlyInsights.topRisk.usagePct.toFixed(1)}%
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
              <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row">
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
              <div className="app-panel-subtle w-full min-w-0 rounded-2xl border border-color:var(--app-panel-border) px-4 py-3 md:w-auto md:min-w-[220px]">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Base do cálculo</p>
                <p className="mt-2 text-2xl font-bold">
                  {remainingDaysInSelectedMonth > 0 ? `${remainingDaysInSelectedMonth} dia(s)` : "Mês encerrado"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dailyLimit.currentMonthCardImpact > 0
                    ? `Inclui ${formatCurrencyDisplay(dailyLimit.currentMonthCardImpact)} de impacto do cartão no mês.`
                    : "Restantes para distribuir sua folga prevista."}
                </p>
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
              <div className={`financial-value text-2xl font-bold tracking-tight sm:text-3xl ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (realCurrentBalance < 0 ? 'text-red-500' : 'text-primary')}`}>
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
                <span className="financial-value flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-2xl text-emerald-600 sm:text-3xl dark:bg-emerald-900/20"><ArrowUpCircle className="mr-1 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />{formatCurrencyDisplay(monthIncome)}</span>
                <span className="financial-value flex items-center rounded-md bg-red-50 px-2 py-0.5 text-2xl font-bold text-red-600 sm:text-3xl dark:bg-red-900/20"><ArrowDownCircle className="mr-1 h-5 w-5 shrink-0 sm:h-6 sm:w-6" />{formatCurrencyDisplay(monthExpense)}</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Total de entradas e saídas do mês.</p>
            </CardContent>
          </Card>

          {/* PREVISÃO */}
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
                <div className={`financial-value text-2xl font-bold tracking-tight sm:text-3xl ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (projectedAccumulatedBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
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

        {/* --- Layout Principal (Agora coluna Única) --- */}
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
              <div className="flex-col md:flex-row md:items-center justify-between grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Extrato</CardTitle>
                  <CardDescription>
                    Lançamentos de {formatDateDisplay(selectedMonth + '-02', { month: 'long', year: 'numeric' })}.
                  </CardDescription>
                </div>
                <div className="flex flex-col gap-2 ">
                  {/* Campo de Busca */}
                  <div className="relative w-full max-w-full">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                    <Input
                      placeholder="Buscar transação..."
                      className="pl-9 h-9 text-xs rounded-lg"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                    <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "income" | "expense")}>
                      <SelectTrigger className="w-[150px] h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="expense">Despesas</SelectItem>
                        <SelectItem value="income">Receitas</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "paid" | "pending")}>
                      <SelectTrigger className="w-[250px] h-9 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos Status</SelectItem>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="paid">Pago</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                      <SelectTrigger className="w-[250px] h-9 text-xs rounded-lg"><SelectValue placeholder="Categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas Categorias</SelectItem>
                        {uniqueCategories.map(c => (
                          <SelectItem key={c} value={c}>
                            <CategoryLabel value={c} />
                          </SelectItem>
                        ))}
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
                                {getTransactionTitle(tx)}
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
                            <CategoryLabel value={tx.category} className="max-w-52 gap-1.5" iconClassName="h-3 w-3" inheritColors />
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
                                  ? "Recorr?ncia encerrada"
                                  : "Recorr?ncia mensal"
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

            {/* Pagina??o Footer */}
            <div className="app-panel-subtle flex items-center justify-between border-t border-border/70 px-6 py-4">
              <div className="text-xs text-zinc-500 font-medium">
                P?gina {currentPage} de {totalPages || 1}
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
                  Pr?ximo
                </Button>
              </div>
            </div>
          </Card>

        </div>

        {/* --- DIALOGS (MODAIS) --- */}

        {/* Modal de Exclus?o */}
        <Dialog open={!!txToDelete} onOpenChange={(open) => !open && !deleteAction && setTxToDelete(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <div className="p-2 bg-red-100 rounded-full">
                  <AlertCircle className="h-5 w-5" />
                </div>
                Excluir Transação
              </DialogTitle>
              <DialogDescription className="pt-3 text-base">
                Tem certeza que você vai apagar: <br /> <span className="font-bold text-zinc-900 dark:text-white mt-1 block">{getTransactionTitle(txToDelete)}</span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="ghost" disabled={Boolean(deleteAction)} onClick={() => setTxToDelete(null)}>
                Cancelar
              </Button>

              {txToDelete?.groupId ? (
                <>
                  <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="outline" disabled={Boolean(deleteAction)} onClick={() => handleConfirmDelete(false)}>
                    {deleteAction === "single" ? "Excluindo..." : "Apenas Esta"}
                  </Button>
                  <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200" disabled={Boolean(deleteAction)} onClick={() => handleConfirmDelete(true)}>
                    {deleteAction === "group" ? "Excluindo..." : "Todas as Parcelas"}
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200" disabled={Boolean(deleteAction)} onClick={() => handleConfirmDelete(false)}>
                  {deleteAction === "single" ? "Excluindo..." : "Confirmar Exclusão"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Dialog */}
        <Dialog open={!!bulkDeleteTargetIds} onOpenChange={(open) => !open && !bulkDeleteAction && setBulkDeleteTargetIds(null)}>
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
                    disabled={Boolean(bulkDeleteAction)}
                    onClick={() => void handleConfirmBulkDelete(false)}
                  >
                    {bulkDeleteAction === "selected" ? "Excluindo..." : "Excluir apenas os itens selecionados"}
                  </Button>
                  <Button
                    className="w-full rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200"
                    disabled={Boolean(bulkDeleteAction)}
                    onClick={() => void handleConfirmBulkDelete(true)}
                  >
                    {bulkDeleteAction === "groups" ? "Excluindo..." : "Excluir também todas as parcelas dos grupos"}
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white hover:cursor-pointer duration-200"
                  disabled={Boolean(bulkDeleteAction)}
                  onClick={() => void handleConfirmBulkDelete(false)}
                >
                  {bulkDeleteAction === "selected" ? "Excluindo..." : "Confirmar exclusão"}
                </Button>
              )}
              <Button
                className="w-full rounded-xl h-10 hover:cursor-pointer duration-200"
                variant="ghost"
                disabled={Boolean(bulkDeleteAction)}
                onClick={() => setBulkDeleteTargetIds(null)}
              >
                Cancelar
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Cancel Subscription Dialog */}
        <Dialog open={!!txToCancelSubscription} onOpenChange={(open) => !open && !isCancelingSubscription && setTxToCancelSubscription(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-full">
                  <XCircle className="h-5 w-5" />
                </div>
                Encerrar recorr?ncia
              </DialogTitle>
              <DialogDescription className="pt-3 text-base">
                Você vai encerrar a recorrência de <strong>{getTransactionTitle(txToCancelSubscription)}</strong>.
                <br /><br />
                A ocorrência de <strong>{formatDateDisplay(txToCancelSubscription?.dueDate || "")}</strong> será a última mantida.
                <br />
                As cobranças futuras serão removidas e este lançamento ficará marcado como encerrado.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10 hover:cursor-pointer duration-200" variant="ghost" disabled={isCancelingSubscription} onClick={() => setTxToCancelSubscription(null)}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto rounded-xl h-10 bg-amber-600 hover:bg-amber-700 text-white hover:cursor-pointer duration-200" disabled={isCancelingSubscription} onClick={handleConfirmCancelSubscription}>
                {isCancelingSubscription ? "Encerrando..." : "Confirmar Encerramento"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Check-in Modal */}
        <Dialog open={showCheckinModal} onOpenChange={(open) => !checkinAction && setShowCheckinModal(open)}>
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
                <p className="font-semibold text-lg">{getTransactionTitle(pendingCheckins[0])}</p>
                <p className="text-sm text-zinc-500 mb-2">Venceu em: {formatDateDisplay(pendingCheckins[0].dueDate)}</p>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {formatCurrencyDisplay(pendingCheckins[0].amount)}
                </div>
              </div>
            )}

            <DialogFooter className="grid grid-cols-1 gap-3 mt-2 sm:grid-cols-2">
              <Button
                variant="outline"
                className="rounded-xl h-12 hover:cursor-pointer duration-200"
                disabled={Boolean(checkinAction) || pendingCheckins.length === 0}
                onClick={() => handleCheckinAction(pendingCheckins[0], false)}
              >
                {checkinAction === "pending" ? "Atualizando..." : "Ainda Não"}
              </Button>
              <Button
                className="rounded-xl h-12 bg-green-600 hover:bg-green-700 text-white hover:cursor-pointer duration-200"
                disabled={Boolean(checkinAction) || pendingCheckins.length === 0}
                onClick={() => handleCheckinAction(pendingCheckins[0], true)}
              >
                {checkinAction === "paid" ? "Atualizando..." : "Já Paguei/Recebi"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upgrade Modal */}
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
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
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
                  <Medal className="inline-block h-6 w-6 text-zinc-400 dark:text-zinc-800" /> {isOpeningCheckout === "pro" ? "Abrindo..." : "Pro"}
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








