import { InstallmentValueMode } from "@/types/transaction";

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Number((value / 100).toFixed(2));

export type InstallmentPlan = {
  count: number;
  installmentAmounts: number[];
  totalAmount: number;
};

export function buildInstallmentPlan(
  amount: number,
  count: number,
  mode: InstallmentValueMode = "split_total"
): InstallmentPlan {
  const safeCount = Math.max(1, Math.floor(Number(count || 1)));
  const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  if (safeCount <= 1) {
    return {
      count: 1,
      installmentAmounts: [Number(safeAmount.toFixed(2))],
      totalAmount: Number(safeAmount.toFixed(2)),
    };
  }

  if (mode === "repeat_value") {
    const installmentAmount = Number(safeAmount.toFixed(2));
    return {
      count: safeCount,
      installmentAmounts: Array.from({ length: safeCount }, () => installmentAmount),
      totalAmount: Number((installmentAmount * safeCount).toFixed(2)),
    };
  }

  const totalCents = toCents(safeAmount);
  const baseInstallmentCents = Math.floor(totalCents / safeCount);
  const remainderCents = totalCents - (baseInstallmentCents * safeCount);

  const installmentAmounts = Array.from({ length: safeCount }, (_, index) =>
    fromCents(baseInstallmentCents + (index < remainderCents ? 1 : 0))
  );

  return {
    count: safeCount,
    installmentAmounts,
    totalAmount: fromCents(totalCents),
  };
}
