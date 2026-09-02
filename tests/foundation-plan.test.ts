import assert from "node:assert/strict";
import test from "node:test";

import {
  FOUNDATION_MONTHLY_PRICE,
  addFoundationDuration,
  getFoundationBillingMetadata,
  hasFoundationOfferExpired,
} from "../src/lib/billing/foundation";
import { PLAN_CATALOG } from "../src/lib/plans/catalog";

test("Foundation has the same product capabilities as Pro", () => {
  assert.equal(FOUNDATION_MONTHLY_PRICE, 9.9);
  assert.deepEqual(PLAN_CATALOG.founder.limits, { ...PLAN_CATALOG.pro.limits, professionalProfiles: 1 });
  assert.deepEqual(PLAN_CATALOG.founder.features, PLAN_CATALOG.pro.features);
});

test("Foundation period lasts twelve calendar months and is preserved on sync", () => {
  const startedAt = "2026-09-02T12:00:00.000Z";
  const endsAt = addFoundationDuration(startedAt);
  assert.equal(endsAt, "2027-09-02T12:00:00.000Z");

  const firstActivation = getFoundationBillingMetadata({
    currentPlan: "free",
    targetPlan: "founder",
    billing: {},
    now: startedAt,
  });
  assert.equal(firstActivation.foundationStartedAt, startedAt);
  assert.equal(firstActivation.foundationEndsAt, endsAt);

  const sync = getFoundationBillingMetadata({
    currentPlan: "founder",
    targetPlan: "founder",
    billing: firstActivation,
    now: "2026-10-02T12:00:00.000Z",
  });
  assert.equal(sync.foundationEndsAt, endsAt);
  assert.equal(hasFoundationOfferExpired(sync, Date.parse("2027-09-02T12:00:00.000Z")), true);
});
