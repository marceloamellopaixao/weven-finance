import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateCurrentCashBalance,
  calculateProjectedCashBalance,
} from "@/lib/finance/cash-flow";

const transactions = [
  { type: "income" as const, amount: 914.92, status: "paid" as const, dueDate: "2026-09-04" },
  { type: "expense" as const, amount: 596.66, status: "pending" as const, dueDate: "2026-09-04" },
  { type: "expense" as const, amount: 90.96, status: "pending" as const, dueDate: "2026-09-07" },
];

test("current cash balance does not subtract overdue pending bills", () => {
  assert.equal(calculateCurrentCashBalance(transactions), 914.92);
});

test("closing forecast includes overdue pending bills without double counting them", () => {
  assert.equal(calculateProjectedCashBalance(transactions, "2026-09-30"), 227.3);
});

test("recurring templates do not affect cash or forecasts", () => {
  const template = {
    type: "expense" as const,
    amount: 200,
    status: "pending" as const,
    dueDate: "2026-09-10",
    recurringRole: "template" as const,
  };

  assert.equal(calculateCurrentCashBalance([...transactions, template]), 914.92);
  assert.equal(calculateProjectedCashBalance([...transactions, template], "2026-09-30"), 227.3);
});
