import assert from "node:assert/strict";
import test from "node:test";

import { getOwnedWorkspaceTypeForPlan, reconcileWorkspaceRowsForPlan } from "../src/lib/workspaces/plan-policy";

test("personal commercial plans share one personal workspace type", () => {
  assert.equal(getOwnedWorkspaceTypeForPlan("free"), "personal");
  assert.equal(getOwnedWorkspaceTypeForPlan("founder"), "personal");
  assert.equal(getOwnedWorkspaceTypeForPlan("premium"), "personal");
  assert.equal(getOwnedWorkspaceTypeForPlan("pro"), "personal");
  assert.equal(getOwnedWorkspaceTypeForPlan("family"), "family");
  assert.equal(getOwnedWorkspaceTypeForPlan("business"), "business");
});

test("family to pro converts the current profile and archives a duplicate personal profile", () => {
  const result = reconcileWorkspaceRowsForPlan([
    {
      id: "owner__family",
      source_id: "family",
      name: "Família / Casa",
      workspace_type: "family",
      is_default: true,
      settings: { familyModeEnabled: true },
      raw: { type: "family", settings: { familyModeEnabled: true } },
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "owner__personal-duplicate",
      source_id: "personal-duplicate",
      name: "Meu dinheiro",
      workspace_type: "personal",
      is_default: false,
      settings: {},
      raw: { type: "personal", settings: {} },
      created_at: "2026-02-01T00:00:00.000Z",
    },
  ], "pro", "2026-09-02T12:00:00.000Z");

  const current = result.rows.find((row) => row.source_id === "family");
  const duplicate = result.rows.find((row) => row.source_id === "personal-duplicate");
  assert.equal(current?.workspace_type, "personal");
  assert.equal(current?.name, "Minha vida financeira");
  assert.equal(current?.is_default, true);
  assert.equal((current?.settings as Record<string, unknown>).familyModeEnabled, false);
  assert.equal((duplicate?.settings as Record<string, unknown>).archivedAt, "2026-09-02T12:00:00.000Z");
  assert.deepEqual(result.closedSharedWorkspaceIds, ["family"]);
});

test("switching to family reuses the existing personal workspace", () => {
  const result = reconcileWorkspaceRowsForPlan([{
    id: "owner__personal",
    source_id: "personal",
    name: "Meu dinheiro",
    workspace_type: "personal",
    is_default: true,
    settings: {},
    raw: { type: "personal", settings: {} },
  }], "family", "2026-09-02T12:00:00.000Z");

  assert.equal(result.rows[0].workspace_type, "family");
  assert.equal(result.rows[0].name, "Família / Casa");
  assert.equal((result.rows[0].settings as Record<string, unknown>).familyModeEnabled, true);
});

test("business to pro converts the current profile and closes team access", () => {
  const result = reconcileWorkspaceRowsForPlan([{
    id: "owner__business",
    source_id: "business",
    name: "Meu negócio",
    workspace_type: "business",
    is_default: true,
    settings: { businessDocument: "12345678000199" },
    raw: { type: "business", settings: { businessDocument: "12345678000199" } },
  }], "pro", "2026-09-03T12:00:00.000Z");

  assert.equal(result.rows[0].workspace_type, "personal");
  assert.equal(result.rows[0].name, "Minha vida financeira");
  assert.equal((result.rows[0].settings as Record<string, unknown>).businessDocument, undefined);
  assert.deepEqual(result.closedSharedWorkspaceIds, ["business"]);
});

test("switching from family to business closes previous family memberships", () => {
  const result = reconcileWorkspaceRowsForPlan([{
    id: "owner__shared",
    source_id: "shared",
    name: "Família / Casa",
    workspace_type: "family",
    is_default: true,
    settings: { familyModeEnabled: true },
    raw: { type: "family", settings: { familyModeEnabled: true } },
  }], "business", "2026-09-03T12:00:00.000Z");

  assert.equal(result.rows[0].workspace_type, "business");
  assert.equal(result.rows[0].name, "Meu negócio");
  assert.deepEqual(result.closedSharedWorkspaceIds, ["shared"]);
});
