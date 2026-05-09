import type { Transaction } from "@/types/transaction";

export type ReportSlice = {
  name: string;
  value: number;
  percentage: number;
};

export type MonthlyReport = {
  month: string;
  previousMonth?: string;
  totals: {
    income: number;
    expense: number;
    balance: number;
    paidExpense: number;
    pendingExpense: number;
    paidIncome: number;
    pendingIncome: number;
  };
  comparison: {
    incomeChange: number;
    expenseChange: number;
    balanceChange: number;
  } | null;
  highlights: {
    topExpenseCategory: ReportSlice | null;
    largestTransaction: Transaction | null;
    transactionCount: number;
  };
  categoryExpenses: ReportSlice[];
  categoryIncomes: ReportSlice[];
  paymentMethods: ReportSlice[];
  dailyEvolution: Array<{
    date: string;
    income: number;
    expense: number;
    balance: number;
  }>;
  transactions: Transaction[];
};
