import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_DELETION_GRACE_DAYS,
  computePermanentDeleteAt,
  isDeletionWindowExpired,
} from "@/lib/account-deletion/policy";

test("computePermanentDeleteAt adds the configured grace window", () => {
  const deletedAt = "2026-04-01T12:00:00.000Z";
  const permanentDeleteAt = computePermanentDeleteAt(deletedAt);

  assert.ok(permanentDeleteAt);
  const diffMs = new Date(permanentDeleteAt!).getTime() - new Date(deletedAt).getTime();
  assert.equal(diffMs, ACCOUNT_DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);
});

test("isDeletionWindowExpired returns false before deadline and true after", () => {
  const deletedAt = "2026-04-01T12:00:00.000Z";
  const beforeDeadline = new Date("2026-04-15T12:00:00.000Z");
  const afterDeadline = new Date("2026-05-10T12:00:00.000Z");

  assert.equal(isDeletionWindowExpired(deletedAt, {}, beforeDeadline), false);
  assert.equal(isDeletionWindowExpired(deletedAt, {}, afterDeadline), true);
});
