import assert from "node:assert/strict";
import test from "node:test";

import { canMatchWebhookByEmail } from "@/lib/billing/match";

test("canMatchWebhookByEmail accepts matching preapproval ids", () => {
  const allowed = canMatchWebhookByEmail(
    { plan: "premium", preapprovalId: "pre_123" },
    { preapprovalId: "pre_123" }
  );

  assert.equal(allowed, true);
});

test("canMatchWebhookByEmail accepts recent pending checkout signal", () => {
  const nowMs = new Date("2026-04-09T10:00:00.000Z").getTime();
  const allowed = canMatchWebhookByEmail(
    { plan: "pro", preapprovalId: undefined },
    {
      pendingPlan: "pro",
      pendingCheckoutAt: "2026-04-09T08:30:00.000Z",
      pendingCheckoutAttemptId: "attempt_123",
    },
    nowMs
  );

  assert.equal(allowed, true);
});

test("canMatchWebhookByEmail rejects stale or incomplete billing signals", () => {
  const nowMs = new Date("2026-04-09T18:00:00.000Z").getTime();
  const allowed = canMatchWebhookByEmail(
    { plan: "pro", preapprovalId: undefined },
    {
      pendingPlan: "pro",
      pendingCheckoutAt: "2026-04-09T08:30:00.000Z",
    },
    nowMs
  );

  assert.equal(allowed, false);
});
