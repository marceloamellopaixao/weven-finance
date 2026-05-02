import { Transaction } from "@/types/transaction";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RecurringRole = "template" | "occurrence";

export function getMonthKey(date: string | null | undefined) {
  if (typeof date !== "string" || date.length < 7) return null;
  const monthKey = date.slice(0, 7);
  return /^\d{4}-\d{2}$/.test(monthKey) ? monthKey : null;
}

export function addMonthsUTC(dateStr: string, monthsToAdd: number): string {
  if (!ISO_DATE_RE.test(dateStr)) return dateStr;
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetMonthDate = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));
  const lastDayOfTargetMonth = new Date(
    Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth() + 1, 0)
  );
  const maxDays = lastDayOfTargetMonth.getUTCDate();
  const finalDay = Math.min(day, maxDays);
  return new Date(
    Date.UTC(targetMonthDate.getUTCFullYear(), targetMonthDate.getUTCMonth(), finalDay)
  )
    .toISOString()
    .split("T")[0];
}

export function getCurrentMonthKey(today = new Date()) {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

export function buildRecurringOccurrenceSourceId(recurringId: string, monthKey: string) {
  return `${recurringId}__${monthKey}`;
}

export function getRecurringOccurrenceDateForMonth(templateDate: string, monthKey: string) {
  if (!ISO_DATE_RE.test(templateDate) || !/^\d{4}-\d{2}$/.test(monthKey)) return null;
  const [targetYear, targetMonth] = monthKey.split("-").map(Number);
  const [, , templateDay] = templateDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  const day = Math.min(templateDay, lastDay);
  return `${String(targetYear).padStart(4, "0")}-${String(targetMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function shouldSyncRecurringTemplate(
  template: Pick<Transaction, "date" | "dueDate" | "recurrenceEnded">,
  monthKey = getCurrentMonthKey()
) {
  if (template.recurrenceEnded) return false;
  const startMonth = getMonthKey(template.dueDate || template.date);
  if (!startMonth) return false;
  return startMonth <= monthKey;
}
