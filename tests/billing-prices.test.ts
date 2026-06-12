import assert from "node:assert/strict";
import test from "node:test";

import { getPlanPrice, resolveBillingCurrency, resolveCheckoutAvailability } from "../src/lib/billing/prices";

test("keeps monthly prices centralized per currency", () => {
  assert.equal(getPlanPrice("premium", "BRL")?.amount, 19.9);
  assert.equal(getPlanPrice("premium", "USD")?.amount, 4.99);
  assert.equal(getPlanPrice("pro", "EUR")?.amount, 9.99);
});

test("routes BRL to Mercado Pago and blocks international checkout by default", () => {
  assert.deepEqual(resolveCheckoutAvailability("BRL"), { available: true, provider: "mercado_pago" });
  assert.equal(resolveCheckoutAvailability("USD").available, false);
  assert.equal(resolveBillingCurrency("JPY"), "BRL");
});
