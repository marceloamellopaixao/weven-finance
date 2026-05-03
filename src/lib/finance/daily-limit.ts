import type { PaymentCard } from "@/types/paymentCard";
import type { Transaction } from "@/types/transaction";

export type DailyLimitRisk = "positive" | "neutral" | "warning" | "danger";

export type DailyLimitInput = {
  transactions: Pick<Transaction, "amount" | "amountForLimit" | "type" | "status" | "dueDate" | "date" | "paymentMethod" | "cardId" | "isRecurring" | "recurringRole">[];
  cards?: Pick<PaymentCard, "id" | "type" | "creditLimit">[];
  today?: string;
  month?: string;
  goalReserve?: number;
};

export type DailyLimitResult = {
  month: string;
  today: string;
  daysRemaining: number;
  currentBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  currentMonthCardImpact: number;
  goalReserve: number;
  projectedEndBalance: number;
  amount: number | null;
  risk: DailyLimitRisk;
  daysUntilPressure: number | null;
};

const toDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const toMonthKey = (dateKey: string) => dateKey.slice(0, 7);

function getDaysRemaining(today: string, month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(monthNumber)) return 0;
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const currentMonth = toMonthKey(today);
  if (month < currentMonth) return 0;
  if (month > currentMonth) return daysInMonth;
  const day = Number(today.slice(8, 10));
  return Math.max(1, daysInMonth - day + 1);
}

function signedAmount(transaction: DailyLimitInput["transactions"][number]) {
  const amount = Number(transaction.amount || 0);
  return transaction.type === "income" ? amount : -amount;
}

function isRealOccurrence(transaction: DailyLimitInput["transactions"][number]) {
  return transaction.recurringRole !== "template";
}

export function calculateDailyLimit(input: DailyLimitInput): DailyLimitResult {
  const today = input.today || toDateKey();
  const month = input.month || toMonthKey(today);
  const goalReserve = Math.max(0, Number(input.goalReserve || 0));
  const daysRemaining = getDaysRemaining(today, month);
  const cardById = new Map((input.cards || []).map((card) => [card.id, card]));
  const transactions = input.transactions.filter(isRealOccurrence);

  const currentBalance = transactions.reduce((acc, transaction) => {
    const dueDate = transaction.dueDate || transaction.date || today;
    if (transaction.status === "paid" || dueDate < today) return acc + signedAmount(transaction);
    return acc;
  }, 0);

  const pendingInMonth = transactions.filter((transaction) => {
    const dueDate = transaction.dueDate || transaction.date || "";
    return transaction.status !== "paid" && dueDate >= today && dueDate.startsWith(month);
  });

  const pendingIncome = pendingInMonth
    .filter((transaction) => transaction.type === "income")
    .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

  const pendingExpenses = pendingInMonth
    .filter((transaction) => transaction.type === "expense")
    .reduce((acc, transaction) => acc + Number(transaction.amount || 0), 0);

  const currentMonthCardImpact = pendingInMonth
    .filter((transaction) => {
      if (transaction.paymentMethod !== "credit_card") return false;
      const card = transaction.cardId ? cardById.get(transaction.cardId) : null;
      return !card || card.type === "credit_card" || card.type === "credit_and_debit";
    })
    .reduce((acc, transaction) => acc + Number(transaction.amountForLimit ?? transaction.amount ?? 0), 0);

  const projectedEndBalance = currentBalance + pendingIncome - pendingExpenses - goalReserve;
  const amount = daysRemaining > 0 ? projectedEndBalance / daysRemaining : null;
  const risk: DailyLimitRisk =
    amount === null ? "neutral" : amount < 0 ? "danger" : amount < 25 ? "warning" : amount < 50 ? "neutral" : "positive";
  const daysUntilPressure =
    amount === null || projectedEndBalance <= 0 || pendingExpenses <= 0
      ? amount !== null && projectedEndBalance <= 0 ? 0 : null
      : Math.max(1, Math.floor(projectedEndBalance / Math.max(1, pendingExpenses / Math.max(1, daysRemaining))));

  return {
    month,
    today,
    daysRemaining,
    currentBalance,
    pendingIncome,
    pendingExpenses,
    currentMonthCardImpact,
    goalReserve,
    projectedEndBalance,
    amount,
    risk,
    daysUntilPressure,
  };
}

