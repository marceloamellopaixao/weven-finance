import assert from "node:assert/strict";
import test from "node:test";

import { hasBillingExemption } from "@/lib/access-control/config";
import { DEFAULT_ACCESS_CONTROL_CONFIG } from "@/types/system";

test("hasBillingExemption accepts role and user rules only", () => {
  const config = {
    ...DEFAULT_ACCESS_CONTROL_CONFIG,
    rules: [
      ...DEFAULT_ACCESS_CONTROL_CONFIG.rules,
      {
        id: "plan-pro-billing-exempt-test",
        subjectType: "plan" as const,
        subjectId: "pro",
        resource: "billing.exempt" as const,
        level: "read" as const,
        active: true,
      },
      {
        id: "user-billing-exempt-test",
        subjectType: "user" as const,
        subjectId: "user_123",
        resource: "billing.exempt" as const,
        level: "read" as const,
        active: true,
      },
    ],
  };

  assert.equal(hasBillingExemption(config, { uid: "user_123", role: "client" }), true);
  assert.equal(hasBillingExemption(config, { uid: "other_user", role: "client" }), false);
});
