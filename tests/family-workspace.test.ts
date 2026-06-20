import assert from "node:assert/strict";
import test from "node:test";

import {
  canCreateFamilyTransaction,
  canEditFamilyTransaction,
  canManageFamilyMembers,
  canViewFamilyTransaction,
  DEFAULT_FAMILY_ROLE_PERMISSIONS,
  normalizeFamilyPermissions,
} from "@/lib/workspaces/family";
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
