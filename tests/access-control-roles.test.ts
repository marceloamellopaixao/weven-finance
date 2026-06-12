import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CREATOR_SUPREME_UID,
  canAccessAdminArea,
  isCreatorSupremeUid,
} from "../src/lib/access-control/roles";
import { hasAccess } from "../src/lib/access-control/config";
import { DEFAULT_ACCESS_CONTROL_CONFIG } from "../src/types/system";

test("creator supreme uid has privileged page and admin access regardless of role", () => {
  const identity = { uid: CREATOR_SUPREME_UID, role: "client" };

  assert.equal(isCreatorSupremeUid(identity.uid), true);
  assert.equal(canAccessAdminArea(identity), true);
});

test("admin pages preview is controlled by access-control rules", () => {
  assert.equal(
    hasAccess(DEFAULT_ACCESS_CONTROL_CONFIG, { uid: "regular-admin", plan: "free", role: "admin" }, "admin.pages.preview", "read"),
    true,
  );
  assert.equal(
    hasAccess(DEFAULT_ACCESS_CONTROL_CONFIG, { uid: "support-user", plan: "free", role: "support" }, "admin.pages.preview", "read"),
    false,
  );
  assert.equal(
    hasAccess(DEFAULT_ACCESS_CONTROL_CONFIG, { uid: "client-user", plan: "free", role: "client" }, "admin.pages.preview", "read"),
    false,
  );
});

test("admin area remains available to configured staff roles", () => {
  assert.equal(canAccessAdminArea({ uid: "admin-user", role: "admin" }), true);
  assert.equal(canAccessAdminArea({ uid: "moderator-user", role: "moderator" }), true);
  assert.equal(canAccessAdminArea({ uid: "support-user", role: "support" }), true);
  assert.equal(canAccessAdminArea({ uid: "client-user", role: "client" }), false);
});
