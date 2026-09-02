import type { UserPlan } from "@/types/user";
import { toFinancialProfileType, type WorkspaceType } from "@/types/workspace";

export type WorkspacePlanRow = Record<string, unknown> & {
  id?: string;
  source_id?: string;
  name?: string;
  workspace_type?: string;
  is_default?: boolean;
  settings?: Record<string, unknown> | null;
  raw?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
};

const DEFAULT_WORKSPACE_NAMES: Record<"personal" | "family" | "business", string> = {
  personal: "Minha vida financeira",
  family: "Família / Casa",
  business: "Meu negócio",
};

const KNOWN_DEFAULT_NAMES = new Set([
  "Minha vida financeira",
  "Meu dinheiro",
  "Família / Casa",
  "Casa",
  "Família",
  "Meu negócio",
  "MEI",
  "Minha empresa",
  "Projeto profissional",
]);

function normalizeRowType(value: unknown): WorkspaceType {
  if (value === "family" || value === "business" || value === "professional" || value === "church") return value;
  return "personal";
}

function isActiveRow(row: WorkspacePlanRow) {
  const settings = (row.settings || {}) as Record<string, unknown>;
  return !(typeof settings.archivedAt === "string" && settings.archivedAt);
}

export function getOwnedWorkspaceTypeForPlan(plan: UserPlan): "personal" | "family" | "business" {
  if (plan === "family") return "family";
  if (plan === "business") return "business";
  return "personal";
}

export function reconcileWorkspaceRowsForPlan(
  rows: WorkspacePlanRow[],
  plan: UserPlan,
  now = new Date().toISOString(),
) {
  if (rows.length === 0) {
    return { rows, changed: false, canonicalWorkspaceId: null, closedSharedWorkspaceIds: [] as string[] };
  }

  const desiredType = getOwnedWorkspaceTypeForPlan(plan);
  const activeRows = rows.filter(isActiveRow);
  const desiredActiveRows = activeRows.filter(
    (row) => toFinancialProfileType(normalizeRowType(row.workspace_type)) === desiredType,
  );
  const archivedDesiredRows = rows.filter(
    (row) => !isActiveRow(row) && toFinancialProfileType(normalizeRowType(row.workspace_type)) === desiredType,
  );
  const byDefaultThenCreation = (left: WorkspacePlanRow, right: WorkspacePlanRow) => {
    if (Boolean(left.is_default) !== Boolean(right.is_default)) return left.is_default ? -1 : 1;
    return String(left.created_at || "").localeCompare(String(right.created_at || ""));
  };
  const activeDefaultRows = activeRows.filter((row) => row.is_default);
  const canonical = [
    ...activeDefaultRows.sort(byDefaultThenCreation),
    ...desiredActiveRows.filter((row) => !activeDefaultRows.includes(row)).sort(byDefaultThenCreation),
    ...activeRows.filter((row) => !activeDefaultRows.includes(row) && !desiredActiveRows.includes(row)).sort(byDefaultThenCreation),
    ...archivedDesiredRows.sort(byDefaultThenCreation),
    ...rows.filter((row) => !activeRows.includes(row) && !archivedDesiredRows.includes(row)).sort(byDefaultThenCreation),
  ][0];
  const canonicalId = String(canonical.source_id || canonical.id || "");
  const closedSharedWorkspaceIds: string[] = [];
  let changed = false;

  const nextRows = rows.map((row) => {
    const rowId = String(row.source_id || row.id || "");
    const rowType = normalizeRowType(row.workspace_type);
    const settings = { ...((row.settings || {}) as Record<string, unknown>) };
    const raw = { ...((row.raw || {}) as Record<string, unknown>) };
    const rawSettings = { ...(((raw.settings as Record<string, unknown> | null) || {}) as Record<string, unknown>) };

    if (rowId === canonicalId) {
      const wasFamily = toFinancialProfileType(rowType) === "family";
      if (wasFamily && desiredType !== "family") closedSharedWorkspaceIds.push(rowId);
      delete settings.archivedAt;
      delete rawSettings.archivedAt;
      if (desiredType !== "business") {
        delete settings.businessDocument;
        delete rawSettings.businessDocument;
      }
      settings.familyModeEnabled = desiredType === "family";
      rawSettings.familyModeEnabled = desiredType === "family";
      const currentName = String(row.name || raw.name || "");
      const nextName = !currentName || (rowType !== desiredType && KNOWN_DEFAULT_NAMES.has(currentName))
        ? DEFAULT_WORKSPACE_NAMES[desiredType]
        : currentName;
      const rowChanged = rowType !== desiredType
        || !row.is_default
        || !isActiveRow(row)
        || nextName !== currentName
        || Boolean((row.settings as Record<string, unknown> | null)?.familyModeEnabled) !== (desiredType === "family");
      if (!rowChanged) return row;
      changed = true;
      return {
        ...row,
        name: nextName,
        workspace_type: desiredType,
        is_default: true,
        settings,
        raw: {
          ...raw,
          name: nextName,
          type: desiredType,
          isDefault: true,
          status: "active",
          settings: rawSettings,
          updatedAt: now,
        },
        updated_at: now,
      };
    }

    if (!isActiveRow(row) && !row.is_default) return row;
    if (toFinancialProfileType(rowType) === "family" && desiredType !== "family") {
      closedSharedWorkspaceIds.push(rowId);
    }
    changed = true;
    settings.archivedAt = typeof settings.archivedAt === "string" && settings.archivedAt ? settings.archivedAt : now;
    rawSettings.archivedAt = typeof rawSettings.archivedAt === "string" && rawSettings.archivedAt ? rawSettings.archivedAt : now;
    return {
      ...row,
      is_default: false,
      settings,
      raw: { ...raw, isDefault: false, status: "archived", settings: rawSettings, updatedAt: now },
      updated_at: now,
    };
  });

  return { rows: nextRows, changed, canonicalWorkspaceId: canonicalId || null, closedSharedWorkspaceIds };
}
