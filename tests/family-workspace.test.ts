import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateFamilyPiggyBank,
  canManageFamilyBilling,
  canManageFamilyCard,
  canCreateFamilyTransaction,
  canEditFamilyTransaction,
  canManageFamilyMembers,
  canViewFamilyCard,
  canViewFamilyPiggyBank,
  canViewFamilyTransaction,
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  normalizeFamilyPermissions,
} from "@/lib/workspaces/family";
import { canPlanUseProfile } from "@/lib/plans/catalog";
import type { WorkspaceMember } from "@/types/workspace";

function member(permissions: WorkspaceMember["permissions"], memberUid = "child-1"): WorkspaceMember {
  return {
    id: "m1",
    workspaceId: "family-1",
    workspaceUid: "owner-1",
    memberUid,
    email: "child@example.com",
    displayName: "Child",
    role: "child_dependent",
    permissions,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("family manager receives full family permissions", () => {
  assert.deepEqual(
    normalizeFamilyPermissions(undefined, "family_manager"),
    DEFAULT_FAMILY_ROLE_PERMISSIONS.family_manager,
  );
});

test("dependent can see and edit only own transactions by default", () => {
  const dependent = member(DEFAULT_FAMILY_ROLE_PERMISSIONS.child_dependent);

  assert.equal(canViewFamilyTransaction(dependent, "child-1"), true);
  assert.equal(canViewFamilyTransaction(dependent, "parent-1"), false);
  assert.equal(canEditFamilyTransaction(dependent, "child-1"), true);
  assert.equal(canEditFamilyTransaction(dependent, "parent-1"), false);
  assert.equal(canCreateFamilyTransaction(dependent), true);
  assert.equal(canManageFamilyMembers(dependent), false);
});

test("granular transaction permissions keep legacy transaction guards compatible", () => {
  const dependent = member(
    normalizeFamilyPermissions(
      ["transactions.view_own", "transactions.create", "transactions.edit_own"],
      "child_dependent",
    ),
  );

  assert.equal(canViewFamilyTransaction(dependent, "child-1"), true);
  assert.equal(canViewFamilyTransaction(dependent, "parent-1"), false);
  assert.equal(canCreateFamilyTransaction(dependent), true);
  assert.equal(canEditFamilyTransaction(dependent, "child-1"), true);
  assert.equal(canEditFamilyTransaction(dependent, "parent-1"), false);
});

test("responsible member can edit all family transactions but cannot manage members by default", () => {
  const responsible = member(DEFAULT_FAMILY_ROLE_PERMISSIONS.spouse_responsible, "spouse-1");

  assert.equal(canViewFamilyTransaction(responsible, "child-1"), true);
  assert.equal(canEditFamilyTransaction(responsible, "child-1"), true);
  assert.equal(canManageFamilyMembers(responsible), false);
});

test("family card permissions separate own and shared cards", () => {
  const dependent = member(
    normalizeFamilyPermissions(["cards.view_own", "cards.manage_own"], "child_dependent"),
  );

  assert.equal(canViewFamilyCard(dependent, "child-1"), true);
  assert.equal(canViewFamilyCard(dependent, "parent-1"), false);
  assert.equal(canManageFamilyCard(dependent, "child-1"), true);
  assert.equal(canManageFamilyCard(dependent, "parent-1"), false);
});

test("family piggy bank permissions separate own and shared goals", () => {
  const dependent = member(
    normalizeFamilyPermissions(["piggy_banks.view_own", "piggy_banks.manage_own"], "child_dependent"),
  );

  assert.equal(canViewFamilyPiggyBank(dependent, "child-1"), true);
  assert.equal(canViewFamilyPiggyBank(dependent, "parent-1"), false);
  assert.equal(canCreateFamilyPiggyBank(dependent), true);
});

test("only explicit billing permission can manage family billing settings", () => {
  const responsible = member(DEFAULT_FAMILY_ROLE_PERMISSIONS.spouse_responsible, "spouse-1");
  const manager = member(DEFAULT_FAMILY_ROLE_PERMISSIONS.family_manager, "owner-1");

  assert.equal(canManageFamilyBilling(responsible), false);
  assert.equal(canManageFamilyBilling(manager), true);
});

test("commercial plans only allow their intended financial profile type", () => {
  assert.equal(canPlanUseProfile("free", "personal"), true);
  assert.equal(canPlanUseProfile("free", "family"), false);
  assert.equal(canPlanUseProfile("premium", "business"), false);
  assert.equal(canPlanUseProfile("family", "family"), true);
  assert.equal(canPlanUseProfile("family", "personal"), false);
  assert.equal(canPlanUseProfile("business", "business"), true);
  assert.equal(canPlanUseProfile("business", "family"), false);
});
