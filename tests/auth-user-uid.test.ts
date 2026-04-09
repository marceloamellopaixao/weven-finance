import assert from "node:assert/strict";
import test from "node:test";

import { resolveUserUidFromMetadata } from "@/lib/auth/user-uid";

test("resolveUserUidFromMetadata uses linkedUid first", () => {
  const uid = resolveUserUidFromMetadata(
    { linkedUid: "linked-123", firebaseUid: "legacy-123" },
    "raw-123"
  );

  assert.equal(uid, "linked-123");
});

test("resolveUserUidFromMetadata falls back to legacy firebaseUid", () => {
  const uid = resolveUserUidFromMetadata(
    { firebaseUid: "legacy-123" },
    "raw-123"
  );

  assert.equal(uid, "legacy-123");
});

test("resolveUserUidFromMetadata falls back to raw uid", () => {
  const uid = resolveUserUidFromMetadata({}, "raw-123");
  assert.equal(uid, "raw-123");
});
