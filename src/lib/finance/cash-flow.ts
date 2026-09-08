import type { Transaction } from "@/types/transaction";

type CashFlowTransaction = Pick<
  Transaction,
  "amount" | "type" | "status" | "dueDate" | "recurringRole"
>;

function isRealTransaction(transaction: CashFlowTransaction) {
  return transaction.recurringRole !== "template";
}

function signedAmount(transaction: CashFlowTransaction) {
  const amount = Number(transaction.amount || 0);
  return transaction.type === "income" ? amount : -amount;
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Cash that has actually entered or left the account. */
export function calculateCurrentCashBalance(transactions: CashFlowTransaction[]) {
  const balance = transactions
    .filter(isRealTransaction)
    .filter((transaction) => transaction.status === "paid")
    .reduce((balance, transaction) => balance + signedAmount(transaction), 0);

  return roundMoney(balance);
}

/** Current cash plus every still-pending movement due through the selected date. */
export function calculateProjectedCashBalance(
  transactions: CashFlowTransaction[],
  throughDate: string,
) {
  const currentBalance = calculateCurrentCashBalance(transactions);
  const pendingBalance = transactions
    .filter(isRealTransaction)
    .filter((transaction) => (
      transaction.status !== "paid" &&
      typeof transaction.dueDate === "string" &&
      transaction.dueDate <= throughDate
    ))
    .reduce((balance, transaction) => balance + signedAmount(transaction), 0);

  return roundMoney(currentBalance + pendingBalance);
}
