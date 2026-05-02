import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecurringOccurrenceSourceId,
  getRecurringOccurrenceDateForMonth,
  shouldSyncRecurringTemplate,
} from "@/lib/transactions/recurring";

test("buildRecurringOccurrenceSourceId creates a stable composite key", () => {
  assert.equal(buildRecurringOccurrenceSourceId("rec-123", "2026-05"), "rec-123__2026-05");
});

test("getRecurringOccurrenceDateForMonth preserves day when possible", () => {
  assert.equal(getRecurringOccurrenceDateForMonth("2026-01-15", "2026-05"), "2026-05-15");
});

test("getRecurringOccurrenceDateForMonth clamps to the last day of the month", () => {
  assert.equal(getRecurringOccurrenceDateForMonth("2026-01-31", "2026-02"), "2026-02-28");
});

test("shouldSyncRecurringTemplate only syncs active templates that already started", () => {
  assert.equal(shouldSyncRecurringTemplate({ date: "2026-05-01", dueDate: "2026-05-10" }, "2026-05"), true);
  assert.equal(shouldSyncRecurringTemplate({ date: "2026-06-01", dueDate: "2026-06-10" }, "2026-05"), false);
  assert.equal(
    shouldSyncRecurringTemplate({ date: "2026-05-01", dueDate: "2026-05-10", recurrenceEnded: true }, "2026-05"),
    false
  );
});
