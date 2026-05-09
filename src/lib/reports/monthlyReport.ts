import type { MonthlyReport, ReportSlice } from "@/types/report";
import type { PaymentMethod, Transaction } from "@/types/transaction";
import { formatCategoryLabel } from "@/lib/category-utils";

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cash: "Dinheiro",
  transfer: "Transferência",
  debit_card: "Cartão de débito",
  credit_card: "Cartão de crédito",
};

export function formatPaymentMethodLabel(method?: string) {
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] || method || "Outro";
}

export function formatReportCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function normalizeReportData(transactions: Transaction[]) {
  return transactions
    .filter((transaction) => !transaction.isArchived)
    .map((transaction) => ({
      ...transaction,
      amount: Number.isFinite(Number(transaction.amount)) ? Number(transaction.amount) : 0,
      title: transaction.title || transaction.description || "Lançamento",
      dueDate: transaction.dueDate || transaction.date,
    }));
}

function getPreviousMonthKey(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toPercentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Number(((value / total) * 100).toFixed(1));
}

export function groupByCategory(transactions: Transaction[], type: "income" | "expense"): ReportSlice[] {
  const groups = new Map<string, number>();
  for (const transaction of transactions) {
    if (transaction.type !== type) continue;
    const key = formatCategoryLabel(transaction.category || "Sem categoria");
    groups.set(key, (groups.get(key) || 0) + Number(transaction.amount || 0));
  }
  const total = Array.from(groups.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value, percentage: toPercentage(value, total) }))
    .sort((a, b) => b.value - a.value);
}

export function groupByPaymentMethod(transactions: Transaction[]): ReportSlice[] {
  const groups = new Map<string, number>();
  for (const transaction of transactions) {
    const label = formatPaymentMethodLabel(transaction.paymentMethod);
    groups.set(label, (groups.get(label) || 0) + Number(transaction.amount || 0));
  }
  const total = Array.from(groups.values()).reduce((sum, value) => sum + value, 0);
  return Array.from(groups.entries())
    .map(([name, value]) => ({ name, value, percentage: toPercentage(value, total) }))
    .sort((a, b) => b.value - a.value);
}

export function calculateTotals(transactions: Transaction[]) {
  const totals = {
    income: 0,
    expense: 0,
    balance: 0,
    paidExpense: 0,
    pendingExpense: 0,
    paidIncome: 0,
    pendingIncome: 0,
  };

  for (const transaction of transactions) {
    const amount = Number(transaction.amount || 0);
    if (transaction.type === "income") {
      totals.income += amount;
      if (transaction.status === "paid") totals.paidIncome += amount;
      else totals.pendingIncome += amount;
    } else {
      totals.expense += amount;
      if (transaction.status === "paid") totals.paidExpense += amount;
      else totals.pendingExpense += amount;
    }
  }

  totals.balance = totals.income - totals.expense;
  return totals;
}

export function calculateMonthComparison(transactions: Transaction[], selectedMonth: string) {
  const previousMonth = getPreviousMonthKey(selectedMonth);
  const current = calculateTotals(transactions.filter((transaction) => transaction.dueDate?.startsWith(selectedMonth)));
  const previous = calculateTotals(transactions.filter((transaction) => transaction.dueDate?.startsWith(previousMonth)));

  if (previous.income === 0 && previous.expense === 0 && previous.balance === 0) return null;

  return {
    incomeChange: current.income - previous.income,
    expenseChange: current.expense - previous.expense,
    balanceChange: current.balance - previous.balance,
  };
}

function buildDailyEvolution(transactions: Transaction[], selectedMonth: string) {
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  let accumulatedBalance = 0;

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    const date = `${selectedMonth}-${day}`;
    const dayTransactions = transactions.filter((transaction) => transaction.dueDate === date);
    const income = dayTransactions
      .filter((transaction) => transaction.type === "income")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const expense = dayTransactions
      .filter((transaction) => transaction.type === "expense")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    accumulatedBalance += income - expense;
    return { date: day, income, expense, balance: accumulatedBalance };
  });
}

export function buildMonthlyReport(transactions: Transaction[], selectedMonth: string): MonthlyReport {
  const normalized = normalizeReportData(transactions);
  const monthTransactions = normalized
    .filter((transaction) => transaction.dueDate?.startsWith(selectedMonth))
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const totals = calculateTotals(monthTransactions);
  const categoryExpenses = groupByCategory(monthTransactions, "expense");
  const categoryIncomes = groupByCategory(monthTransactions, "income");
  const largestTransaction = monthTransactions.reduce<Transaction | null>((largest, transaction) => {
    if (!largest) return transaction;
    return Number(transaction.amount || 0) > Number(largest.amount || 0) ? transaction : largest;
  }, null);

  return {
    month: selectedMonth,
    previousMonth: getPreviousMonthKey(selectedMonth),
    totals,
    comparison: calculateMonthComparison(normalized, selectedMonth),
    highlights: {
      topExpenseCategory: categoryExpenses[0] || null,
      largestTransaction,
      transactionCount: monthTransactions.length,
    },
    categoryExpenses,
    categoryIncomes,
    paymentMethods: groupByPaymentMethod(monthTransactions),
    dailyEvolution: buildDailyEvolution(monthTransactions, selectedMonth),
    transactions: monthTransactions,
  };
}
