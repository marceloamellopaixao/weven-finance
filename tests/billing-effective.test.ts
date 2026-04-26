import assert from "node:assert/strict";
import test from "node:test";

import { resolveEffectiveBillingState } from "@/lib/billing/effective";

test("resolveEffectiveBillingState keeps manual statuses when there is no irregular gateway signal", () => {
  const effective = resolveEffectiveBillingState({
    role: "client",
    plan: "pro",
    status: "active",
    paymentStatus: "pending",
    billing: {
      source: "manual",
      lastSyncAt: "2026-03-06T00:04:25.000Z",
    },
  });

  assert.equal(effective.shouldEnforce, false);
  assert.equal(effective.plan, "pro");
  assert.equal(effective.paymentStatus, "pending");
  assert.equal(effective.status, "active");
});

test("resolveEffectiveBillingState blocks paid plans with paused Mercado Pago subscriptions", () => {
  const effective = resolveEffectiveBillingState({
    role: "client",
    plan: "pro",
    status: "active",
    paymentStatus: "paid",
    billing: {
      source: "mercadopago_confirm",
      provider: "mercadopago",
      gatewayStatus: "paused",
      preapprovalId: "preapproval_123",
    },
  });

  assert.equal(effective.shouldEnforce, true);
  assert.equal(effective.plan, "free");
  assert.equal(effective.paymentStatus, "overdue");
  assert.equal(effective.status, "blocked");
  assert.equal(effective.blockReason, "Falta de Pagamento");
});

test("resolveEffectiveBillingState keeps exempt users active even with irregular gateway signal", () => {
  const effective = resolveEffectiveBillingState({
    role: "client",
    plan: "pro",
    status: "active",
    paymentStatus: "paid",
    billingExempt: true,
    billing: {
      source: "mercadopago_webhook",
      provider: "mercadopago",
      gatewayStatus: "paused",
    },
  });

  assert.equal(effective.shouldEnforce, false);
  assert.equal(effective.plan, "pro");
  assert.equal(effective.status, "active");
});

test("resolveEffectiveBillingState keeps trusted Mercado Pago paid subscriptions active", () => {
  const effective = resolveEffectiveBillingState({
    role: "client",
    plan: "pro",
    status: "active",
    paymentStatus: "paid",
    billing: {
      source: "mercadopago_confirm",
      provider: "mercadopago",
      gatewayStatus: "authorized",
      preapprovalId: "preapproval_123",
    },
  });

  assert.equal(effective.shouldEnforce, false);
  assert.equal(effective.plan, "pro");
  assert.equal(effective.paymentStatus, "paid");
  assert.equal(effective.status, "active");
});

test("resolveEffectiveBillingState reverts old overstrict system blocks without gateway evidence", () => {
  const effective = resolveEffectiveBillingState({
    role: "client",
    plan: "free",
    status: "blocked",
    paymentStatus: "not_paid",
    blockReason: "Falta de Pagamento",
    billing: {
      source: "system",
      gatewayPlan: "pro",
      lastError: "paid_plan_without_confirmed_payment",
    },
  });

  assert.equal(effective.shouldEnforce, true);
  assert.equal(effective.plan, "pro");
  assert.equal(effective.paymentStatus, "pending");
  assert.equal(effective.status, "active");
  assert.equal(effective.blockReason, "");
});
