import assert from "node:assert/strict";
import test from "node:test";

import { buildMonthlyReport } from "../src/lib/reports/monthlyReport";
import type { Transaction } from "../src/types/transaction";

function tx(input: Partial<Transaction> & Pick<Transaction, "amount" | "type" | "category" | "dueDate">): Transaction {
  return {
    id: crypto.randomUUID(),
    userId: "user_1",
    description: input.description || input.title || "Lançamento",
    title: input.title,
    amount: input.amount,
    type: input.type,
    category: input.category,
    status: input.status || "pending",
    paymentMethod: input.paymentMethod || "pix",
    date: input.date || input.dueDate,
    dueDate: input.dueDate,
    createdAt: input.createdAt || new Date().toISOString(),
    isArchived: input.isArchived,
  };
}

test("buildMonthlyReport calculates totals and category groups for selected month", () => {
  const report = buildMonthlyReport(
    [
      tx({ amount: 5000, type: "income", category: "Salário", status: "paid", dueDate: "2026-05-05" }),
      tx({ amount: 800, type: "expense", category: "Mercado", status: "paid", paymentMethod: "debit_card", dueDate: "2026-05-06" }),
      tx({ amount: 200, type: "expense", category: "Mercado", status: "pending", paymentMethod: "credit_card", dueDate: "2026-05-10" }),
      tx({ amount: 100, type: "expense", category: "Lazer", status: "pending", dueDate: "2026-04-10" }),
      tx({ amount: 999, type: "expense", category: "Arquivada", status: "paid", dueDate: "2026-05-12", isArchived: true }),
    ],
    "2026-05"
  );

  assert.equal(report.totals.income, 5000);
  assert.equal(report.totals.expense, 1000);
  assert.equal(report.totals.balance, 4000);
  assert.equal(report.totals.paidExpense, 800);
  assert.equal(report.totals.pendingExpense, 200);
  assert.equal(report.highlights.transactionCount, 3);
  assert.equal(report.categoryExpenses[0].name, "Mercado");
  assert.equal(report.categoryExpenses[0].value, 1000);
});

test("buildMonthlyReport returns empty structures when month has no transactions", () => {
  const report = buildMonthlyReport(
    [tx({ amount: 1200, type: "income", category: "Cliente", status: "paid", dueDate: "2026-04-02" })],
    "2026-05"
  );

  assert.equal(report.totals.income, 0);
  assert.equal(report.totals.expense, 0);
  assert.equal(report.highlights.transactionCount, 0);
  assert.equal(report.categoryExpenses.length, 0);
  assert.equal(report.categoryIncomes.length, 0);
  assert.equal(report.paymentMethods.length, 0);
});

test("buildMonthlyReport formats linked category names for report slices", () => {
  const report = buildMonthlyReport(
    [
      tx({ amount: 250, type: "expense", category: "Carro::Manutencao", status: "paid", dueDate: "2026-05-08" }),
    ],
    "2026-05"
  );

  assert.equal(report.categoryExpenses[0].name, "Carro / Manutencao");
});
