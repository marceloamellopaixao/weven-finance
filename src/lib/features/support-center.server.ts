import "server-only";

import { evaluateSupportCenterAvailability, type SupportCenterDecision } from "@/lib/features/support-center";

export function isSupportCenterEmergencyDisabled() {
  return process.env.SUPPORT_CENTER_KILL_SWITCH === "true";
}

export async function getSupportCenterDecision(): Promise<SupportCenterDecision> {
  return evaluateSupportCenterAvailability(isSupportCenterEmergencyDisabled());
}
