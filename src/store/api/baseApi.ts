import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from "@reduxjs/toolkit/query";

import {
  clearImpersonationTargetUid,
  getImpersonationHeader,
  isTerminalImpersonationError,
} from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";

export type UserScope = { userId: string };
export type WorkspaceScope = UserScope & { workspaceId: string; ownerId?: string };
export const AUTH_UNAUTHORIZED_EVENT = "wevenfinance:auth:unauthorized";

let lastUnauthorizedEventAt = 0;

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: async (headers) => {
    const token = await getAccessTokenOrThrow();
    headers.set("authorization", `Bearer ${token}`);
    for (const [name, value] of Object.entries(getImpersonationHeader())) headers.set(name, value);
    return headers;
  },
});

const authenticatedBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions,
) => {
  let result = await rawBaseQuery(args, api, extraOptions);
  const errorPayload = result.error?.data as { error?: unknown } | undefined;
  if (isTerminalImpersonationError(errorPayload?.error)) {
    clearImpersonationTargetUid();
    result = await rawBaseQuery(args, api, extraOptions);
  }
  if (result.error?.status === 401 && typeof window !== "undefined") {
    const now = Date.now();
    if (now - lastUnauthorizedEventAt > 5_000) {
      lastUnauthorizedEventAt = now;
      window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
    }
  }
  return result;
};

export const baseApi = createApi({
  reducerPath: "wevenApi",
  baseQuery: authenticatedBaseQuery,
  keepUnusedDataFor: 120,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  tagTypes: [
    "Profile", "FinanceSettings", "Plans", "AccessControl", "Workspaces",
    "Categories", "CategoryPresets", "Transactions", "PaymentCards", "CreditCard", "PiggyBanks", "Onboarding",
  ],
  endpoints: () => ({}),
});
