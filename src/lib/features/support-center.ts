export type SupportCenterDecision = {
  enabled: boolean;
  reason: "available" | "emergency_disabled";
};

export function evaluateSupportCenterAvailability(emergencyDisabled = false): SupportCenterDecision {
  return emergencyDisabled
    ? { enabled: false, reason: "emergency_disabled" }
    : { enabled: true, reason: "available" };
}
