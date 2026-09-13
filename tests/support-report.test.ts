import assert from "node:assert/strict";
import test from "node:test";

import {
  canReadSupportAttachment,
  computeSupportEvidenceRetentionUntil,
  detectSupportEvidenceMime,
  parseSupportReportFields,
  sanitizeSupportTechnicalContext,
  validateSupportEvidenceIdentity,
  validateSupportEvidenceSize,
} from "@/lib/support/report";

const REQUEST_ID = "8b4df9d9-ea38-4f53-b9d3-a8c7e98092fd";

test("parses bug fields and removes query strings and forbidden context", () => {
  const report = parseSupportReportFields({
    type: "bug",
    title: "Saldo incorreto",
    description: "O saldo exibido não corresponde ao extrato.",
    includeTechnicalContext: true,
    clientRequestId: REQUEST_ID,
    technicalContext: {
      route: "/dashboard?token=secret#balance",
      browser: "Chrome 140.0",
      plan: "business",
      cookies: "session=secret",
      authorization: "Bearer secret",
      balance: "R$ 1.000,00",
    },
  });

  assert.equal(report.type, "bug");
  assert.equal(report.technicalContext?.route, "/dashboard");
  assert.equal(report.technicalContext?.browser, "Chrome 140.0");
  assert.equal(report.technicalContext?.plan, undefined);
  assert.equal("cookies" in (report.technicalContext || {}), false);
  assert.equal("authorization" in (report.technicalContext || {}), false);
  assert.equal("balance" in (report.technicalContext || {}), false);
});

test("rejects oversized fields and a bug without title", () => {
  assert.throws(() => parseSupportReportFields({
    type: "bug",
    description: "Descrição suficiente para validar.",
    clientRequestId: REQUEST_ID,
  }), /title_required/);
  assert.throws(() => parseSupportReportFields({
    type: "support",
    title: "x".repeat(121),
    description: "Descrição suficiente para validar.",
    clientRequestId: REQUEST_ID,
  }), /invalid_payload/);
});

test("detects the allowed image signatures", () => {
  assert.equal(detectSupportEvidenceMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "image/png");
  assert.equal(detectSupportEvidenceMime(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(detectSupportEvidenceMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), "image/webp");
  assert.equal(detectSupportEvidenceMime(new TextEncoder().encode("<svg></svg>")), null);
});

test("rejects MIME spoofing and dangerous double extensions", () => {
  assert.throws(() => validateSupportEvidenceIdentity({
    fileName: "capture.png",
    declaredMime: "image/png",
    detectedMime: "image/jpeg",
  }), /file_type_mismatch/);
  assert.throws(() => validateSupportEvidenceIdentity({
    fileName: "payload.svg.png",
    declaredMime: "image/png",
    detectedMime: "image/png",
  }), /invalid_file_name/);
  assert.throws(() => validateSupportEvidenceIdentity({
    fileName: "../../payload.png",
    declaredMime: "image/png",
    detectedMime: "image/png",
  }), /invalid_file_name/);
  assert.throws(() => validateSupportEvidenceIdentity({
    fileName: "payload.png",
    declaredMime: "image/png",
    detectedMime: null,
  }), /unsupported_file_type/);
});

test("rejects empty and oversized evidence before decoding", () => {
  assert.throws(() => validateSupportEvidenceSize(0), /empty_file/);
  assert.throws(() => validateSupportEvidenceSize(5 * 1024 * 1024 + 1), /file_too_large/);
  assert.doesNotThrow(() => validateSupportEvidenceSize(5 * 1024 * 1024));
});

test("attachment authorization prevents cross-user reads", () => {
  assert.equal(canReadSupportAttachment({ authUid: "user-a", ticketUid: "user-a", ownerUid: "user-a", canReadStaff: false }), true);
  assert.equal(canReadSupportAttachment({ authUid: "user-a", ticketUid: "user-b", ownerUid: "user-b", canReadStaff: false }), false);
  assert.equal(canReadSupportAttachment({ authUid: "user-a", ticketUid: "user-a", ownerUid: "user-b", canReadStaff: false }), false);
  assert.equal(canReadSupportAttachment({ authUid: "staff", ticketUid: "user-b", ownerUid: "user-b", canReadStaff: true }), true);
  assert.equal(canReadSupportAttachment({ authUid: "", ticketUid: "user-b", ownerUid: "user-b", canReadStaff: false }), false);
});

test("technical context can be omitted completely", () => {
  assert.equal(sanitizeSupportTechnicalContext({ cookies: "secret", localStorage: "secret" }), undefined);
  const report = parseSupportReportFields({
    type: "support",
    title: "Preciso de ajuda",
    description: "Não encontrei a configuração necessária.",
    includeTechnicalContext: false,
    clientRequestId: REQUEST_ID,
    technicalContext: { route: "/settings" },
  });
  assert.equal(report.technicalContext, undefined);
});

test("support evidence retention starts 180 days after closure", () => {
  assert.equal(
    computeSupportEvidenceRetentionUntil(new Date("2026-01-01T00:00:00.000Z")),
    "2026-06-30T00:00:00.000Z",
  );
});
