import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_BUSINESS_ROLE_PERMISSIONS,
  canEditBusinessMembers,
  canInviteBusinessMembers,
  canViewBusinessMembers,
  normalizeBusinessPermissions,
  toggleBusinessPermissionSelection,
} from "@/lib/workspaces/business";
import { buildWorkspaceSeatSummary, countOccupiedWorkspaceSeats } from "@/lib/workspaces/seats";
import { DEFAULT_PLANS_CONFIG } from "@/types/system";
import type { BusinessWorkspaceMember } from "@/types/workspace";

function member(
  role: BusinessWorkspaceMember["role"],
  permissions: BusinessWorkspaceMember["permissions"],
): BusinessWorkspaceMember {
  return {
    id: `member-${role}`,
    workspaceId: "business-1",
    workspaceUid: "owner-1",
    memberUid: `uid-${role}`,
    email: `${role}@example.com`,
    displayName: role,
    role,
    permissions,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("business owner receives complete business permissions", () => {
  const permissions = normalizeBusinessPermissions(undefined, "business_owner");

  assert.equal(permissions.includes("settings.manage_billing"), true);
  assert.equal(permissions.includes("settings.manage_security"), true);
  assert.equal(permissions.includes("business.manage_permissions"), true);
  assert.equal(permissions.includes("dashboard.view_own"), false);
});

test("financial admin manages operations and team without billing by default", () => {
  const admin = member("financial_admin", DEFAULT_BUSINESS_ROLE_PERMISSIONS.financial_admin);

  assert.equal(canViewBusinessMembers(admin), true);
  assert.equal(canInviteBusinessMembers(admin), true);
  assert.equal(canEditBusinessMembers(admin), true);
  assert.equal(admin.permissions.includes("transactions.edit_all"), true);
  assert.equal(admin.permissions.includes("settings.manage_billing"), false);
  assert.equal(admin.permissions.includes("settings.manage_security"), false);
});

test("collaborator is restricted to own operational data", () => {
  const permissions = normalizeBusinessPermissions(undefined, "collaborator");

  assert.equal(permissions.includes("transactions.view_own"), true);
  assert.equal(permissions.includes("transactions.view_all"), false);
  assert.equal(permissions.includes("create_entries"), true);
  assert.equal(permissions.includes("business.view_members"), false);
});

test("accountant has consolidated read-only access", () => {
  const permissions = normalizeBusinessPermissions(undefined, "accountant_viewer");

  assert.equal(permissions.includes("transactions.view_all"), true);
  assert.equal(permissions.includes("reports.export"), true);
  assert.equal(permissions.includes("transactions.create"), false);
  assert.equal(permissions.includes("cards.manage_all"), false);
});

test("business all and own scopes remain mutually exclusive", () => {
  const ownOnly = toggleBusinessPermissionSelection(
    ["transactions.view_all", "transactions.create"],
    "transactions.view_own",
  );

  assert.deepEqual(ownOnly, ["transactions.create", "transactions.view_own"]);
});

test("business capacity includes owner and pending invitations", () => {
  const occupied = countOccupiedWorkspaceSeats("owner-1", [
    { member_uid: "owner-1", member_status: "active" },
    { member_uid: "employee-1", member_status: "active" },
    { member_uid: "employee-2", member_status: "pending" },
  ]);
  const seats = buildWorkspaceSeatSummary({
    plan: { ...DEFAULT_PLANS_CONFIG.business, includedSeats: 5, maxAdditionalSeats: 95 },
    occupied,
    additionalSeats: 2,
    fallbackIncluded: 5,
  });

  assert.equal(occupied, 3);
  assert.equal(seats.included, 5);
  assert.equal(seats.capacity, 7);
  assert.equal(seats.available, 4);
});
