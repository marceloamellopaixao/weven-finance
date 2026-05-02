import test from "node:test";
import assert from "node:assert/strict";
import { getCreditCardDueDateFromSelectedCard } from "@/lib/credit-card/due-date";

test("uses the card due day in the purchase month when it has not passed", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 15 }, "2026-05-02"),
    "2026-05-15"
  );
});

test("moves the card due date to next month when the due day already passed", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 5 }, "2026-05-20"),
    "2026-06-05"
  );
});

test("clamps the card due day to shorter months", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 31 }, "2026-02-20"),
    "2026-02-28"
  );
});

test("returns null when the card has no valid due day", () => {
  assert.equal(getCreditCardDueDateFromSelectedCard({}, "2026-05-20"), null);
});
