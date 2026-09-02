import type { PlanDetails } from "@/types/system";
import type { WorkspaceSeatSummary } from "@/types/workspace";

function toNonNegativeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function toPositivePrice(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

export function buildWorkspaceSeatSummary(input: {
  plan: PlanDetails;
  occupied: number;
  additionalSeats?: unknown;
  fallbackIncluded: number;
}): WorkspaceSeatSummary {
  const included = Math.max(1, toNonNegativeInteger(input.plan.includedSeats, input.fallbackIncluded));
  const maxAdditionalSeats = input.plan.maxAdditionalSeats === null || input.plan.maxAdditionalSeats === undefined
    ? null
    : toNonNegativeInteger(input.plan.maxAdditionalSeats);
  const purchased = toNonNegativeInteger(input.additionalSeats);
  const additional = maxAdditionalSeats === null ? purchased : Math.min(purchased, maxAdditionalSeats);
  const occupied = Math.max(1, toNonNegativeInteger(input.occupied, 1));
  const capacity = included + additional;
  const additionalSeatPrice = toPositivePrice(input.plan.additionalSeatPrice);
  const additionalSeatYearlyPrice = toPositivePrice(input.plan.additionalSeatYearlyPrice);

  return {
    included,
    additional,
    capacity,
    occupied,
    available: Math.max(0, capacity - occupied),
    additionalSeatPrice,
    additionalSeatYearlyPrice,
    maxAdditionalSeats,
    canPurchaseAdditional: additionalSeatPrice !== null && (maxAdditionalSeats === null || additional < maxAdditionalSeats),
  };
}

export function countOccupiedWorkspaceSeats(
  ownerUid: string,
  rows: Array<Record<string, unknown>>,
) {
  const memberUids = new Set(
    rows
      .filter((row) => row.member_status === "active" || row.member_status === "pending")
      .map((row) => String(row.member_uid || "").trim())
      .filter(Boolean),
  );
  memberUids.add(ownerUid);
  return memberUids.size;
}
