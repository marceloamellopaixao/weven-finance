"use client";

import { CATEGORY_PATH_SEPARATOR } from "@/hooks/useCategories";

const LEGACY_SUB_PREFIX = /^\s*[\*\-•⬢]\s*/;

export const toSafeCategory = (value: unknown) => (typeof value === "string" ? value : "");

export const isLegacySubcategory = (value: unknown) => {
  const safe = toSafeCategory(value);
  return LEGACY_SUB_PREFIX.test(safe) && !safe.includes(CATEGORY_PATH_SEPARATOR);
};

export const isLinkedSubcategory = (value: unknown) => toSafeCategory(value).includes(CATEGORY_PATH_SEPARATOR);
export const isSubcategory = (value: unknown) => isLinkedSubcategory(value) || isLegacySubcategory(value);
export const isOthersCategory = (value: unknown) => toSafeCategory(value) === "Outros";

export const getSubcategoryName = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(value)) {
    const parts = safe.split(CATEGORY_PATH_SEPARATOR);
    return parts.slice(1).join(CATEGORY_PATH_SEPARATOR);
  }
  return safe.replace(LEGACY_SUB_PREFIX, "");
};

export const getCategoryRoot = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(safe)) return safe.split(CATEGORY_PATH_SEPARATOR)[0];
  if (isLegacySubcategory(value)) return "";
  return safe;
};

export const formatCategoryLabel = (value: unknown) => {
  const safe = toSafeCategory(value);
  if (isLinkedSubcategory(value)) {
    return `${getCategoryRoot(value)} > ${getSubcategoryName(value)}`;
  }
  if (isLegacySubcategory(value)) {
    return `• ${getSubcategoryName(value)}`;
  }
  return safe;
};

export const orderCategoryNames = (names: unknown[]) => {
  const unique = Array.from(new Set(names.map((name) => toSafeCategory(name).trim()).filter(Boolean)));
  const roots = unique.filter((name) => !isSubcategory(name));
  const linkedSubs = unique.filter((name) => isLinkedSubcategory(name));
  const legacySubs = unique.filter((name) => isLegacySubcategory(name));

  const groupedRootSet = new Set(linkedSubs.map((sub) => getCategoryRoot(sub)));

  const simpleRoots = roots
    .filter((root) => !isOthersCategory(root) && !groupedRootSet.has(root))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const groupedRoots = roots
    .filter((root) => !isOthersCategory(root) && groupedRootSet.has(root))
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  const groupedTree = groupedRoots.flatMap((root) => {
    const children = linkedSubs
      .filter((sub) => getCategoryRoot(sub) === root)
      .sort((a, b) => getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR"));
    return [root, ...children];
  });

  const orphanLinked = linkedSubs
    .filter((sub) => !roots.includes(getCategoryRoot(sub)))
    .sort((a, b) => {
      const rootCompare = getCategoryRoot(a).localeCompare(getCategoryRoot(b), "pt-BR");
      if (rootCompare !== 0) return rootCompare;
      return getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR");
    });

  const orphanLegacy = legacySubs.sort((a, b) => getSubcategoryName(a).localeCompare(getSubcategoryName(b), "pt-BR"));
  const others = roots.filter((root) => isOthersCategory(root));

  return [...simpleRoots, ...groupedTree, ...orphanLinked, ...orphanLegacy, ...others];
};
