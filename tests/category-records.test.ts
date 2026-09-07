import assert from "node:assert/strict";
import test from "node:test";

import { getStoredCategoryName, isCategoryOrDescendant } from "../src/lib/categories/records";

test("reads category names from structured and legacy raw rows", () => {
  assert.equal(getStoredCategoryName({ name: "Mercado", raw: { name: "Antigo" } }), "Mercado");
  assert.equal(getStoredCategoryName({ name: null, raw: { name: "Categoria legada" } }), "Categoria legada");
});

test("matches a category root and all of its linked subcategories", () => {
  assert.equal(isCategoryOrDescendant("Casa", "Casa"), true);
  assert.equal(isCategoryOrDescendant("Casa::Energia", "Casa"), true);
  assert.equal(isCategoryOrDescendant("Casamento", "Casa"), false);
});
