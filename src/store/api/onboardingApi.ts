import type { OnboardingStatus } from "@/services/onboardingService";
import { baseApi, type UserScope } from "./baseApi";

export const onboardingApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getOnboarding: build.query<OnboardingStatus, UserScope>({
      query: () => "onboarding",
      transformResponse: (response: { onboarding: OnboardingStatus }) => response.onboarding,
      providesTags: (_result, _error, arg) => [{ type: "Onboarding", id: arg.userId }],
    }),
    updateOnboarding: build.mutation<void, UserScope & { dismissed?: boolean; tourCompleted?: boolean; steps?: Partial<OnboardingStatus["steps"]> }>({
      query: ({ userId, ...body }) => { void userId; return { url: "onboarding", method: "PUT", body }; },
      invalidatesTags: (_result, _error, arg) => [{ type: "Onboarding", id: arg.userId }],
    }),
  }),
});

export const { useGetOnboardingQuery, useUpdateOnboardingMutation } = onboardingApi;
