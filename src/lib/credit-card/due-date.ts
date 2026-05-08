import { PaymentCard } from "@/types/paymentCard";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toIsoDateUTC(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

function clampDayToMonth(year: number, monthIndex: number, day: number) {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return Math.min(Math.max(1, day), lastDay);
}

export function isCreditCapableCard(card?: Pick<PaymentCard, "type"> | null) {
  return card?.type === "credit_card" || card?.type === "credit_and_debit";
}

export function getCreditCardDueDateFromSelectedCard(
  card: Pick<PaymentCard, "dueDate" | "closingDay"> | null | undefined,
  purchaseDate: string
) {
  const dueDay = Number(card?.dueDate);
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !ISO_DATE_RE.test(purchaseDate)) {
    return null;
  }

  const [year, month, purchaseDay] = purchaseDate.split("-").map(Number);
  const monthIndex = month - 1;
  const closingDay = Number(card?.closingDay);

  if (Number.isInteger(closingDay) && closingDay >= 1 && closingDay <= 31) {
    const currentMonthClosingDay = clampDayToMonth(year, monthIndex, closingDay);
    const dueAfterClosingInSameMonth = dueDay > closingDay;
    const invoiceMonthOffset = purchaseDay <= currentMonthClosingDay
      ? dueAfterClosingInSameMonth ? 0 : 1
      : dueAfterClosingInSameMonth ? 1 : 2;
    const invoiceMonth = new Date(Date.UTC(year, monthIndex + invoiceMonthOffset, 1));
    const invoiceYear = invoiceMonth.getUTCFullYear();
    const invoiceMonthIndex = invoiceMonth.getUTCMonth();
    return toIsoDateUTC(
      invoiceYear,
      invoiceMonthIndex,
      clampDayToMonth(invoiceYear, invoiceMonthIndex, dueDay)
    );
  }

  const currentMonthDueDay = clampDayToMonth(year, monthIndex, dueDay);

  if (purchaseDay <= currentMonthDueDay) {
    return toIsoDateUTC(year, monthIndex, currentMonthDueDay);
  }

  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextYear = nextMonth.getUTCFullYear();
  const nextMonthIndex = nextMonth.getUTCMonth();
  return toIsoDateUTC(nextYear, nextMonthIndex, clampDayToMonth(nextYear, nextMonthIndex, dueDay));
}
