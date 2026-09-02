import assert from "node:assert/strict";
import test from "node:test";

import { getConfiguredPublicPlans, normalizePlansConfig } from "../src/lib/plans/catalog";
import { DEFAULT_PLANS_CONFIG } from "../src/types/system";

test("configured public plans use admin price and visibility", () => {
  const plans = getConfiguredPublicPlans({
    ...DEFAULT_PLANS_CONFIG,
    premium: { ...DEFAULT_PLANS_CONFIG.premium, price: 24.9, yearlyPrice: 249, name: "Premium Teste" },
    pro: { ...DEFAULT_PLANS_CONFIG.pro, active: false },
  });

  const premium = plans.find((plan) => plan.id === "premium");
  assert.equal(premium?.monthlyPrice, 24.9);
  assert.equal(premium?.yearlyPrice, 249);
  assert.equal(premium?.publicName, "Premium Teste");
  assert.equal(plans.some((plan) => plan.id === "pro"), false);
});

test("family capacity is fixed and only the additional vacancy price is configurable", () => {
  const plans = normalizePlansConfig({
    family: {
      ...DEFAULT_PLANS_CONFIG.family,
      includedSeats: 99,
      maxAdditionalSeats: 1,
      additionalSeatPrice: 7.5,
      additionalSeatYearlyPrice: 1,
    },
  }, DEFAULT_PLANS_CONFIG);

  assert.equal(plans.family.includedSeats, 4);
  assert.equal(plans.family.maxAdditionalSeats, 16);
  assert.equal(plans.family.additionalSeatPrice, 7.5);
  assert.equal(plans.family.additionalSeatYearlyPrice, 90);
});

test("Foundation keeps its fixed commercial contract", () => {
  const plans = normalizePlansConfig({
    founder: {
      ...DEFAULT_PLANS_CONFIG.founder,
      name: "Outro nome",
      price: 1,
      yearlyPrice: 1,
      allowedProfileTypes: ["family"],
    },
  }, DEFAULT_PLANS_CONFIG);

  assert.equal(plans.founder.name, "Foundation");
  assert.equal(plans.founder.price, 9.9);
  assert.equal(plans.founder.yearlyPrice, null);
  assert.deepEqual(plans.founder.allowedProfileTypes, ["personal"]);
});
