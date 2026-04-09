import assert from "node:assert/strict";
import test from "node:test";

import { getActiveOnboardingStep } from "@/lib/onboarding/flow";

test("getActiveOnboardingStep returns first incomplete step", () => {
  const step = getActiveOnboardingStep({
    dismissed: false,
    completed: false,
    steps: {
      firstTransaction: true,
      firstCard: false,
      firstGoal: false,
      profileMenu: false,
    },
  });

  assert.equal(step, "firstCard");
});

test("getActiveOnboardingStep returns null when onboarding is completed", () => {
  const step = getActiveOnboardingStep({
    dismissed: false,
    completed: true,
    steps: {
      firstTransaction: true,
      firstCard: true,
      firstGoal: true,
      profileMenu: true,
    },
  });

  assert.equal(step, null);
});
