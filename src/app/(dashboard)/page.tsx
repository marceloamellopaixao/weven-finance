"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import {
  addTransaction,
  deleteTransaction,
  updateTransaction,
  toggleTransactionStatus,
  getUserSettings,
  updateUserBalance
} from "@/services/transactionService";
import AreaChart from "@/components/charts/AreaChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  LogOut, Plus, Wallet, TrendingDown, TrendingUp,
  DollarSign, CalendarDays, MoreHorizontal, Pencil, Trash2,
  AlertCircle, Layers, ShoppingBag, CreditCard, Calendar, ChevronLeft, ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Transaction, PaymentMethod } from "@/types/transaction";

// --- Configurações Visuais ---
const CATEGORIES = [
  { name: "Casa", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Alimentação", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "Investimento", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { name: "Manutenção Carro", color: "bg-red-50 text-red-700 border-red-200" },
  { name: "Dízimo", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "Compras", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "Outros", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit_card", label: "Débito" },
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cash", label: "Dinheiro" },
  { value: "transfer", label: "Transferência" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { transactions, loading } = useTransactions();
  const router = useRouter();

  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // --- LÓGICA DE MESES DISPONÍVEIS ---
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();

    // 1. Garante que o mês atual (selecionado) sempre apareça, mesmo se vazio
    monthsSet.add(selectedMonth);

    // 2. Adiciona apenas meses que têm transações
    transactions.forEach(t => {
      if (t.dueDate) {
        monthsSet.add(t.dueDate.slice(0, 7)); // Pega YYYY-MM
      }
    });

    // 3. Ordena cronologicamente e Formata
    return Array.from(monthsSet).sort().map(monthStr => {
      const [year, month] = monthStr.split('-').map(Number);
      // Cria data corrigindo fuso horário (meio dia para evitar pular dia)
      const date = new Date(year, month - 1, 2);
      const label = date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      return {
        value: monthStr,
        label: label.charAt(0).toUpperCase() + label.slice(1)
      };
    });
  }, [transactions, selectedMonth]);

  // Navegação inteligente entre meses existentes
  const changeMonth = (offset: number) => {
    const currentIndex = availableMonths.findIndex(m => m.value === selectedMonth);
    const newIndex = currentIndex + offset;

    // Se existir um mês na lista naquela direção, vai para ele
    if (newIndex >= 0 && newIndex < availableMonths.length) {
      setSelectedMonth(availableMonths[newIndex].value);
    } else {
      // Se não existir na lista (ex: quer ir para um futuro vazio), 
      // calculamos manualmente para permitir "criar" um novo mês
      const [year, month] = selectedMonth.split('-').map(Number);
      const newDate = new Date(year, month - 1 + offset, 1);
      setSelectedMonth(newDate.toISOString().slice(0, 7));
    }
  };

  // --- Form States ---
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("credit_card");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- UI States ---
  const [bankBalance, setBankBalance] = useState(0);
  const [isEditingBalance, setIsEditingBalance] = useState(false);
  const [tempBalance, setTempBalance] = useState("");

  // --- Modais ---
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txToDelete, setTxToDelete] = useState<Transaction | null>(null);

  useEffect(() => {
    if (user) {
      getUserSettings(user.uid).then(settings => {
        setBankBalance(settings.currentBalance);
        setTempBalance(settings.currentBalance.toString());
      });
    }
  }, [user]);

  if (!user && !loading) {
    router.push("/login");
    return null;
  }

  // --- Handlers ---

  const handleAdd = async () => {
    if (!desc || !amount || !category) return;
    setIsSubmitting(true);

    try {
      await addTransaction(user!.uid, {
        description: desc,
        amount: Number(amount),
        type: "expense",
        category: category,
        paymentMethod: paymentMethod,
        date: date,
        dueDate: dueDate,
        isInstallment,
        installmentsCount: Number(installmentsCount)
      });
      setDesc("");
      setAmount("");
      setIsInstallment(false);
      setInstallmentsCount("2");
      // Opcional: Ir para o mês da 1ª parcela se não estiver nele
      // setSelectedMonth(dueDate.slice(0, 7)); 
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

  const openEditModal = (tx: Transaction) => {
    setEditingTx({ ...tx });
    setIsEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTx || !user || !editingTx.id) return;
    await updateTransaction(user.uid, editingTx.id, {
      description: editingTx.description,
      amount: Number(editingTx.amount),
      category: editingTx.category,
      dueDate: editingTx.dueDate,
      date: editingTx.date
    });
    setIsEditOpen(false);
    setEditingTx(null);
  };

  const handleUpdateBalance = async () => {
    const val = Number(tempBalance);
    setBankBalance(val);
    setIsEditingBalance(false);
    if (user) await updateUserBalance(user.uid, val);
  };

  // --- Filtros & Cálculos ---

  const filteredTransactions = transactions.filter(t => t.dueDate && t.dueDate.startsWith(selectedMonth));

  const pendingExpenses = filteredTransactions
    .filter(t => t.type === 'expense' && t.status === 'pending')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const projectedBalance = bankBalance - pendingExpenses;

  const chartData = filteredTransactions.map(t => ({
    name: new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit' }),
    amount: t.amount
  })).reverse();

  const getCategoryStyle = (catName: string) =>
    CATEGORIES.find(c => c.name === catName)?.color || "bg-gray-100 text-gray-800 border-gray-200";

  const isOverdue = (tx: Transaction) => {
    if (tx.status === 'paid') return false;
    const today = new Date().toISOString().split('T')[0];
    return tx.dueDate < today;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-zinc-950 font-sans">

      {/* --- Navbar Moderna --- */}
      <nav className="sticky top-0 z-40 w-full border-b bg-white/80 backdrop-blur-md px-4 md:px-8 h-16 flex items-center justify-between dark:bg-black/80">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-xl">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <span className="font-bold text-lg tracking-tight">Weven<span className="text-primary">Finance</span></span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-sm font-semibold leading-none">{user?.displayName}</p>
            <p className="text-xs text-muted-foreground">Plano Free</p>
          </div>
          <Avatar className="h-9 w-9 border cursor-pointer ring-2 ring-transparent hover:ring-primary/20 transition-all">
            <AvatarImage src={user?.photoURL || ""} />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
          <Button variant="ghost" size="icon" onClick={logout} className="text-muted-foreground hover:text-red-500">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <main className="container mx-auto p-4 md:p-8 space-y-8 max-w-7xl">

        {/* --- Header & Seletor de Data --- */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Visão Geral</h1>
            <p className="text-muted-foreground">Controle seus gastos e previsões.</p>
          </div>

          {/* SELETOR DE MÊS DROPDOWN (DINÂMICO) */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Apliquei w-[200px] direto no Trigger para travar o tamanho */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px] h-9 border shadow-sm focus:ring-0 font-medium flex items-center justify-center gap-2 bg-white dark:bg-card">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Selecione o mês" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {availableMonths.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* --- KPI Cards (Design Limpo) --- */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Card: Saldo */}
          <Card className="relative overflow-hidden border shadow-sm hover:shadow-md transition-all group">
            <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditingBalance(!isEditingBalance)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Disponível</CardTitle>
              <div className="p-2 bg-blue-50 rounded-full dark:bg-blue-900/20">
                <DollarSign className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
            </CardHeader>
            <CardContent>
              {isEditingBalance ? (
                <div className="flex items-center gap-2 mt-1">
                  <Input
                    type="number"
                    value={tempBalance}
                    onChange={e => setTempBalance(e.target.value)}
                    className="h-8 text-xl font-bold"
                    autoFocus
                  />
                  <Button size="sm" className="h-8" onClick={handleUpdateBalance}>OK</Button>
                </div>
              ) : (
                <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bankBalance)}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: A Pagar */}
          <Card className="border shadow-sm hover:shadow-md transition-all">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Contas Abertas (Mês)</CardTitle>
              <div className="p-2 bg-red-50 rounded-full dark:bg-red-900/20">
                <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight text-red-600">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(pendingExpenses)}
              </div>
            </CardContent>
          </Card>

          {/* Card: Projetado */}
          <Card className={`border shadow-sm hover:shadow-md transition-all ${projectedBalance >= 0 ? 'bg-linear-to-br from-white to-green-50/50 dark:from-zinc-900 dark:to-green-900/10' : 'bg-linear-to-br from-white to-red-50/50 dark:from-zinc-900 dark:to-red-900/10'}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Saldo Projetado</CardTitle>
              <div className="p-2 bg-green-50 rounded-full dark:bg-green-900/20">
                <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tracking-tight ${projectedBalance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(projectedBalance)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Ao final do mês</p>
            </CardContent>
          </Card>
        </div>

        {/* --- Layout Principal --- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

          {/* Coluna da Esquerda: Gráficos e Tabelas (Ocupa 2/3) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Gráfico */}
            <Card className="border shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Fluxo de Saída</CardTitle>
                <CardDescription>Visualização de vencimentos diários.</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px]">
                <AreaChart data={chartData} />
              </CardContent>
            </Card>

            {/* Lista de Transações */}
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="bg-slate-50/50 dark:bg-zinc-900/50 border-b py-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">Fatura / Contas</CardTitle>
                    <CardDescription>Vencimentos em {new Date(selectedMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}.</CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-white dark:bg-zinc-800">
                    {filteredTransactions.length} Lançamentos
                  </Badge>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[60px] text-center">STS</TableHead>
                      <TableHead>Detalhes</TableHead>
                      <TableHead className="w-[140px]">Vencimento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="w-[50px] text-center"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Tudo limpo! Nenhuma conta para este mês.</TableCell></TableRow>
                    ) : (
                      filteredTransactions.map((tx) => {
                        const overdue = isOverdue(tx);
                        return (
                          <TableRow key={tx.id} className={`group transition-colors ${overdue ? 'bg-red-50/60 dark:bg-red-900/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-900/50'}`}>
                            {/* Checkbox Centralizado */}
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center">
                                <Checkbox
                                  checked={tx.status === 'paid'}
                                  onCheckedChange={() => { if (tx.id) toggleTransactionStatus(user!.uid, tx.id, tx.status); }}
                                  className="data-[state=checked]:bg-green-500 border-slate-300 w-5 h-5"
                                />
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col gap-1.5">
                                <span className={`font-semibold text-sm ${tx.status === 'paid' ? 'line-through text-muted-foreground' : 'text-slate-700 dark:text-slate-200'}`}>
                                  {tx.description}
                                </span>

                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Badge Categoria */}
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${getCategoryStyle(tx.category)}`}>
                                    {tx.category}
                                  </span>

                                  {/* Badge Parcelamento */}
                                  {tx.groupId && (
                                    <span className="flex items-center text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700">
                                      <Layers className="h-3 w-3 mr-1" />
                                      {tx.installmentCurrent}/{tx.installmentTotal}
                                    </span>
                                  )}

                                  {/* Data Compra */}
                                  <span className="text-[10px] text-muted-foreground flex items-center">
                                    <ShoppingBag className="h-3 w-3 mr-1" />
                                    {new Date(tx.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                  </span>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell className="align-middle">
                              <div className="flex flex-col text-sm">
                                <span className={`flex items-center font-medium ${overdue ? "text-red-600" : "text-slate-600 dark:text-slate-400"}`}>
                                  <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                                  {new Date(tx.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                                  {overdue && <AlertCircle className="h-3.5 w-3.5 ml-1 text-red-600" />}
                                </span>
                                {paymentMethod === 'credit_card' && <span className="text-[10px] text-muted-foreground ml-5">Fatura</span>}
                              </div>
                            </TableCell>

                            <TableCell className="text-right align-middle">
                              <span className={`font-bold text-base ${tx.status === 'paid' ? 'text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(tx.amount)}
                              </span>
                            </TableCell>

                            {/* Ações Centralizadas */}
                            <TableCell className="text-center align-middle">
                              <div className="flex justify-center">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0 hover:bg-slate-200 dark:hover:bg-zinc-800"><MoreHorizontal className="h-4 w-4 text-slate-500" /></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-40">
                                    <DropdownMenuItem onClick={() => openEditModal(tx)} className="cursor-pointer">
                                      <Pencil className="mr-2 h-4 w-4" /> Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setTxToDelete(tx)} className="text-red-600 focus:text-red-600 cursor-pointer">
                                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
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
            </Card>
          </div>

          {/* Coluna da Direita: Formulário Fixo (Ocupa 1/3) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">

              <Card className="border-t-4 border-t-primary shadow-lg bg-white dark:bg-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="p-1.5 bg-primary rounded-md text-primary-foreground">
                      <Plus className="h-4 w-4" />
                    </div>
                    Nova Despesa
                  </CardTitle>
                  <CardDescription>Adicione gastos rapidamente.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Bloco 1: O que e Quanto */}
                  <div className="space-y-3">
                    <div>
                      <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Detalhes</Label>
                      <Input
                        className="mt-1.5"
                        placeholder="Descrição (ex: Netflix)"
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-slate-400">R$</span>
                        <Input
                          type="number"
                          className="pl-9 font-semibold"
                          placeholder="0,00"
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Classificação */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Categoria</Label>
                      <Select onValueChange={setCategory} value={category}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map((cat) => <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Método</Label>
                      <Select onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} value={paymentMethod}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => <SelectItem key={method.value} value={method.value}>{method.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Bloco 3: Datas */}
                  <div className="bg-slate-50 dark:bg-zinc-900/50 p-3 rounded-lg border space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-slate-500 uppercase">Comprou em</Label>
                        <Input type="date" className="h-8 text-xs bg-white dark:bg-black" value={date} onChange={e => setDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-red-500 uppercase font-bold">Vence em</Label>
                        <Input type="date" className="h-8 text-xs bg-white dark:bg-black border-red-200 focus-visible:ring-red-200" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                      </div>
                    </div>

                    {/* Switch Parcelado */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <Label htmlFor="inst-switch" className="text-xs cursor-pointer flex items-center gap-2">
                        <Layers className="h-3 w-3" /> É Parcelado?
                      </Label>
                      <Switch id="inst-switch" className="scale-75" checked={isInstallment} onCheckedChange={setIsInstallment} />
                    </div>

                    {isInstallment && (
                      <div className="animate-in slide-in-from-top-2 pt-2">
                        <Label className="text-xs">Nº Parcelas</Label>
                        <Input
                          type="number"
                          className="h-8 mt-1 bg-white dark:bg-black"
                          min="2" max="60"
                          value={installmentsCount}
                          onChange={e => setInstallmentsCount(e.target.value)}
                        />
                        <p className="text-[10px] text-slate-400 mt-1 italic">
                          O sistema criará lançamentos futuros automaticamente.
                        </p>
                      </div>
                    )}
                  </div>

                  <Button onClick={handleAdd} className="w-full font-bold shadow-sm" disabled={isSubmitting}>
                    {isSubmitting ? "Processando..." : "Confirmar Despesa"}
                  </Button>
                </CardContent>
              </Card>

              {/* Banner Informativo */}
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-xs flex gap-3 border border-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-900">
                <CreditCard className="h-5 w-5 shrink-0" />
                <p>Para cartões de crédito, a data de vencimento deve ser o dia do pagamento da fatura.</p>
              </div>

            </div>
          </div>
        </div>

        {/* --- MODAIS CORRIGIDOS (Responsivos e com Scroll) --- */}

        {/* Modal de Edição */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[500px] w-full max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Lançamento</DialogTitle>
              <DialogDescription>Atualize os dados da transação. Alterações de valor afetam todas as parcelas do grupo.</DialogDescription>
            </DialogHeader>
            {editingTx && (
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={editingTx.description} onChange={e => setEditingTx({ ...editingTx, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <Input type="number" value={editingTx.amount} onChange={e => setEditingTx({ ...editingTx, amount: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-zinc-900 p-3 rounded-md border">
                  <div className="space-y-2">
                    <Label className="text-xs">Data Compra</Label>
                    <Input type="date" value={editingTx.date} onChange={e => setEditingTx({ ...editingTx, date: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-red-600">Vencimento</Label>
                    <Input type="date" value={editingTx.dueDate} onChange={e => setEditingTx({ ...editingTx, dueDate: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEdit}>Salvar Alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal de Exclusão */}
        <Dialog open={!!txToDelete} onOpenChange={(open) => !open && setTxToDelete(null)}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                Excluir Transação
              </DialogTitle>
              <DialogDescription className="pt-2">
                Você está prestes a excluir: <span className="font-bold text-foreground block mt-1 text-lg">{txToDelete?.description}</span>
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 py-4">
              {txToDelete?.groupId && (
                <div className="bg-orange-50 text-orange-800 p-3 rounded text-sm border border-orange-200 dark:bg-orange-900/20 dark:text-orange-200">
                  ⚠️ Este item faz parte de um parcelamento ({txToDelete.installmentCurrent}/{txToDelete.installmentTotal}).
                </div>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button className="w-full sm:w-auto" variant="ghost" onClick={() => setTxToDelete(null)}>
                Cancelar
              </Button>

              {txToDelete?.groupId ? (
                <>
                  <Button className="w-full sm:w-auto" variant="outline" onClick={() => handleConfirmDelete(false)}>
                    Apenas Esta
                  </Button>
                  <Button className="w-full sm:w-auto" variant="destructive" onClick={() => handleConfirmDelete(true)}>
                    Todas as Parcelas
                  </Button>
                </>
              ) : (
                <Button className="w-full sm:w-auto" variant="destructive" onClick={() => handleConfirmDelete(false)}>
                  Confirmar Exclusão
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}