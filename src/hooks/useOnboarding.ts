"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  OnboardingStatus,
  subscribeToOnboarding,
  updateOnboardingStatus,
} from "@/services/onboardingService";

const DEFAULT_STATUS: OnboardingStatus = {
  dismissed: false,
  completed: false,
  progress: 0,
  total: 4,
  steps: {
    firstTransaction: false,
    firstCard: false,
    firstGoal: false,
    profileMenu: false,
  },
};

export function useOnboarding() {
  const { userProfile } = useAuth();
  const [status, setStatus] = useState<OnboardingStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus(DEFAULT_STATUS);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToOnboarding(
      userProfile.uid,
      (next) => {
        setStatus(next);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, [userProfile?.uid]);

  const dismiss = async () => {
    await updateOnboardingStatus({ dismissed: true });
    setStatus((prev) => ({ ...prev, dismissed: true }));
  };

  const completeStep = async (step: keyof OnboardingStatus["steps"]) => {
    await updateOnboardingStatus({ steps: { [step]: true } });
    setStatus((prev) => {
      const steps = { ...prev.steps, [step]: true };
      const progress = Object.values(steps).filter(Boolean).length;
      return { ...prev, steps, progress, completed: progress === prev.total };
    });
  };

  return { status, loading, dismiss, completeStep };
}
