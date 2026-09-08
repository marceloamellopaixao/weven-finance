import assert from "node:assert/strict";
import test from "node:test";

import {
  CATEGORY_PRESET_COLOR_OPTIONS,
  DEFAULT_CATEGORY_PRESETS_CONFIG,
  getCategoryPresetScope,
  getDefaultCategoriesForWorkspaceType,
  normalizeCategoryPresetsConfig,
} from "@/lib/categories/defaultCategories";

test("maps financial profiles and Business segments to isolated category scopes", () => {
  assert.equal(getCategoryPresetScope("personal"), "personal");
  assert.equal(getCategoryPresetScope("family"), "family");
  assert.equal(getCategoryPresetScope("professional"), "business");
  assert.equal(getCategoryPresetScope("church"), "business_church");
  assert.equal(getCategoryPresetScope("business", "nonprofit"), "business_nonprofit");
});

test("normalizes admin configuration and always preserves the fallback category", () => {
  const config = normalizeCategoryPresetsConfig({
    ...DEFAULT_CATEGORY_PRESETS_CONFIG,
    family: [
      { name: "Educação", type: "expense", color: CATEGORY_PRESET_COLOR_OPTIONS[2].value },
      { name: "educação", type: "income", color: "invalid-color" },
    ],
  });

  assert.deepEqual(config.family.map((category) => category.name), ["Educação", "Outros"]);
  assert.equal(config.family.at(-1)?.type, "both");
});

test("uses the configured category list for the selected workspace profile", () => {
  const config = normalizeCategoryPresetsConfig({
    ...DEFAULT_CATEGORY_PRESETS_CONFIG,
    business_church: [
      { name: "Campanha especial", type: "both", color: CATEGORY_PRESET_COLOR_OPTIONS[0].value },
    ],
  });
  const categories = getDefaultCategoriesForWorkspaceType("business", "church", config);

  assert.deepEqual(categories.map((category) => category.name), ["Campanha especial", "Outros"]);
});
