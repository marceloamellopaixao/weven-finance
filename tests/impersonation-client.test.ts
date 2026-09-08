import test from "node:test";
import assert from "node:assert/strict";

import { isTerminalImpersonationError } from "@/lib/impersonation/client";

test("recognizes impersonation errors that require leaving the stale session", () => {
  assert.equal(isTerminalImpersonationError("impersonation_expired"), true);
  assert.equal(isTerminalImpersonationError("impersonation_not_allowed"), true);
  assert.equal(isTerminalImpersonationError("impersonation_forbidden_role"), true);
});

test("keeps impersonation active for action-level approval errors", () => {
  assert.equal(isTerminalImpersonationError("impersonation_write_confirmation_required"), false);
  assert.equal(isTerminalImpersonationError("impersonation_action_rejected"), false);
  assert.equal(isTerminalImpersonationError(undefined), false);
});
