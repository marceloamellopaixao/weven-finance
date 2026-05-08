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

test("uses closing day to assign purchases before closing to the next invoice", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 10, closingDay: 30 }, "2025-12-29"),
    "2026-01-10"
  );
});

test("uses closing day to assign purchases after closing to the following invoice", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 10, closingDay: 30 }, "2026-01-01"),
    "2026-02-10"
  );
});

test("keeps the invoice in the purchase month when due day is after closing day", () => {
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 10, closingDay: 5 }, "2026-05-04"),
    "2026-05-10"
  );
  assert.equal(
    getCreditCardDueDateFromSelectedCard({ dueDate: 10, closingDay: 5 }, "2026-05-06"),
    "2026-06-10"
  );
});
