export function getStoredCategoryName(row: Record<string, unknown>) {
  const raw = (row.raw as Record<string, unknown> | null) ?? {};
  return String(row.name || raw.name || "").trim();
}

export function isCategoryOrDescendant(categoryName: string, rootName: string) {
  return categoryName === rootName || categoryName.startsWith(`${rootName}::`);
}
