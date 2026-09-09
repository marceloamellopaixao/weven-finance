import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSupportCenterRollout, stableRolloutBucket } from "@/lib/features/support-center";

const base = {
  SUPPORT_CENTER_ENABLED: "true",
  SUPPORT_CENTER_ENVIRONMENTS: "preview,production",
  SUPPORT_CENTER_ROLLOUT_SALT: "test-salt",
};

test("support rollout is disabled by default", () => {
  assert.equal(evaluateSupportCenterRollout({ uid: "a", role: "client", environment: "preview" }, {}).enabled, false);
});

test("server rollout rejects environments and roles outside the gate", () => {
  assert.equal(evaluateSupportCenterRollout({ uid: "a", role: "client", environment: "development" }, base).reason, "environment");
  assert.equal(evaluateSupportCenterRollout({ uid: "a", role: "client", environment: "preview" }, { ...base, SUPPORT_CENTER_ALLOWED_ROLES: "admin,support", SUPPORT_CENTER_ROLLOUT_PERCENT: "100" }).reason, "role");
});

test("internal allowlist precedes percentage while still requiring environment", () => {
  const decision = evaluateSupportCenterRollout({ uid: "Internal-A", role: "client", environment: "preview" }, {
    ...base,
    SUPPORT_CENTER_INTERNAL_UIDS: "internal-a",
    SUPPORT_CENTER_ROLLOUT_PERCENT: "0",
  });
  assert.deepEqual({ enabled: decision.enabled, reason: decision.reason }, { enabled: true, reason: "allowlist" });
});

test("percentage assignment is deterministic and bounded", () => {
  const first = stableRolloutBucket("user-123", "salt");
  assert.equal(stableRolloutBucket("user-123", "salt"), first);
  assert.ok(first >= 0 && first <= 99);
  assert.equal(evaluateSupportCenterRollout({ uid: "user-123", role: "client", environment: "preview" }, { ...base, SUPPORT_CENTER_ROLLOUT_PERCENT: "100" }).enabled, true);
  assert.equal(evaluateSupportCenterRollout({ uid: "user-123", role: "client", environment: "preview" }, { ...base, SUPPORT_CENTER_ROLLOUT_PERCENT: "0" }).enabled, false);
});
