import "server-only";

import {
  DEFAULT_CATEGORY_PRESETS_CONFIG,
  normalizeCategoryPresetsConfig,
  type CategoryPresetsConfig,
} from "@/lib/categories/defaultCategories";
import { supabaseSelect } from "@/services/supabase/admin";

const CATEGORY_PRESETS_CACHE_TTL_MS = 60_000;
let categoryPresetsCache: { at: number; value: CategoryPresetsConfig } | null = null;

export async function getCategoryPresetsConfig() {
  if (categoryPresetsCache && Date.now() - categoryPresetsCache.at < CATEGORY_PRESETS_CACHE_TTL_MS) {
    return categoryPresetsCache.value;
  }
  const rows = await supabaseSelect("system_configs", {
    select: "data",
    filters: { key: "category_presets" },
    limit: 1,
  });
  const value = normalizeCategoryPresetsConfig(rows[0]?.data, DEFAULT_CATEGORY_PRESETS_CONFIG);
  categoryPresetsCache = { at: Date.now(), value };
  return value;
}

export function cacheCategoryPresetsConfig(value: CategoryPresetsConfig) {
  categoryPresetsCache = { at: Date.now(), value: normalizeCategoryPresetsConfig(value) };
}
