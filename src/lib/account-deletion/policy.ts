const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCOUNT_DELETION_GRACE_DAYS = 30;

function toDate(value: string | Date | null | undefined) {
  if (value instanceof Date) return value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function computePermanentDeleteAt(
  deletedAt: string | Date | null | undefined,
  graceDays = ACCOUNT_DELETION_GRACE_DAYS
) {
  const baseDate = toDate(deletedAt);
  if (!baseDate) return null;
  return new Date(baseDate.getTime() + graceDays * DAY_MS).toISOString();
}

export function resolvePermanentDeleteAt(
  deletedAt: string | Date | null | undefined,
  raw?: Record<string, unknown> | null
) {
  const rawValue = typeof raw?.permanentDeleteAt === "string" ? raw.permanentDeleteAt.trim() : "";
  const rawDate = toDate(rawValue);
  if (rawDate) return rawDate.toISOString();
  return computePermanentDeleteAt(deletedAt);
}

export function isDeletionWindowExpired(
  deletedAt: string | Date | null | undefined,
  raw?: Record<string, unknown> | null,
  now = new Date()
) {
  const permanentDeleteAt = resolvePermanentDeleteAt(deletedAt, raw);
  if (!permanentDeleteAt) return false;
  return new Date(permanentDeleteAt).getTime() <= now.getTime();
}

