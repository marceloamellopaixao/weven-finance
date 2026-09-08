import assert from "node:assert/strict";
import test from "node:test";

import {
  canReopenSupportTicket,
  getSupportAccess,
  normalizeSupportMessage,
  publicSupportEventMetadata,
} from "@/lib/support/activity";
import { canReadSupportAttachment } from "@/lib/support/report";

const ticket = { ticketUid: "owner-a", workspaceId: "workspace-a" };

test("authorization matrix isolates owners, ordinary users and staff permissions", () => {
  const ordinary = getSupportAccess({ authUid: "user-b", requesterUid: "user-b", isImpersonating: false, canReadStaff: false, canWriteStaff: false }, ticket);
  assert.deepEqual(ordinary, { isOwner: false, canRead: false, canReplyPublic: false, canWriteInternal: false, canMutateTicket: false });

  const owner = getSupportAccess({ authUid: "owner-a", requesterUid: "owner-a", isImpersonating: false, canReadStaff: false, canWriteStaff: false }, ticket);
  assert.equal(owner.canRead, true);
  assert.equal(owner.canReplyPublic, true);
  assert.equal(owner.canWriteInternal, false);

  const readOnlySupport = getSupportAccess({ authUid: "support", requesterUid: "support", isImpersonating: false, canReadStaff: true, canWriteStaff: false }, ticket);
  assert.equal(readOnlySupport.canRead, true);
  assert.equal(readOnlySupport.canReplyPublic, false);

  for (const uid of ["support-write", "moderator", "admin"]) {
    const staff = getSupportAccess({ authUid: uid, requesterUid: uid, isImpersonating: false, canReadStaff: true, canWriteStaff: true }, ticket);
    assert.equal(staff.canRead, true);
    assert.equal(staff.canReplyPublic, true);
    assert.equal(staff.canWriteInternal, true);
    assert.equal(staff.canMutateTicket, true);
  }
});

test("impersonated sessions can inspect the target ticket but cannot mutate support activity", () => {
  const access = getSupportAccess({ authUid: "owner-a", requesterUid: "support", isImpersonating: true, canReadStaff: false, canWriteStaff: false }, ticket);
  assert.equal(access.canRead, true);
  assert.equal(access.canReplyPublic, false);
  assert.equal(access.canWriteInternal, false);
  assert.equal(access.canMutateTicket, false);
});

test("signed evidence authorization rejects anonymous, IDOR and mismatched workspace ownership", () => {
  assert.equal(canReadSupportAttachment({ authUid: "", ticketUid: "owner-a", ownerUid: "owner-a", canReadStaff: false }), false);
  assert.equal(canReadSupportAttachment({ authUid: "owner-a", ticketUid: "owner-b", ownerUid: "owner-b", canReadStaff: false }), false);
  assert.equal(canReadSupportAttachment({ authUid: "owner-a", ticketUid: "owner-a", ownerUid: "owner-b", canReadStaff: false }), false);
  assert.equal(canReadSupportAttachment({ authUid: "owner-a", ticketUid: "owner-a", ownerUid: "owner-a", canReadStaff: false }), true);
  assert.equal(canReadSupportAttachment({ authUid: "admin", ticketUid: "owner-a", ownerUid: "owner-a", canReadStaff: true }), true);
});

test("reopening is limited to fourteen days after a final status", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  assert.equal(canReopenSupportTicket({ status: "resolved", resolvedAt: "2026-08-26T12:00:00.000Z", now }), true);
  assert.equal(canReopenSupportTicket({ status: "resolved", resolvedAt: "2026-08-24T11:59:59.000Z", now }), false);
  assert.equal(canReopenSupportTicket({ status: "in_progress", resolvedAt: "2026-09-08T11:00:00.000Z", now }), false);
});

test("public event payload strips internal and technical identities", () => {
  assert.deepEqual(publicSupportEventMetadata("status_changed", { from: "pending", to: "resolved", actorUid: "staff-secret", storagePath: "private/path" }), { from: "pending", to: "resolved" });
  assert.deepEqual(publicSupportEventMetadata("internal_note", { message: "secret", actorUid: "staff-secret" }), {});
});

test("support message validation rejects blank and oversized bodies", () => {
  assert.throws(() => normalizeSupportMessage("   "), /invalid_message/);
  assert.throws(() => normalizeSupportMessage("x".repeat(5001)), /invalid_message/);
  assert.equal(normalizeSupportMessage("  resposta  "), "resposta");
});
