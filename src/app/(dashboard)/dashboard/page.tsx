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
  Calculator
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Transaction, PaymentMethod, TransactionType } from "@/types/transaction";
import Link from "next/link";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";

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

  // MODAL DE FORMULÁRIO (Novo estado unificado)
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Modal de Check-in Diário
  const [pendingCheckins, setPendingCheckins] = useState<Transaction[]>([]);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [hasRunCheckin, setHasRunCheckin] = useState(false);

  // Modal Genérico de Feedback (Sucesso/Erro)
  const [feedbackModal, setFeedbackModal] = useState<FeedbackData>({ isOpen: false, type: 'info', title: '', message: '' });

  // Constantes de Animação (Padrão do Sistema)
  const fadeInUp = "animate-in fade-in slide-in-from-bottom-4 duration-700 fill-mode-both";

  // Helper para formatar moeda com privacidade
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // Helper para display na UI (com blur)
  const formatCurrencyDisplay = (value: number) => {
    if (privacyMode) return "R$ ••••••";
    return formatCurrency(value);
  };

  // --- 3. CHECK-IN DIÁRIO (Pop-up Inteligente) ---
  useEffect(() => {
    if (loading || !user || hasRunCheckin) return;

    if (transactions.length > 0) {
      const todayStr = new Date().toISOString().slice(0, 10);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth, filterType, filterStatus, filterCategory, searchTerm]);

  useEffect(() => {
    if (category === 'Streaming') {
      setIsInstallment(true);
      setInstallmentsCount("12");
    }
  }, [category]);

  // --- RETORNO CONDICIONAL ---
  if (loading) {
    return <DashboardSkeleton />;
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

      let transactionDate = date; // Data do Registro (compra ou crédito)
      let transactionDueDate = date; // Data de Vencimento (ou Credito)

      // Lógica para definir as datas corretamente dependendo do tipo e método de pagamento
      if (type === 'income') {
        // Renda
        transactionDate = dueDate; // Para rendas, a data do crédito é a data principal
        transactionDueDate = dueDate;
      } else {
        // Gasto
        if (showDueDateInput) {
          // Cartao de Credito/Boleto: Data da Compra (date) != Data de Vencimento (dueDate)
          transactionDate = date;
          transactionDueDate = dueDate;
        } else {
          transactionDate = date;
          transactionDueDate = date;
        }
      }

      await addTransaction(user!.uid, {
        description: desc, // Descrição
        amount: finalAmount, // Valor (ajustado para parcelas se necessário)
        type: type, // Tipo (Despesa ou Renda)
        category: category, // Categoria
        paymentMethod: paymentMethod, // Método de Pagamento
        date: transactionDate, // Data do Gasto (para despesas) ou Data de Crédito (para rendas)
        dueDate: transactionDueDate, // Data de Vencimento (para despesas) ou Data de Crédito (para rendas)
        isInstallment, // Flag de Parcela
        installmentsCount: count // Número de Parcelas (se aplicável)
      });

      // Resetar form após adicionar
      setDesc("");
      setAmount("");
      setIsInstallment(false);
      setInstallmentsCount("2");
      if (type === 'income') setCategory("Salário");
      setIsFormOpen(false); // Fecha o modal após adicionar
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

  // --- COMPONENTE DO FORMULÁRIO ---
  const TransactionFormContent = (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-1 p-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
        <button
          onClick={() => changeType('expense')}
          className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 hover:cursor-pointer ${type === 'expense' ? 'bg-white dark:bg-zinc-700 shadow-sm text-red-600' : 'text-zinc-500 hover:text-zinc-700'}`}
        >
          Gasto
        </button>
        <button
          onClick={() => changeType('income')}
          className={`text-sm font-semibold py-2 rounded-lg transition-all duration-200 hover:cursor-pointer ${type === 'income' ? 'bg-white dark:bg-zinc-700 shadow-sm text-emerald-600' : 'text-zinc-500 hover:text-zinc-700'}`}
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
        className={`w-full h-12 font-bold text-white shadow-lg rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] hover:cursor-pointer duration-200 ${type === 'expense' ? 'bg-linear-to-r from-red-500 to-orange-500 shadow-red-500/25 hover:shadow-red-500/40' : 'bg-linear-to-r from-emerald-500 to-teal-500 shadow-emerald-500/25 hover:shadow-emerald-500/40'}`}
        disabled={isSubmitting}
      >
        {isSubmitting ? "Processando..." : (type === 'expense' ? "Confirmar Despesa" : "Confirmar Receita")}
      </Button>

      <Button
        variant="ghost"
        onClick={() => setIsFormOpen(false)}
        className="w-full h-12 font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all hover:cursor-pointer duration-200"
      >
        Cancelar
      </Button>
    </div>
  );

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

      <main className="container mx-auto p-3 md:p-8 space-y-6 max-w-7xl">

        {/* TOP BAR: TÍTULO + CONTROLES + BOTÃO NOVA TRANSAÇÃO */}
        <div className={`${fadeInUp} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Visão Geral</h1>
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">Gerencie seu fluxo de caixa e previsões.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            {/* Botão de Nova Transação (Visível em Mobile e Desktop) */}
            <Button
              onClick={() => setIsFormOpen(true)}
              className="h-11 rounded-xl bg-linear-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-lg shadow-violet-500/25 active:scale-[0.98] transition-all w-full sm:w-auto hover:cursor-pointer duration-200"
            >
              <Plus className="mr-2 h-4 w-4" /> Nova Transação
            </Button>

            {/* Seletor de Mês */}
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 p-1 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm w-full sm:w-auto justify-between md:justify-start">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 shrink-0 hover:cursor-pointer duration-200" onClick={() => changeMonth(-1)} disabled={!canGoBack}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-full md:w-40 h-7 border-none shadow-none focus:ring-0 font-semibold text-sm bg-transparent flex justify-center text-center hover:cursor-pointer duration-200">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-violet-500 shrink-0" />
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
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 shrink-0 hover:cursor-pointer duration-200" onClick={() => changeMonth(1)} disabled={!canGoForward}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* --- KPI Cards --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* SALDO EM CAIXA */}
          <Card className={`${fadeInUp} delay-150 relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl group active:scale-[0.99] transition-transform`}>
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Saldo Atual (Hoje)</CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Dinheiro que realmente entrou menos o que já saiu (Pago/Recebido).</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400"><DollarSign className="h-5 w-5" /></div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (realCurrentBalance < 0 ? 'text-red-500' : 'text-blue-600 dark:text-zinc-50')}`}>
                {formatCurrencyDisplay(realCurrentBalance)}
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">O que você tem hoje (Realizado).</p>
            </CardContent>
          </Card>

          {/* MOVIMENTAÇÃO */}
          <Card className={`${fadeInUp} delay-300 relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl`}>
            <div className="absolute inset-0 bg-linear-to-br from-violet-500/5 to-transparent pointer-events-none" />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Movimentação (Mês)</CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Total de Receitas e Despesas agendadas para este mês (Pago + Pendente).</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className={`rounded-xl ${monthBalance >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-600'}`}>
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

          {/* PREVISÃO */}
          <Card className={`${fadeInUp} delay-500 relative overflow-hidden border-none shadow-lg md:shadow-xl shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl ring-2 ${projectedAccumulatedBalance >= 0 ? 'ring-emerald-500/20' : 'ring-red-500/20'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 relative">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Previsão de Fechamento</CardTitle>
                <button onClick={togglePrivacyMode} className="block sm:hidden text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                  {privacyMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <TooltipProvider>
                  <Tooltip delayDuration={200}>
                    <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200" /></TooltipTrigger>
                    <TooltipContent className="bg-zinc-200 text-zinc-900 font-bold border border-zinc-800"><p>Cálculo: Saldo Atual + (A Receber - A Pagar) no mês.</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="p-2 bg-violet-500/10 rounded-xl text-violet-600 dark:text-violet-400"><Calculator className="h-5 w-5" /></div>
            </CardHeader>
            <CardContent className="relative h-full flex flex-col justify-center">
              <div className={`text-3xl font-bold tracking-tight ${privacyMode ? 'text-zinc-800 dark:text-zinc-200' : (projectedAccumulatedBalance >= 0 ? 'text-emerald-600' : 'text-red-600')}`}>
                {formatCurrencyDisplay(projectedAccumulatedBalance)}
              </div>
              <p className="text-xs text-zinc-400 mt-2 font-medium">Estimativa para o fim do mês.</p>
            </CardContent>
          </Card>
        </div>

        {/* --- Layout Principal (Agora Coluna Única) --- */}
        <div className="w-full space-y-8">

          {/* Gráfico do Fluxo Mensal */}
          <Card className={`${fadeInUp} delay-700 border-none shadow-lg shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">Fluxo Mensal</CardTitle>
              <CardDescription className="text-zinc-500">Evolução do saldo ao longo do tempo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[280px] w-full">
              <AreaChart data={chartData} />
            </CardContent>
          </Card>

          {/* Tabela de Transações */}
          <Card className={`${fadeInUp} delay-700 border-none shadow-lg shadow-zinc-200/50 dark:shadow-black/20 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden`}>
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
                                  <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg hover:cursor-pointer duration-200"><MoreHorizontal className="h-4 w-4 text-zinc-400" /></Button>
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
          <DialogContent className=" sm:max-w-[600px] sm:h-auto sm:rounded-2xl p-6 overflow-y-auto">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                {type === 'expense' ? 'Novo Gasto' : 'Nova Renda'}
              </DialogTitle>
            </DialogHeader>

            <div className="mt-4">
              {TransactionFormContent}
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Edição */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[500px] w-full max-h-[90vh] overflow-y-auto rounded-2xl p-0 gap-0 overflow-hidden">
            {editingTx && (
              <>
                <div className={`h-2 w-full ${editingTx.type === 'expense' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                <div className="p-6">
                  <DialogHeader className="mb-6">
                    <div className="flex items-center justify-between">
                      <DialogTitle className="text-xl flex items-center gap-2">
                        {editingTx.type === 'expense' ?
                          <div className="p-2 bg-red-100 text-red-600 rounded-full"><TrendingDown className="h-5 w-5" /></div> :
                          <div className="p-2 bg-emerald-100 text-emerald-600 rounded-full"><TrendingUp className="h-5 w-5" /></div>
                        }
                        <span>Editar {editingTx.type === 'expense' ? 'Gasto' : 'Renda'}</span>
                      </DialogTitle>
                      {editingTx.groupId && (
                        <span className="flex items-center text-[10px] bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200 font-medium">
                          <Layers className="h-3 w-3 mr-1" /> Parcelado
                        </span>
                      )}
                    </div>
                    <DialogDescription className="mt-1 ml-1">
                      {editingTx.groupId ? "Este item faz parte de um parcelamento/recorrência." : "Detalhes da transação única."}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Descrição</Label>
                      <Input
                        className="h-11 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 rounded-xl"
                        value={editingTx.description}
                        onChange={e => setEditingTx({ ...editingTx, description: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Valor</Label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-2.5 text-zinc-400 font-semibold">R$</span>
                          <Input
                            type="number"
                            className="pl-10 h-11 bg-zinc-50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 rounded-xl font-semibold text-lg"
                            placeholder="0,00"
                            value={editingTx.amount}
                            onChange={e => setEditingTx({ ...editingTx, amount: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Categoria</Label>
                        <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                          <SelectTrigger className="h-11 rounded-xl bg-zinc-50 border-zinc-200"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ALL_CATEGORIES.filter(cat => cat.type === editingTx.type || cat.type === 'both').map((cat) => (
                              <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-zinc-400 uppercase tracking-wider ml-1">Método de Pagamento</Label>
                      <Select value={editingTx.paymentMethod} onValueChange={(v) => setEditingTx({ ...editingTx, paymentMethod: v as PaymentMethod })}>
                        <SelectTrigger className="h-11 rounded-xl bg-zinc-50 border-zinc-200"><SelectValue /></SelectTrigger>
                        <SelectContent>{PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="bg-zinc-50/80 dark:bg-zinc-800/30 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800">
                      {editingTx.type === 'income' ? (
                        <div className="w-full space-y-2">
                          <Label className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Data de Crédito</Label>
                          <Input type="date" className="h-10 text-xs bg-white dark:bg-zinc-900 border-zinc-200 rounded-lg" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Data Compra</Label>
                            <Input type="date" className="h-10 text-xs bg-white dark:bg-zinc-900 border-zinc-200 rounded-lg" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                          </div>
                          {(editingTx.paymentMethod === 'boleto' || editingTx.paymentMethod === 'credit_card') && (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Vencimento</Label>
                              <Input type="date" className="h-10 text-xs bg-white dark:bg-zinc-900 border-red-200 rounded-lg" value={editingTx.dueDate} onChange={e => setEditingTx({ ...editingTx, dueDate: e.target.value })} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Button variant="ghost" className="w-full sm:w-auto h-11 hover:bg-zinc-100 rounded-xl font-medium text-zinc-500" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                    {editingTx.groupId ? (
                      <>
                        <Button variant="outline" className="w-full sm:w-auto h-11 rounded-xl font-medium border-zinc-200" onClick={() => handleConfirmEdit(false)}>Salvar Apenas Esta</Button>
                        <Button className="w-full sm:w-auto h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-lg shadow-violet-500/20" onClick={() => handleConfirmEdit(true)}>Salvar Todas</Button>
                      </>
                    ) : (
                      <Button className="w-full sm:w-auto h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-bold shadow-lg shadow-violet-500/20" onClick={() => handleConfirmEdit(false)}>Salvar Alterações</Button>
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
                Tem certeza? Você vai apagar: <br /> <span className="font-bold text-zinc-900 dark:text-white mt-1 block">{txToDelete?.description}</span>
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
                    className="w-full h-12 rounded-xl  sm:text-lg font-bold border-violet-200 text-violet-700 hover:bg-violet-50 shadow-lg shadow-violet-500/25 transition-all duration-400 hover:cursor-pointer"
                  >
                    <Medal className="inline-block h-6 w-6 text-violet-600 dark:text-violet-400" /> Premium
                  </Button>
                </Link>

                <Link href={plans.pro.paymentLink} target="_blank" className="block w-full">
                  <Button className="w-full h-12 rounded-xl bg-violet-600 hover:bg-violet-700  sm:text-lg font-bold shadow-lg shadow-violet-500/25 transition-all duration-400 hover:cursor-pointer">
                    <Medal className="inline-block h-6 w-6 text-zinc-100 dark:text-zinc-200" /> Pro
                  </Button>
                </Link>

                <Button
                  variant="ghost"
                  className="col-span-2 w-full h-12 sm:text-lg rounded-xl bg-violet-500 text-zinc-100 hover:bg-violet-700 hover:text-zinc-200 shadow-lg shadow-violet-500/25 transition-all duration-400 hover:cursor-pointer"
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
              <div className={`mx-auto p-3 rounded-full mb-2 w-fit ${feedbackModal.type === 'success' ? 'bg-emerald-100 text-emerald-600' : feedbackModal.type === 'error' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
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