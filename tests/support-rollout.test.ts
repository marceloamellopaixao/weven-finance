import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSupportCenterAvailability } from "@/lib/features/support-center";

test("support center is available to authenticated users by default", () => {
  assert.deepEqual(evaluateSupportCenterAvailability(), { enabled: true, reason: "available" });
});

test("emergency switch disables support center entry", () => {
  assert.deepEqual(evaluateSupportCenterAvailability(true), { enabled: false, reason: "emergency_disabled" });
});
