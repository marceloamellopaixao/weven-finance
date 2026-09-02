"use client";

import { useAuth } from "@/hooks/useAuth";
import { useGetOnboardingQuery, useUpdateOnboardingMutation } from "@/store/api/onboardingApi";
import type { OnboardingStatus } from "@/services/onboardingService";

const DEFAULT_STATUS: OnboardingStatus = {
  dismissed: false, completed: false, progress: 0, total: 1, tourCompleted: false,
  steps: { firstTransaction: true, firstCard: true, firstGoal: true, profileMenu: true },
};

export function useOnboarding() {
  const { userProfile } = useAuth();
  const userId = userProfile?.uid;
  const { data: status = DEFAULT_STATUS, isLoading: loading } = useGetOnboardingQuery(
    { userId: userId || "" }, { skip: !userId },
  );
  const [updateOnboarding] = useUpdateOnboardingMutation();

  const update = async (body: { dismissed?: boolean; tourCompleted?: boolean; steps?: Partial<OnboardingStatus["steps"]> }) => {
    if (!userId) return;
    await updateOnboarding({ userId, ...body }).unwrap();
  };

  return {
    status, loading, activeStep: null, isActive: false,
    dismiss: () => update({ dismissed: true }),
    completeStep: (step: keyof OnboardingStatus["steps"]) => update({ steps: { [step]: true } }),
    completeTour: () => status.tourCompleted ? Promise.resolve() : update({ tourCompleted: true }),
    resetTour: () => update({ tourCompleted: false }),
  };
}
