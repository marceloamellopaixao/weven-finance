"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getActiveOnboardingStep } from "@/lib/onboarding/flow";
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
  tourCompleted: false,
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
  const activeStep = useMemo(() => getActiveOnboardingStep(status), [status]);
  const isActive = !loading && !status.dismissed && !status.completed && activeStep !== null;

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

  const completeTour = async () => {
    if (status.tourCompleted) return;
    setStatus((prev) => ({ ...prev, tourCompleted: true }));
    try {
      await updateOnboardingStatus({ tourCompleted: true });
    } catch (error) {
      setStatus((prev) => ({ ...prev, tourCompleted: false }));
      throw error;
    }
  };

  const resetTour = async () => {
    setStatus((prev) => ({ ...prev, tourCompleted: false }));
    try {
      await updateOnboardingStatus({ tourCompleted: false });
    } catch (error) {
      setStatus((prev) => ({ ...prev, tourCompleted: true }));
      throw error;
    }
  };

  return { status, loading, dismiss, completeStep, completeTour, resetTour, activeStep, isActive };
}
