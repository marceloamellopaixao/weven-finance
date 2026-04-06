import type { OnboardingStatus } from "@/services/onboardingService";

export type OnboardingStepKey = keyof OnboardingStatus["steps"];

export const ONBOARDING_STEP_ORDER: OnboardingStepKey[] = [
  "firstTransaction",
  "firstCard",
  "firstGoal",
  "profileMenu",
];

export function getActiveOnboardingStep(
  status: Pick<OnboardingStatus, "dismissed" | "completed" | "steps">
): OnboardingStepKey | null {
  if (status.dismissed || status.completed) return null;

  for (const step of ONBOARDING_STEP_ORDER) {
    if (!status.steps[step]) return step;
  }

  return null;
}

export function getOnboardingStepHref(step: Exclude<OnboardingStepKey, "profileMenu">) {
  switch (step) {
    case "firstTransaction":
      return "/transactions/new";
    case "firstCard":
      return "/cards";
    case "firstGoal":
      return "/piggy-bank";
  }
}
