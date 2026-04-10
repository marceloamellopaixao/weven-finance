import test from "node:test";
import assert from "node:assert/strict";
import { buildInstallmentPlan } from "@/lib/transactions/installments";

test("buildInstallmentPlan divides total amount across installments", () => {
  const plan = buildInstallmentPlan(100, 3, "split_total");

  assert.equal(plan.count, 3);
  assert.equal(plan.totalAmount, 100);
  assert.deepEqual(plan.installmentAmounts, [33.34, 33.33, 33.33]);
});

test("buildInstallmentPlan keeps the typed value on every installment", () => {
  const plan = buildInstallmentPlan(100, 3, "repeat_value");

  assert.equal(plan.count, 3);
  assert.equal(plan.totalAmount, 300);
  assert.deepEqual(plan.installmentAmounts, [100, 100, 100]);
});
