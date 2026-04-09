export function resolveUserUidFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
  rawUid: string
) {
  if (typeof metadata?.linkedUid === "string" && metadata.linkedUid.trim()) {
    return metadata.linkedUid.trim();
  }

  if (typeof metadata?.firebaseUid === "string" && metadata.firebaseUid.trim()) {
    return metadata.firebaseUid.trim();
  }

  return rawUid;
}
