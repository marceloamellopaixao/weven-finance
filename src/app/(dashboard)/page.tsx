"use client";

import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { usePlans } from "@/hooks/usePlans";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Plus, TrendingDown, TrendingUp, Eye, EyeOff,
  DollarSign, CalendarDays, MoreHorizontal, Pencil, Trash2,
  AlertCircle, Layers, Calendar, ChevronLeft, ChevronRight, ArrowUpCircle, ArrowDownCircle, Tv, XCircle, Crown, Search, HelpCircle, CheckCircle2,
  Medal, Info, AlertTriangle,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Transaction, PaymentMethod, TransactionType } from "@/types/transaction";
import LandingPage from "@/components/marketing/LandingPage";
import Link from "next/link";
import { useRouter } from "next/navigation";

// --- Configurações Visuais ---
const ALL_CATEGORIES = [
  { name: "Dízimo", type: "expense", color: "bg-violet-500/10 text-violet-600 border-violet-200/50 dark:text-violet-400 dark:border-violet-800/50" },
  { name: "Casa", type: "expense", color: "bg-blue-500/10 text-blue-600 border-blue-200/50 dark:text-blue-400 dark:border-blue-800/50" },
  { name: "Alimentação", type: "expense", color: "bg-orange-500/10 text-orange-600 border-orange-200/50 dark:text-orange-400 dark:border-orange-800/50" },
  { name: "Investimento", type: "expense", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:text-emerald-400 dark:border-emerald-800/50" },
  { name: "Compras", type: "expense", color: "bg-pink-500/10 text-pink-600 border-pink-200/50 dark:text-pink-400 dark:border-pink-800/50" },
  { name: "Streaming", type: "expense", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200/50 dark:text-indigo-400 dark:border-indigo-800/50" },
  { name: "Salário", type: "income", color: "bg-green-500/10 text-green-600 border-green-200/50 dark:text-green-400 dark:border-green-800/50" },
  { name: "Rendimento", type: "income", color: "bg-green-500/10 text-green-600 border-green-200/50 dark:text-green-400 dark:border-green-800/50" },
  { name: "Vendas", type: "income", color: "bg-teal-500/10 text-teal-600 border-teal-200/50 dark:text-teal-400 dark:border-teal-800/50" },
  { name: "Serviços", type: "income", color: "bg-teal-500/10 text-teal-600 border-teal-200/50 dark:text-teal-400 dark:border-teal-800/50" },
  { name: "Outros", type: "both", color: "bg-zinc-500/10 text-zinc-600 border-zinc-200/50 dark:text-zinc-400 dark:border-zinc-800/50" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string, hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: true },
];

const formatDateDisplay = (dateString: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) => {
  if (!dateString) return "-";
  const date = new Date(`${dateString}T12:00:00`);
  return date.toLocaleDateString('pt-BR', options);
};

const ITEMS_PER_PAGE = 10;
const FREE_PLAN_LIMIT = 20;

// Tipo para feedback genérico (VALIDAÇÃO DE PAGAMENTO)
type FeedbackData = {
  isOpen: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
};

export default function DashboardPage() {
  const { user, userProfile, privacyMode, togglePrivacyMode } = useAuth();
  const { transactions, loading } = useTransactions();
  const { plans } = usePlans();
  const router = useRouter();

  // --- 1. STATES ---
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

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
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modais
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);
  const [txToCancelSubscription, setTxToCancelSubscription] = useState<Transaction | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Modal de Check-in Diário
  const [pendingCheckins, setPendingCheckins] = useState<Transaction[]>([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [hasRunCheckin, setHasRunCheckin] = useState(false);

  // Modal Genérico de Feedback (Sucesso/Erro)
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });

  // Helper para formatar moeda com privacidade
  const formatCurrency = (value: number) => {
    // Nota: Para modais de erro/sucesso, ignoramos o privacyMode para clareza da mensagem
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Helper para display na UI (com blur)
  // const formatCurrencyDisplay = (value: number) => {
  //   if (privacyMode) return "R$ ••••••";
  //   return formatCurrency(value);
  // };

  // --- 2. TRAVA DE SEGURANÇA DE E-MAIL ---
  useEffect(() => {
    if (!loading && user && !user.emailVerified) {
      router.push("/verify-email");
    }
  }, [user, loading, router]);

  // --- 3. CHECK-IN DIÁRIO (Pop-up Inteligente) ---
  useEffect(() => {
    if (loading || !user || hasRunCheckin) return;

    if (transactions.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);

      // Filtra transações PENDENTES que venceram hoje ou antes
      const toCheck = transactions.filter(t => {
        return t.status === 'pending' && t.dueDate <= todayStr;
      });

      if (toCheck.length > 0) {
        setPendingCheckins(toCheck);
        setShowCheckinModal(true);
      }

      setHasRunCheckin(true);
    }
  }, [transactions, loading, user, hasRunCheckin]);

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

  const realCurrentBalance = useMemo(() => {
    return transactions.reduce((acc, t) => {
      if (t.status === 'paid') {
        return t.type === 'income' ? acc + t.amount : acc - t.amount;
      }
      return acc;
    }, 0);
  }, [transactions]);

  const selectedMonthEnd = selectedMonth + "-31";

  const projectedAccumulatedBalance = useMemo(() => {
    const pendingTransactions = transactions.filter(t => {
      if (t.status === 'paid') return false;
      return t.dueDate <= selectedMonthEnd;
    });
    const pendingNet = pendingTransactions.reduce((acc, t) => {
      return t.type === 'income' ? acc + t.amount : acc - t.amount;
    }, 0);
    return realCurrentBalance + pendingNet;
  }, [transactions, realCurrentBalance, selectedMonthEnd]);

  const availableCategories = useMemo(() => {
    return ALL_CATEGORIES.filter(c => c.type === type || c.type === 'both');
  }, [type]);

  const transactionsThisMonthCount = useMemo(() => {
    return transactions.filter(t => t.dueDate.startsWith(selectedMonth)).length;
  }, [transactions, selectedMonth]);

  const showDueDateInput = useMemo(() => {
    const method = PAYMENT_METHODS.find(pm => pm.value === paymentMethod);
    return method ? method.hasDueDate : false;
  }, [paymentMethod]);

  const chartData = useMemo(() => {
    const monthlyGroups: Record<string, number> = {};

    transactions.forEach(t => {
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

  // Reseta página ao mudar filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, filterType, filterStatus, filterCategory, searchTerm]);

  // Ajusta parcelas automaticamente para categoria "Streaming"
  useEffect(() => {
    if (category === 'Streaming') {
      setIsInstallment(true);
      setInstallmentsCount("12");
    }
  }, [category]);

  // --- RETORNO CONDICIONAL ---
  if (loading) return null;

  // Usuário não autenticado
  if (!user) {
    return <LandingPage />;
  }

  // Validação de e-mail não verificado
  if (user && !user.emailVerified) {
    router.push("/verify-email")
    return null
  };
  if (user && userProfile && !userProfile.verifiedEmail) {
    router.push("/verify-email")
    return null
  };

  // --- 6. HANDLERS ---

  const changeType = (newType: TransactionType) => {
    setType(newType);
    if (newType === 'income') {
      setCategory("Salário");
      setPaymentMethod("pix");
      setIsInstallment(false);
    } else {
      setCategory("");
      setPaymentMethod("credit_card");
    }
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
    const limit = plans.free.limit || FREE_PLAN_LIMIT;

    // BLOQUEIO DE PLANO
    if (userProfile?.plan !== 'pro' && userProfile?.plan !== 'premium' && transactionsThisMonthCount >= limit) {
      setShowUpgradeModal(true);
      return;
    }

    if (!desc || !amount || !category) return;
    setIsSubmitting(true);
    try {
      let finalAmount = Number(amount);
      const count = Number(installmentsCount);

      if (isInstallment && count > 1) {
        if (category !== 'Streaming') {
          finalAmount = finalAmount / count;
        }
        finalAmount = Math.round(finalAmount * 100) / 100;
      }

      const finalDueDate = showDueDateInput ? dueDate : date;

      await addTransaction(user!.uid, {
        description: desc,
        amount: finalAmount,
        type: type,
        category: category,
        paymentMethod: paymentMethod,
        date: type === 'income' ? finalDueDate : date,
        dueDate: finalDueDate,
        isInstallment,
        installmentsCount: count
      });
      setDesc("");
      setAmount("");
      setIsInstallment(false);
      setInstallmentsCount("2");
      if (type === 'income') setCategory("Salário");
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async (deleteGroup: boolean) => {
    if (!user || !txToDelete || !txToDelete.id) return;
    await deleteTransaction(user.uid, txToDelete.id, deleteGroup);
    setTxToDelete(null);
  };

  const handleConfirmCancelSubscription = async () => {
    if (!user || !txToCancelSubscription || !txToCancelSubscription.groupId || !txToCancelSubscription.dueDate) return;
    await cancelFutureInstallments(user.uid, txToCancelSubscription.groupId, txToCancelSubscription.dueDate);
    setTxToCancelSubscription(null);
  };

  const openEditModal = (tx: Transaction) => { setEditingTx({ ...tx }); setIsEditOpen(true); };

  const handleConfirmEdit = async (updateGroup: boolean) => {
    if (!editingTx || !user || !editingTx.id) return;
    await updateTransaction(user.uid, editingTx.id, {
      description: editingTx.description,
      amount: Number(editingTx.amount),
      category: editingTx.category,
      dueDate: editingTx.dueDate,
      date: editingTx.date
    }, updateGroup);
    setIsEditOpen(false);
    setEditingTx(null);
  };

  // Handler do Check-in Rápido e Dropdown da Tabela
  const handleCheckinAction = async (tx: Transaction, markAsPaid: boolean) => {
    if (!user || !tx.id) return;

    // --- VALIDAÇÃO DE SALDO ---
    // Apenas se estiver tentando pagar uma DESPESA
    if (markAsPaid && tx.type === 'expense') {
      if (realCurrentBalance < tx.amount) {
        setFeedbackModal({
          isOpen: true,
          type: 'error',
          title: 'Saldo Insuficiente',
          message: `Você possui ${formatCurrency(realCurrentBalance)} em caixa, mas a conta é de ${formatCurrency(tx.amount)}. A operação foi cancelada.`
        });
        return; // BLOQUEIA A AÇÃO
      }
    }

    // Se passou na validação, executa
    const currentStatus = markAsPaid ? 'pending' : 'paid'; // Lógica inversa do toggle: se quero 'markAsPaid', passo status atual 'pending' para o toggle virar 'paid'
    await toggleTransactionStatus(user.uid, tx.id, currentStatus);

    // Feedback de Sucesso
    setFeedbackModal({
      isOpen: true,
      type: 'success',
      title: markAsPaid ? (tx.type === 'income' ? 'Recebido!' : 'Pago!') : (tx.type === 'income' ? 'Cancelado Recebimento' : 'Pagamento Cancelado'),
      message: markAsPaid
        ? `A transação "${tx.description}" foi confirmada com sucesso.`
        : `A transação "${tx.description}" voltou para pendente.`
    });

    // Remove da lista de pendências do modal de check-in se necessário
    const newList = pendingCheckins.filter(p => p.id !== tx.id);
    setPendingCheckins(newList);

    if (newList.length === 0) {
      setShowCheckinModal(false);
    }
  };

  // --- 7. RENDERIZAÇÃO E FILTRAGEM ---
  const monthTransactions = transactions.filter(t => t.dueDate && t.dueDate.startsWith(selectedMonth));

  const displayedTransactions = monthTransactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && t.status !== filterStatus) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      const matchDesc = t.description.toLowerCase().includes(lowerSearch);
      const matchVal = t.amount.toString().includes(lowerSearch);
      if (!matchDesc && !matchVal) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(displayedTransactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = displayedTransactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const monthIncome = monthTransactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const monthExpense = monthTransactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const monthBalance = monthIncome - monthExpense;

  const getCategoryStyle = (catName: string) =>
    ALL_CATEGORIES.find(c => c.name === catName)?.color || "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-200";

  const isOverdue = (tx: Transaction) => {
    if (tx.status === 'paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return tx.dueDate < today;
  };

  const uniqueCategories = Array.from(new Set(transactions.map(t => t.category))).sort();

  return (
    <div className="min-h-screen font-sans selection:bg-primary/20 selection:text-primary pb-20">

      <main className="container mx-auto p-3 md:p-8 space-y-6 max-w-7xl animate-in fade-in duration-500">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Visão Geral</h1>
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Gerencie seu fluxo de caixa e previsões.</p>
          </div>

          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full md:w-auto justify-between md:justify-start">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 shrink-0"
              onClick={() => changeMonth(-1)}
              disabled={!canGoBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full md:w-[200px] h-9 border-none shadow-none focus:ring-0 font-semibold text-sm bg-transparent flex justify-center text-center">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-500 shrink-0" />
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

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 shrink-0"
              onClick={() => changeMonth(1)}
              disabled={!canGoForward}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* --- KPI Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* SALDO EM CAIXA */}
          <Card className="relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl group active:scale-[0.99] transition-transform">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Saldo em Caixa (Hoje - {new Date().toLocaleDateString()})</CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title={privacyMode ? "Mostrar Saldo" : "Esconder Saldo"}>
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800">
                      <p>Saldo disponível em seu banco para o dia atual.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                <DollarSign className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (realCurrentBalance < 0 ? 'text-red-500' : 'text-blue-600 dark:text-zinc-50')}`}>
                {formatCurrency(realCurrentBalance)}
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Valor disponível em seu banco</p>
            </CardContent>
          </Card>

          {/* BALANÇO DO MÊS */}
          <Card className="relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl">
            <div className="absolute inset-0 bg-linear-to-br from-violet-500/5 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Balanço do Mês
                </CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title={privacyMode ? "Mostrar Saldo" : "Esconder Saldo"}>
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800">
                      <p>Indica os valores totais de rendas e gastos do mês atual.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className={`rounded-xl ${monthBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
                {monthBalance >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
              </div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className="flex flex-col items-start font-bold gap-2 text-xs md:flex-col md:items-start sm:flex-row sm:items-start">
                <span className="text-3xl flex items-center text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md">
                  <ArrowUpCircle className="w-6 h-6 mr-1" />
                  {formatCurrency(monthIncome)}
                </span>
                <span className="text-3xl font-bold flex items-center text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded-md">
                  <ArrowDownCircle className="w-6 h-6 mr-1" />
                  {formatCurrency(monthExpense)}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">
                Balanço do Mês de rendas e gastos.
              </p>
            </CardContent>
          </Card>

          {/* PREVISÃO FINAL DO MÊS */}
          <Card className={`relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl ring-2 ${projectedAccumulatedBalance >= 0 ? 'ring-emerald-500/20' : 'ring-red-500/20'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Previsão Final</CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" title={privacyMode ? "Mostrar Saldo" : "Esconder Saldo"}>
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800">
                      <p>Saldo projetado ao final do mês considerando transações pendentes.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="p-2 bg-violet-500/10 rounded-xl text-violet-600 dark:text-violet-400">
                <Layers className="h-5 w-5" />
              </div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (projectedAccumulatedBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                {formatCurrency(projectedAccumulatedBalance)}
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Saldo projetado ao final do mês com transações pendentes.</p>
            </CardContent>
          </Card>
        </div>

        {/* --- Layout Principal --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-start">

          {/* --- BLOCO DIREITA: FORMULÁRIO --- */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="sticky top-24 space-y-6">

              <Card className="border-none shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden ring-1 ring-zinc-100 dark:ring-zinc-800">
                <div className={`h-2 w-full bg-linear-to-r ${type === 'expense' ? 'from-red-500 to-orange-500' : 'from-emerald-500 to-teal-500'}`} />

                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-3">
                    <div className={`p-2 rounded-xl text-white shadow-lg ${type === 'expense' ? 'bg-linear-to-br from-red-500 to-orange-500 shadow-red-500/20' : 'bg-linear-to-br from-emerald-500 to-teal-500 shadow-emerald-500/20'}`}>
                      <Plus className="h-4 w-4" />
                    </div>
                    {type === 'expense' ? 'Novo Gasto' : 'Nova Renda'}
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-5">
                  <div className="grid grid-cols-2 gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                    <button
                      onClick={() => changeType('expense')}
                      className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 ${type === 'expense' ? 'bg-white dark:bg-zinc-700 shadow-sm text-red-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      Gasto
                    </button>
                    <button
                      onClick={() => changeType('income')}
                      className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 ${type === 'income' ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}
                    >
                      Renda
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Titulo {type === 'expense' ? 'do Gasto' : 'da Renda'}</Label>
                      <Input
                        className="mt-1.5 h-12 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 rounded-xl"
                        placeholder={type === 'expense' ? "Ex: Netflix" : "Ex: Salário"}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Valor Total</Label>
                      <div className="relative mt-1.5">
                        <span className="absolute left-3.5 top-3 text-zinc-400 font-semibold">R$</span>
                        <Input
                          type="number"
                          className="pl-10 h-12 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 rounded-xl font-semibold text-lg"
                          placeholder="0,00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1.5 text-right font-medium">
                        {isInstallment && type === 'expense'
                          ? (category === 'Streaming' ? "Valor Mensal (Assinatura)" : "O sistema dividirá este valor")
                          : "Valor único"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-400 ml-1 uppercase">Categoria</Label>
                      <Select onValueChange={setCategory} value={category}>
                        <SelectTrigger className="h-12 rounded-xl bg-zinc-50 border-zinc-200"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {availableCategories.map((cat) => <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-zinc-400 ml-1 uppercase">Método</Label>
                      <Select onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} value={paymentMethod}>
                        <SelectTrigger className="h-12 rounded-xl bg-zinc-50 border-zinc-200"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-zinc-50/80 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      {type === 'expense' && (
                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data do Gasto</Label>
                          <Input type="date" className="h-10 text-xs bg-white dark:bg-zinc-900 border-zinc-200 rounded-lg" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                      )}

                      {(showDueDateInput || type === 'income') && (
                        <div className={`space-y-1.5 ${type === 'income' ? 'col-span-2' : ''}`}>
                          <Label className={`text-[10px] font-bold uppercase tracking-wider ${type === 'expense' ? 'text-red-500' : 'text-emerald-600'}`}>{type === 'expense' ? 'Vencimento' : 'Data Crédito'}</Label>
                          <Input type="date" className="h-10 text-xs bg-white dark:bg-zinc-900 border-zinc-200 rounded-lg" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-200/50 dark:border-zinc-700/50">
                      <Label htmlFor="inst-switch" className="text-xs font-medium cursor-pointer flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                        <Layers className="h-3.5 w-3.5 text-violet-500" />
                        {type === 'expense'
                          ? (category === 'Streaming' ? 'Recorrência (Mensal)' : 'Compra Parcelada?')
                          : 'Recebimento Parcelado?'}
                      </Label>
                      <Switch id="inst-switch" className="scale-100 data-[state=checked]:bg-violet-600" checked={isInstallment} onCheckedChange={setIsInstallment} />
                    </div>

                    {isInstallment && (
                      <div className="animate-in slide-in-from-top-2 pt-1">
                        <Label className="text-xs font-medium text-zinc-500">
                          {category === 'Streaming' ? 'Meses de Assinatura (Previsão)' : 'Número de Parcelas'}
                        </Label>
                        <Input type="number" className="h-10 mt-1.5 bg-white dark:bg-zinc-900 border-zinc-200 rounded-lg" min="2" max="60" value={installmentsCount} onChange={e => setInstallmentsCount(e.target.value)} />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={handleAdd}
                    className={`w-full h-12 font-bold text-white shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] ${type === 'expense' ? 'bg-linear-to-r from-red-500 to-orange-500 shadow-red-500/25 hover:shadow-red-500/40' : 'bg-linear-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'}`}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Processando..." : (type === 'expense' ? "Confirmar Despesa" : "Confirmar Receita")}
                  </Button>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* --- BLOCO ESQUERDA: LISTA E GRÁFICO --- */}
          <div className="lg:col-span-2 space-y-8 order-2 lg:order-1">

            {/* Gráfico do Fluxo Mensal */}
            <Card className="border-none shadow-lg shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Fluxo Mensal</CardTitle>
                <CardDescription className="text-zinc-500">Evolução do saldo ao longo do tempo.</CardDescription>
              </CardHeader>
              <CardContent className="h-[280px] w-full">
                <AreaChart data={chartData} />
              </CardContent>
            </Card>

            {/* Tabela de Transações */}
            <Card className="border-none shadow-lg shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 py-5 px-6">
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
                        className="pl-9 h-9 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                      <Select value={filterType} onValueChange={(v) => setFilterType(v as "all" | "income" | "expense")}>
                        <SelectTrigger className="w-[100px] h-9 text-xs rounded-lg bg-zinc-50 dark:bg-zinc-800"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="expense">Despesas</SelectItem>
                          <SelectItem value="income">Receitas</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as "all" | "paid" | "pending")}>
                        <SelectTrigger className="w-[200px] h-9 text-xs rounded-lg bg-zinc-50"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos Status</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="paid">Pago</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="w-full h-9 text-xs rounded-lg bg-zinc-50"><SelectValue placeholder="Categoria" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Categ.</SelectItem>
                          {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-zinc-100/50 dark:bg-zinc-900">
                    <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800">
                      <TableHead className="font-semibold text-zinc-500">Titulo</TableHead>
                      <TableHead className="w-[150px] font-semibold text-zinc-500">Data</TableHead>
                      <TableHead className="w-[100px] font-semibold text-zinc-500">Valor</TableHead>
                      <TableHead className="w-[100px] text-center font-semibold text-zinc-500">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-zinc-400">
                          Nenhum lançamento encontrado com estes filtros.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedTransactions.map((tx) => {
                        const overdue = isOverdue(tx);
                        return (
                          <TableRow key={tx.id} className={`group border-zinc-100 dark:border-zinc-800 transition-all duration-200 ${overdue ? 'bg-red-50/50 dark:bg-red-900/10' : 'hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50'}`}>

                            {/* Coluna: Titulo */}
                            <TableCell className="align-middle">
                              <div className="flex flex-col ml-2 gap-1.5 py-1 whitespace-nowrap">
                                <span className={`font-semibold text-sm truncate max-w-[150px] sm:max-w-[400px] ${tx.status === 'paid' ? 'line-through text-zinc-400' : 'text-zinc-700 dark:text-zinc-200'}`}>
                                  {tx.description}
                                </span>

                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getCategoryStyle(tx.category)}`}>
                                    {tx.category}
                                  </span>
                                  {tx.groupId && (
                                    <span className="flex items-center text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                      {tx.category === 'Streaming' ? <Tv className="h-3 w-3 mr-1" /> : <Layers className="h-3 w-3 mr-1" />}
                                      {(tx.installmentCurrent || 0)}/{(tx.installmentTotal || 0)}
                                    </span>
                                  )}
                                  {tx.type === 'income' && (
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold dark:bg-emerald-900/20 dark:text-emerald-400">
                                      Receita
                                    </span>
                                  )}
                                </div>
                              </div>
                            </TableCell>

                            {/* Coluna: Data */}
                            <TableCell className="align-middle whitespace-nowrap">
                              <div className="flex flex-col text-sm">
                                <span className={`flex items-center font-medium 
                                  ${overdue ? "text-red-500" : "text-zinc-500 dark:text-zinc-400"}`}
                                >
                                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                  {formatDateDisplay(tx.dueDate)}
                                  {overdue && <AlertCircle className="h-3.5 w-3.5 ml-1 text-red-500" />}
                                </span>
                                {paymentMethod === 'credit_card' && tx.type === 'expense' &&
                                  <span className="text-[10px] text-zinc-400 ml-5 font-medium">
                                    Fatura
                                  </span>
                                }
                              </div>
                            </TableCell>

                            {/* Coluna: Valor */}
                            <TableCell className="text-right align-middle whitespace-nowrap">
                              <span className={`font-bold text-base tracking-tight ${tx.status === 'paid' ? 'text-zinc-400' : (tx.type === 'income' ? 'text-emerald-600' : 'text-zinc-800 dark:text-zinc-200')}`}>
                                {tx.type === 'expense' ? '- ' : '+ '}
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                              </span>
                            </TableCell>

                            {/* Coluna: Ações */}
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg"><MoreHorizontal className="h-4 w-4 text-zinc-400" /></Button>
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

                                    {tx.groupId && tx.category === 'Streaming' && (
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
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Paginação Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
                <div className="text-xs text-zinc-500 font-medium">
                  Página {currentPage} de {totalPages || 1}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs disabled:opacity-50 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs disabled:opacity-50 rounded-lg"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    Próximo
                  </Button>
                </div>
              </div>
            </Card>
          </div>

        </div>

        {/* Modal de Edição */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[500px] w-full max-h-[90vh] overflow-y-auto rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl">Editar Lançamento</DialogTitle>
              <DialogDescription>
                Faça ajustes na transação selecionada.
                {editingTx?.groupId && (
                  <span className="block mt-1 text-amber-600 font-medium text-xs">
                    * Atenção: Este item faz parte de um parcelamento.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            {editingTx && (
              <div className="space-y-5 py-4">
                <div className="space-y-2">
                  <Label>Titulo {type == 'expense' ? "do Gasto" : "da Renda"}</Label>
                  <Input className="h-10 rounded-lg" value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <div className="relative mt-1.5">
                      <span className="absolute left-3.5 top-2 text-zinc-400 font-semibold">R$</span>
                      <Input
                        type="number"
                        className="pl-10 h-10 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 rounded-xl font-semibold text-lg"
                        placeholder="0,00"
                        value={editingTx.amount}
                        onChange={e => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                      <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ALL_CATEGORIES.map((cat) => <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="col-span-2 space-y-2">
                  <Label className="text-xs font-semibold text-zinc-500 uppercase">Método de Pagamento</Label>
                  <Select value={editingTx.paymentMethod} onValueChange={(v) => setEditingTx({ ...editingTx, paymentMethod: v as PaymentMethod })}>
                    <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {editingTx.type === 'income' ? (
                  <div className="flex flex-col items-start gap-2">
                    {editingTx.type === 'income' && (
                      <div className="w-full space-y-2">
                        <Label className="text-xs font-medium text-green-500 uppercase">Data de Crédito</Label>
                        <Input
                          type="date" className="h-9 bg-white border-green-200"
                          value={editingTx.date}
                          onChange={e => setEditingTx({ ...editingTx, date: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-start gap-2">
                    {editingTx.dueDate && (
                      <div className="w-full grid grid-cols-2 gap-4 p-4 rounded-xl border border-zinc-100">
                        {editingTx.type === 'expense' && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-zinc-500 uppercase">Data Compra</Label>
                            <Input type="date" className="h-9 bg-white" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                          </div>
                        )}

                        {(editingTx.type === 'expense' && (editingTx.paymentMethod === 'boleto' || editingTx.paymentMethod === 'credit_card')) && (
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-red-500 uppercase">Vencimento</Label>
                            <Input type="date" className="h-9 bg-white border-red-200" value={editingTx.dueDate} onChange={e => setEditingTx({ ...editingTx, dueDate: e.target.value })} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="flex flex-col sm:flex-row gap-3">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setIsEditOpen(false)}>Cancelar</Button>

              {editingTx?.groupId ? (
                <>
                  <Button variant="outline" className="w-full sm:w-auto" onClick={() => handleConfirmEdit(false)}>
                    Apenas Esta
                  </Button>
                  <Button className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700" onClick={() => handleConfirmEdit(true)}>
                    Todas as Parcelas
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700" onClick={() => handleConfirmEdit(false)}>
                  Salvar
                </Button>
              )}
            </DialogFooter>
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
                Tem certeza? Você vai apagar: <br /> <span className="font-bold text-zinc-900 dark:text-white mt-1 block">{txToDelete?.description}</span>
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10" variant="ghost" onClick={() => setTxToDelete(null)}>
                Cancelar
              </Button>

              {txToDelete?.groupId ? (
                <>
                  <Button className="w-full sm:w-auto rounded-xl h-10" variant="outline" onClick={() => handleConfirmDelete(false)}>
                    Apenas Esta
                  </Button>
                  <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleConfirmDelete(true)}>
                    Todas as Parcelas
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto rounded-xl h-10 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleConfirmDelete(false)}>
                  Confirmar Exclusão
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Cancelar Assinatura */}
        <Dialog open={!!txToCancelSubscription} onOpenChange={(open) => !open && setTxToCancelSubscription(null)}>
          <DialogContent className="sm:max-w-[425px] rounded-2xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <div className="p-2 bg-amber-100 rounded-full">
                  <XCircle className="h-5 w-5" />
                </div>
                Encerrar Assinatura/Recorrência
              </DialogTitle>
              <DialogDescription className="pt-3 text-base">
                Você vai parar de pagar <strong>{txToCancelSubscription?.description}</strong>.
                <br /><br />
                A parcela de <strong>{formatDateDisplay(txToCancelSubscription?.dueDate || "")}</strong> será a última mantida.
                <br />
                Todas as cobranças futuras serão excluídas.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="flex-col sm:flex-row gap-3 mt-4">
              <Button className="w-full sm:w-auto rounded-xl h-10" variant="ghost" onClick={() => setTxToCancelSubscription(null)}>
                Voltar
              </Button>
              <Button className="w-full sm:w-auto rounded-xl h-10 bg-amber-600 hover:bg-amber-700 text-white" onClick={handleConfirmCancelSubscription}>
                Confirmar Encerramento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Check-in Diário */}
        <Dialog open={showCheckinModal} onOpenChange={setShowCheckinModal}>
          <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-violet-600">
                <CheckCircle2 className="h-6 w-6" /> Check-in Diário
              </DialogTitle>
              <DialogDescription className="pt-2 text-base">
                Você tem <strong>{pendingCheckins.length}</strong> contas vencidas ou vencendo hoje. Vamos atualizar?
              </DialogDescription>
            </DialogHeader>

            {pendingCheckins.length > 0 && (
              <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 my-2">
                <p className="font-semibold text-lg">{pendingCheckins[0].description}</p>
                <p className="text-sm text-zinc-500 mb-2">Venceu em: {formatDateDisplay(pendingCheckins[0].dueDate)}</p>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingCheckins[0].amount)}
                </div>
              </div>
            )}

            <DialogFooter className="grid grid-cols-2 gap-3 mt-2">
              <Button
                variant="outline"
                className="rounded-xl h-12"
                onClick={() => handleCheckinAction(pendingCheckins[0], false)}
              >
                Ainda Não
              </Button>
              <Button
                className="rounded-xl h-12 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleCheckinAction(pendingCheckins[0], true)}
              >
                Já Paguei/Recebi
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de UPGRADE */}
        <Dialog open={showUpgradeModal} onOpenChange={setShowUpgradeModal}>
          <DialogContent className="w-[calc(100vw-2rem)] max-w-[520px] sm:max-w-md rounded-2xl p-6 sm:p-8 border-violet-500 border-2 max-h-[85vh] overflow-y-auto">
            <DialogHeader className="text-center items-center">
              <div className="p-4 bg-violet-100 dark:bg-violet-900/30 rounded-full mb-4 animate-bounce">
                <Crown className="h-8 w-8 text-violet-600 dark:text-violet-400" />
              </div>

              <DialogTitle className="text-2xl font-bold text-violet-600">
                Limite Atingido!
              </DialogTitle>

              <DialogDescription className="text-base text-zinc-600 dark:text-zinc-400 mt-2">
                Você atingiu o limite de {FREE_PLAN_LIMIT} lançamentos mensais do plano Grátis.
                <br /><br />
                Faça o upgrade para o <strong>Plano Pro ou Premium</strong> e tenha acesso ilimitado e muito mais.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="mt-6 w-full">
              <div className="grid grid-cols-2 gap-3 w-full">
                <Link href={plans.premium.paymentLink} target="_blank" className="block w-full">
                  <Button
                    variant="outline"
                    className="w-full h-12 rounded-xl  sm:text-lg font-bold border-violet-200 text-violet-700 hover:bg-violet-50 shadow-lg shadow-violet-500/25 transition-all duration-400"
                  >
                    <Medal className="inline-block h-6 w-6 text-violet-600 dark:text-violet-400" /> Premium
                  </Button>
                </Link>

                <Link href={plans.pro.paymentLink} target="_blank" className="block w-full">
                  <Button className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700  sm:text-lg font-bold shadow-lg shadow-violet-500/25 transition-all duration-400">
                    <Medal className="inline-block h-6 w-6 text-zinc-100 dark:text-zinc-200" /> Pro
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  className="col-span-2 w-full h-12 sm:text-lg rounded-xl bg-violet-500 text-zinc-100 hover:bg-violet-700 hover:text-zinc-200 shadow-lg shadow-violet-500/25 transition-all duration-400"
                  onClick={() => setShowUpgradeModal(false)}
                >
                  Continuar no Grátis
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Feedback Genérico (Validação de Saldo, Sucesso, etc.) */}
        <Dialog open={feedbackModal.isOpen} onOpenChange={(open) => !open && setFeedbackModal({ ...feedbackModal, isOpen: false })}>
          <DialogContent className="rounded-2xl sm:max-w-[400px]">
            <DialogHeader>
              <div className={`mx-auto p-3 rounded-full mb-2 w-fit ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : feedbackModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                {feedbackModal.type === 'success' ? <CheckCircle2 className="h-6 w-6" /> : feedbackModal.type === 'error' ? <AlertTriangle className="h-6 w-6" /> : <Info className="h-6 w-6" />}
              </div>
              <DialogTitle className="text-center">{feedbackModal.title}</DialogTitle>
              <DialogDescription className="text-center pt-2">
                {feedbackModal.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setFeedbackModal({ ...feedbackModal, isOpen: false })} className="w-full rounded-xl">Entendido</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}