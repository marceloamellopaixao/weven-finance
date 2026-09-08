import test from "node:test";
import assert from "node:assert/strict";

import { calculateDailyLimit } from "@/lib/finance/daily-limit";

test("calculateDailyLimit distributes projected month balance across remaining days", () => {
  const result = calculateDailyLimit({
    today: "2026-05-11",
    month: "2026-05",
    transactions: [
      { type: "income", amount: 3000, status: "paid", dueDate: "2026-05-05", date: "2026-05-05", paymentMethod: "pix" },
      { type: "expense", amount: 900, status: "pending", dueDate: "2026-05-20", date: "2026-05-10", paymentMethod: "boleto" },
    ],
  });

  assert.equal(result.daysRemaining, 21);
  assert.equal(result.projectedEndBalance, 2100);
  assert.equal(result.amount, 100);
});

test("calculateDailyLimit ignores recurring templates and counts only real occurrences", () => {
  const result = calculateDailyLimit({
    today: "2026-05-11",
    month: "2026-05",
    transactions: [
      { type: "income", amount: 1000, status: "paid", dueDate: "2026-05-05", date: "2026-05-05", paymentMethod: "pix" },
      { type: "expense", amount: 200, status: "pending", dueDate: "2026-05-15", date: "2026-05-15", paymentMethod: "pix", recurringRole: "template" },
      { type: "expense", amount: 200, status: "pending", dueDate: "2026-05-15", date: "2026-05-15", paymentMethod: "pix", recurringRole: "occurrence" },
    ],
  });

  assert.equal(result.projectedEndBalance, 800);
});

test("calculateDailyLimit reports current month credit card impact", () => {
  const result = calculateDailyLimit({
    today: "2026-05-11",
    month: "2026-05",
    cards: [{ id: "card-1", type: "credit_card", creditLimit: 1000 }],
    transactions: [
      { type: "income", amount: 1000, status: "paid", dueDate: "2026-05-05", date: "2026-05-05", paymentMethod: "pix" },
      { type: "expense", amount: 150, amountForLimit: 150, status: "pending", dueDate: "2026-05-20", date: "2026-05-10", paymentMethod: "credit_card", cardId: "card-1" },
    ],
  });

  assert.equal(result.currentMonthCardImpact, 150);
});

test("calculateDailyLimit keeps overdue pending bills out of current cash and in the forecast", () => {
  const result = calculateDailyLimit({
    today: "2026-09-08",
    month: "2026-09",
    transactions: [
      { type: "income", amount: 914.92, status: "paid", dueDate: "2026-09-04", date: "2026-09-04", paymentMethod: "pix" },
      { type: "expense", amount: 596.66, status: "pending", dueDate: "2026-09-04", date: "2026-09-04", paymentMethod: "boleto" },
      { type: "expense", amount: 90.96, status: "pending", dueDate: "2026-09-07", date: "2026-09-07", paymentMethod: "pix" },
    ],
  });

  assert.equal(result.currentBalance, 914.92);
  assert.equal(result.pendingExpenses, 687.62);
  assert.equal(result.projectedEndBalance, 227.3);
});
