import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";

import {
  detectSupportEvidenceMime,
  validateSupportEvidenceSize,
  validateSupportEvidenceIdentity,
  type SupportEvidenceMimeType,
} from "@/lib/support/report";

const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 4_096;

export type ProcessedSupportEvidence = {
  bytes: Buffer;
  mimeType: SupportEvidenceMimeType;
  sizeBytes: number;
  sha256: string;
  width: number;
  height: number;
};

export async function processSupportEvidence(file: File): Promise<ProcessedSupportEvidence> {
  validateSupportEvidenceSize(file.size);

  const original = Buffer.from(await file.arrayBuffer());
  const detectedMime = detectSupportEvidenceMime(original);
  const mimeType = validateSupportEvidenceIdentity({
    fileName: file.name,
    declaredMime: file.type,
    detectedMime,
  });

  const pipeline = sharp(original, {
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: MAX_IMAGE_DIMENSION,
      height: MAX_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const bytes = mimeType === "image/png"
    ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
    : mimeType === "image/webp"
      ? await pipeline.webp({ quality: 88 }).toBuffer()
      : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  validateSupportEvidenceSize(bytes.byteLength);
  const metadata = await sharp(bytes, { failOn: "error" }).metadata();
  if (!metadata.width || !metadata.height) throw new Error("invalid_image_dimensions");

  return {
    bytes,
    mimeType,
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: metadata.width,
    height: metadata.height,
  };
}
