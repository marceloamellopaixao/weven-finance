import assert from "node:assert/strict";
import test from "node:test";

import { getConfiguredPublicPlans } from "../src/lib/plans/catalog";
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
