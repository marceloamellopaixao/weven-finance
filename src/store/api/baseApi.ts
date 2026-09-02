import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

import { getImpersonationHeader } from "@/lib/impersonation/client";
import { getAccessTokenOrThrow } from "@/services/auth/token";

export type UserScope = { userId: string };
export type WorkspaceScope = UserScope & { workspaceId: string };

const rawBaseQuery = fetchBaseQuery({
  baseUrl: "/api",
  prepareHeaders: async (headers) => {
    const token = await getAccessTokenOrThrow();
    headers.set("authorization", `Bearer ${token}`);
    for (const [name, value] of Object.entries(getImpersonationHeader())) headers.set(name, value);
    return headers;
  },
});

export const baseApi = createApi({
  reducerPath: "wevenApi",
  baseQuery: rawBaseQuery,
  keepUnusedDataFor: 120,
  refetchOnFocus: false,
  refetchOnReconnect: true,
  tagTypes: [
    "Profile", "FinanceSettings", "Plans", "AccessControl", "Workspaces",
    "Categories", "Transactions", "PaymentCards", "CreditCard", "PiggyBanks", "Onboarding",
  ],
  endpoints: () => ({}),
});
