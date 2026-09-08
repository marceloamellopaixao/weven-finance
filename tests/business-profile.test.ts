import assert from "node:assert/strict";
import test from "node:test";

import { formatCnpj, isValidCnpj, stripCnpj } from "@/lib/business/cnpj";
import { getDefaultCategoriesForWorkspaceType } from "@/lib/categories/defaultCategories";
import {
  normalizeBusinessOrganizationKind,
  normalizeBusinessTeamSize,
} from "@/lib/workspaces/business-profile";

test("normalizes Business profile classification safely", () => {
  assert.equal(normalizeBusinessOrganizationKind("church"), "church");
  assert.equal(normalizeBusinessOrganizationKind("invalid"), "company");
  assert.equal(normalizeBusinessTeamSize("21_100"), "21_100");
  assert.equal(normalizeBusinessTeamSize("invalid"), "solo");
});

test("Business category presets follow the organization kind", () => {
  const church = getDefaultCategoriesForWorkspaceType("business", "church").map((item) => item.name);
  const company = getDefaultCategoriesForWorkspaceType("business", "company").map((item) => item.name);

  assert.equal(church.includes("Dízimos"), true);
  assert.equal(church.includes("Ofertas"), true);
  assert.equal(company.includes("Receita de vendas"), true);
  assert.equal(company.includes("Dízimos"), false);
});

test("validates and formats Brazilian CNPJ", () => {
  const valid = "11.222.333/0001-81";
  assert.equal(stripCnpj(valid), "11222333000181");
  assert.equal(formatCnpj(valid), valid);
  assert.equal(isValidCnpj(valid), true);
  assert.equal(isValidCnpj("11.111.111/1111-11"), false);
});
