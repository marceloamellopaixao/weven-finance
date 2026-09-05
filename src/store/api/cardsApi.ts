import type { CreditCardState } from "@/types/creditCard";
import type { PaymentCard } from "@/types/paymentCard";
import { baseApi, type WorkspaceScope } from "./baseApi";

export const cardsApi = baseApi.injectEndpoints({
  overrideExisting: process.env.NODE_ENV === "development",
  endpoints: (build) => ({
    getPaymentCards: build.query<PaymentCard[], WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "payment-cards", params: { workspaceId } }),
      transformResponse: (response: { cards?: PaymentCard[]; paymentCards?: PaymentCard[] }) => response.cards ?? response.paymentCards ?? [],
      providesTags: (_result, _error, arg) => [{ type: "PaymentCards", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
    getCreditCardSummary: build.query<CreditCardState, WorkspaceScope>({
      query: ({ workspaceId }) => ({ url: "credit-card", params: { workspaceId } }),
      transformResponse: (response: CreditCardState & { settings: CreditCardState["settings"]; summary: CreditCardState["summary"] }) => ({ settings: response.settings, summary: response.summary }),
      providesTags: (_result, _error, arg) => [{ type: "CreditCard", id: `${arg.userId}:${arg.workspaceId}` }],
    }),
  }),
});

export const { useGetPaymentCardsQuery, useGetCreditCardSummaryQuery } = cardsApi;
