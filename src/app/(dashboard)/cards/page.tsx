"use client";

import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useTransactions } from "@/hooks/useTransactions";
import { syncCreditCardAmountForLimit } from "@/services/transactionService";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createPaymentCard, deletePaymentCard, getPaymentCards, identifyPaymentCard, subscribeToPaymentCards, updatePaymentCard } from "@/services/paymentCardService";
import { CreditCard, ShieldAlert, RefreshCw, Save, AlertTriangle, Plus, Trash2, Pencil, ChevronLeft, ChevronRight, CheckCircle2, Settings2, ReceiptText, PiggyBank } from "lucide-react";
import { CreditCardSettings } from "@/types/creditCard";
import { PaymentCard, PaymentCardType } from "@/types/paymentCard";
import { PiContactlessPaymentFill } from "react-icons/pi";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

type BankCardTheme = {
  background: string;
  foreground: string;
  muted: string;
  badge: string;
  shadow: string;
};

const DEFAULT_CARD_THEME: BankCardTheme = {
  background: "bg-linear-to-br from-slate-700 via-slate-800 to-slate-950",
  foreground: "text-white",
  muted: "text-white/75",
  badge: "border-none bg-white/15 text-white backdrop-blur-md",
  shadow: "shadow-slate-950/30",
};

const BANK_CARD_THEMES: Array<{ keys: string[]; theme: BankCardTheme }> = [
  {
    keys: ["nubank", "nu pagamentos", "nu pay"],
    theme: {
      background: "bg-linear-to-br from-fuchsia-600 via-violet-700 to-zinc-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-violet-950/35",
    },
  },
  {
    keys: ["inter"],
    theme: {
      background: "bg-linear-to-br from-orange-400 via-orange-500 to-red-900",
      foreground: "text-white",
      muted: "text-white/80",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-orange-950/30",
    },
  },
  {
    keys: ["itau", "itaú"],
    theme: {
      background: "bg-linear-to-br from-orange-500 via-amber-500 to-blue-950",
      foreground: "text-white",
      muted: "text-white/80",
      badge: "border-none bg-black/15 text-white backdrop-blur-md",
      shadow: "shadow-blue-950/35",
    },
  },
  {
    keys: ["bradesco", "next"],
    theme: {
      background: "bg-linear-to-br from-rose-600 via-red-700 to-zinc-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-red-950/35",
    },
  },
  {
    keys: ["santander"],
    theme: {
      background: "bg-linear-to-br from-red-500 via-red-600 to-zinc-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-red-950/35",
    },
  },
  {
    keys: ["caixa"],
    theme: {
      background: "bg-linear-to-br from-blue-500 via-sky-500 to-orange-500",
      foreground: "text-white",
      muted: "text-white/80",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-blue-950/30",
    },
  },
  {
    keys: ["banco do brasil", "bb"],
    theme: {
      background: "bg-linear-to-br from-yellow-300 via-amber-400 to-blue-900",
      foreground: "text-slate-950",
      muted: "text-slate-900/75",
      badge: "border-none bg-slate-950/10 text-slate-950 backdrop-blur-md",
      shadow: "shadow-amber-950/20",
    },
  },
  {
    keys: ["picpay"],
    theme: {
      background: "bg-linear-to-br from-emerald-400 via-green-500 to-emerald-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-emerald-950/35",
    },
  },
  {
    keys: ["mercado pago", "mercadopago"],
    theme: {
      background: "bg-linear-to-br from-sky-300 via-cyan-400 to-blue-700",
      foreground: "text-slate-950",
      muted: "text-slate-900/70",
      badge: "border-none bg-slate-950/10 text-slate-950 backdrop-blur-md",
      shadow: "shadow-sky-950/25",
    },
  },
  {
    keys: ["c6"],
    theme: {
      background: "bg-linear-to-br from-zinc-800 via-zinc-900 to-black",
      foreground: "text-white",
      muted: "text-white/70",
      badge: "border-none bg-amber-200/15 text-amber-100 backdrop-blur-md",
      shadow: "shadow-black/40",
    },
  },
  {
    keys: ["neon"],
    theme: {
      background: "bg-linear-to-br from-cyan-400 via-sky-500 to-indigo-900",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-sky-950/30",
    },
  },
  {
    keys: ["original"],
    theme: {
      background: "bg-linear-to-br from-emerald-300 via-teal-500 to-zinc-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-emerald-950/30",
    },
  },
];

const BANK_OPTIONS = ["Nubank", "Inter", "Itau", "Bradesco", "Santander", "Caixa", "Banco do Brasil", "PicPay", "C6 Bank", "Neon", "Next", "Original", "Serasa", "Credicard", "Safra", "Mercado Pago"];

function normalizeLookup(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getBankCardTheme(bankName: string, brand?: string) {
  const normalizedBank = normalizeLookup(bankName);
  const fromBank = BANK_CARD_THEMES.find(({ keys }) => keys.some((key) => normalizedBank.includes(key)));
  if (fromBank) return fromBank.theme;

  const normalizedBrand = normalizeLookup(brand || "");
  if (normalizedBrand.includes("visa")) {
    return {
      background: "bg-linear-to-br from-sky-500 via-blue-600 to-slate-950",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-blue-950/30",
    };
  }
  if (normalizedBrand.includes("master")) {
    return {
      background: "bg-linear-to-br from-amber-400 via-orange-500 to-red-900",
      foreground: "text-white",
      muted: "text-white/80",
      badge: "border-none bg-black/15 text-white backdrop-blur-md",
      shadow: "shadow-orange-950/30",
    };
  }
  if (normalizedBrand.includes("elo")) {
    return {
      background: "bg-linear-to-br from-emerald-400 via-teal-500 to-blue-900",
      foreground: "text-white",
      muted: "text-white/75",
      badge: "border-none bg-white/15 text-white backdrop-blur-md",
      shadow: "shadow-teal-950/30",
    };
  }
  return DEFAULT_CARD_THEME;
}

const defaultSettings: CreditCardSettings = { enabled: false, cardName: "Cartão principal", limit: 0, alertThresholdPct: 80, blockOnLimitExceeded: false, autoUnblockWhenBelowLimit: true };

function CardsPageSkeleton() {
  return (
    <div className="min-h-screen p-3 pb-20 font-sans sm:p-4 md:p-8">
      <div className="mx-auto max-w-6xl animate-pulse space-y-6 md:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-44 rounded-2xl bg-primary/12" />
            <div className="h-4 w-72 max-w-full rounded-xl bg-muted" />
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <div className="h-10 rounded-xl bg-muted sm:w-10 sm:rounded-full" />
            <div className="h-10 rounded-xl bg-muted sm:w-10 sm:rounded-full" />
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)]">
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[28px] border border-primary/12 bg-linear-to-br from-primary/20 via-primary/10 to-transparent p-5 shadow-xl shadow-primary/10">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded-full bg-white/30" />
                  <div className="h-6 w-36 rounded-xl bg-white/35" />
                </div>
                <div className="h-7 w-20 rounded-full bg-white/20" />
              </div>
              <div className="mt-10 space-y-4">
                <div className="h-8 w-48 rounded-xl bg-white/25" />
                <div className="h-4 w-28 rounded-xl bg-white/20" />
              </div>
              <div className="mt-10 flex items-end justify-between">
                <div className="space-y-2">
                  <div className="h-3 w-20 rounded-full bg-white/25" />
                  <div className="h-4 w-28 rounded-xl bg-white/30" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 rounded-full bg-white/25" />
                  <div className="h-4 w-14 rounded-xl bg-white/30" />
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-2">
              <div className="h-10 w-24 rounded-full bg-muted" />
              <div className="h-10 w-24 rounded-full bg-muted" />
              <div className="h-10 w-14 rounded-full bg-muted" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div className="h-6 w-40 rounded-xl bg-muted" />
                <div className="h-7 w-24 rounded-full bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-muted" />
                  <div className="h-8 w-28 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-muted" />
                  <div className="h-8 w-28 rounded-xl bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-24 rounded-full bg-muted" />
                  <div className="h-8 w-28 rounded-xl bg-muted" />
                </div>
              </div>
              <div className="mt-6 h-3 rounded-full bg-muted" />
            </div>

            <div className="rounded-3xl border border-border/70 bg-card p-3 shadow-sm">
              <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-border/70 p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-muted" />
                      <div className="space-y-2">
                        <div className="h-4 w-36 rounded-xl bg-muted" />
                        <div className="h-3 w-24 rounded-xl bg-muted" />
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-4 w-20 rounded-xl bg-muted" />
                      <div className="h-3 w-14 rounded-xl bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreditCardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const {
    status: onboardingStatus,
    loading: onboardingLoading,
    activeStep: onboardingActiveStep,
    isActive: isOnboardingActive,
    completeTour,
  } = useOnboarding();
  const { transactions, loading: txLoading } = useTransactions();
  const searchParams = useSearchParams();

  const [settings, setSettings] = useState<CreditCardSettings>(defaultSettings);
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [isLoadingState, setIsLoadingState] = useState(true);
  
  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCard, setIsSavingCard] = useState(false);
  const [showCardForm, setShowCardForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Form States
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [cardBankName, setCardBankName] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [cardBin, setCardBin] = useState("");
  const [cardBrand, setCardBrand] = useState("");
  const [cardType, setCardType] = useState<PaymentCardType>("credit_card");
  const [cardDueDate, setCardDueDate] = useState<string>("");
  const [isIdentifyingCard, setIsIdentifyingCard] = useState(false);
  
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);
  const cardIdFromQuery = useMemo(() => searchParams.get("cardId"), [searchParams]);
  const carouselTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  
  const activeCard = useMemo(
    () => paymentCards.find((card) => card.id === selectedCardId) || paymentCards[0] || null,
    [paymentCards, selectedCardId]
  );

  const cardTransactions = useMemo(() => {
    if (!activeCard) return [];
    const normalizedBank = activeCard.bankName.toLowerCase();
    return transactions
      .filter((tx) => tx.type === "expense")
      .filter((tx) => tx.paymentMethod === "credit_card" || tx.paymentMethod === "debit_card")
      .filter((tx) => {
        if (tx.cardId && tx.cardId === activeCard.id) return true;
        const label = String(tx.cardLabel || "").toLowerCase();
        return label.includes(activeCard.last4) && label.includes(normalizedBank);
      })
      .sort((a, b) => String(b.dueDate || "").localeCompare(String(a.dueDate || "")))
      .slice(0, 12);
  }, [transactions, activeCard]);

  const activeCardCreditSummary = useMemo(() => {
    if (!activeCard || activeCard.type === "debit_card") return null;
    const linked = transactions.filter((tx) => {
      if (tx.type !== "expense" || tx.paymentMethod !== "credit_card") return false;
      if (tx.cardId && tx.cardId === activeCard.id) return true;
      const label = String(tx.cardLabel || "").toLowerCase();
      return label.includes(activeCard.last4) && label.includes(activeCard.bankName.toLowerCase());
    });
    const pending = linked.filter((tx) => tx.status === "pending");
    const used = pending.reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    const limit = Number(activeCard.creditLimit || 0);
    const available = limit - used;
    const usagePct = limit > 0 ? (used / limit) * 100 : 0;
    const isExceeded = limit > 0 && used > limit;
    return { used, limit, available, usagePct, isExceeded, pendingCount: pending.length };
  }, [transactions, activeCard]);

  const danger = Boolean(activeCardCreditSummary?.isExceeded);
  const warning = !danger && Boolean(activeCardCreditSummary && activeCardCreditSummary.usagePct >= settings.alertThresholdPct);
  const isCardOnboardingActive =
    isOnboardingActive &&
    onboardingActiveStep === "firstCard" &&
    !onboardingStatus.steps.firstCard;

  usePlatformTour({
    route: "cards",
    disabled: onboardingLoading || isOnboardingActive,
    onComplete: completeTour,
  });

  useEffect(() => {
    if (!user) {
      setPaymentCards([]);
      return;
    }
    setIsLoadingState(true);
    const unsubscribe = subscribeToPaymentCards(
      user.uid,
      (cards) => {
        setPaymentCards(cards);
        setIsLoadingState(false);
      },
      (error) => {
        setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha ao carregar cartão." });
        setIsLoadingState(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!activeCard || activeCard.type === "debit_card") {
      setSettings(defaultSettings);
      return;
    }
    setSettings((prev) => ({
      ...prev,
      enabled: activeCard.limitEnabled ?? true,
      limit: Number(activeCard.creditLimit ?? 0),
      alertThresholdPct: Number(activeCard.alertThresholdPct ?? 80),
      blockOnLimitExceeded: false,
    }));
  }, [activeCard]);

  useEffect(() => {
    if (paymentCards.length === 0) {
      setSelectedCardId(null);
      setCarouselIndex(0);
      return;
    }
    const hasSelected = selectedCardId && paymentCards.some((card) => card.id === selectedCardId);
    if (!hasSelected) {
      setSelectedCardId(paymentCards[0].id);
      setCarouselIndex(0);
      return;
    }
    const currentIndex = paymentCards.findIndex((card) => card.id === selectedCardId);
    if (currentIndex >= 0 && currentIndex !== carouselIndex) {
      setCarouselIndex(currentIndex);
    }
  }, [paymentCards, selectedCardId, carouselIndex]);

  useEffect(() => {
    if (paymentCards.length === 0) return;

    const fromStorage = (() => {
      try {
        return window.localStorage.getItem("wevenfinance:cards:selectedCardId");
      } catch {
        return null;
      }
    })();

    const preferredId = cardIdFromQuery || fromStorage;
    if (!preferredId) return;
    const preferredIndex = paymentCards.findIndex((card) => card.id === preferredId);
    if (preferredIndex < 0) return;

    setSelectedCardId(paymentCards[preferredIndex].id);
    setCarouselIndex(preferredIndex);

    if (fromStorage) {
      try {
        window.localStorage.removeItem("wevenfinance:cards:selectedCardId");
      } catch {}
    }
  }, [paymentCards, cardIdFromQuery]);

  const handleSave = async () => {
    if (!activeCard || activeCard.type === "debit_card") {
      setFeedback({ type: "info", message: "Cartão de débito usa o saldo disponível. Não há limite de fatura." });
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      await updatePaymentCard(activeCard.id, {
        limitEnabled: settings.enabled,
        creditLimit: Number(settings.limit || 0),
        alertThresholdPct: Number(settings.alertThresholdPct || 80),
      });
      const cards = await getPaymentCards();
      setPaymentCards(cards);
      setFeedback({ type: "success", message: "Regras salvas para este cartão." });
      setShowSettings(false);
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha ao salvar configurações." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncHistorical = async () => {
    if (!user) return;
    setIsSyncing(true);
    setFeedback(null);
    try {
      const count = await syncCreditCardAmountForLimit(user.uid, transactions);
      setFeedback({
        type: "info",
        message: count > 0 ? `Sincronização concluída em ${count} lançamentos.` : "Nenhum lançamento antigo precisava de sincronização.",
      });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha ao sincronizar histórico." });
    } finally {
      setIsSyncing(false);
    }
  };

  const resetCardForm = () => {
    setEditingCardId(null);
    setCardBankName("");
    setCardLast4("");
    setCardBin("");
    setCardBrand("");
    setCardType("credit_card");
    setCardDueDate("");
    setShowCardForm(false);
  };

  useEffect(() => {
    if (editingCardId) {
      setIsIdentifyingCard(false);
      return;
    }
    const safeBin = cardBin.replace(/\D/g, "").slice(0, 8);
    if (safeBin.length < 6) {
      setIsIdentifyingCard(false);
      return;
    }

    let cancelled = false;
    setIsIdentifyingCard(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const identification = await identifyPaymentCard(safeBin);
          if (cancelled) return;
          if (identification.brand) setCardBrand(identification.brand);
          if (identification.bankName) setCardBankName(identification.bankName);
          if (identification.suggestedType) setCardType(identification.suggestedType);
        } catch {
          if (!cancelled) setCardBrand("");
        } finally {
          if (!cancelled) setIsIdentifyingCard(false);
        }
      })();
    }, 350);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [cardBin, editingCardId]);

  const handleSaveCard = async () => {
    const safeLast4 = cardLast4.replace(/\D/g, "").slice(-4);
    if (!cardBankName.trim() || safeLast4.length !== 4) {
      setFeedback({ type: "error", message: "Informe o banco e o final com 4 dígitos." });
      return;
    }
    
    const isCreditFunction = cardType === "credit_card" || cardType === "credit_and_debit";
    if (isCreditFunction && cardDueDate) {
      const day = Number(cardDueDate);
      if (day < 1 || day > 31) {
        setFeedback({ type: "error", message: "O dia de vencimento deve ser entre 1 e 31." });
        return;
      }
    }

    setIsSavingCard(true);
    setFeedback(null);
    try {
      const payload = {
        bankName: cardBankName.trim().toUpperCase(),
        last4: safeLast4,
        type: cardType,
        brand: cardBrand ? cardBrand.toUpperCase() : undefined,
        bin: cardBin.replace(/\D/g, "").slice(0, 8) || undefined,
        dueDate: isCreditFunction && cardDueDate ? Number(cardDueDate) : undefined,
        limitEnabled: isCreditFunction ? true : undefined,
        creditLimit: isCreditFunction ? 0 : undefined,
        alertThresholdPct: isCreditFunction ? 80 : undefined,
      };

      if (editingCardId) {
        await updatePaymentCard(editingCardId, payload);
      } else {
        await createPaymentCard(payload);
      }

      const cards = await getPaymentCards();
      setPaymentCards(cards);
      resetCardForm();
      setFeedback({ type: "success", message: "Cartão salvo com sucesso." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha ao salvar o cartão." });
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleEditCard = (card: PaymentCard) => {
    setEditingCardId(card.id);
    setCardBankName(card.bankName);
    setCardLast4(card.last4);
    setCardBin(card.bin || "");
    setCardBrand(card.brand || "");
    setCardType(card.type);
    setCardDueDate(card.dueDate ? String(card.dueDate) : "");
    setShowCardForm(true);
  };

  const selectCardByIndex = (index: number) => {
    if (paymentCards.length === 0) return;
    const safeIndex = ((index % paymentCards.length) + paymentCards.length) % paymentCards.length;
    const card = paymentCards[safeIndex];
    if (!card) return;
    setCarouselIndex(safeIndex);
    setSelectedCardId(card.id);
  };

  const handlePrevCard = () => selectCardByIndex(carouselIndex - 1);
  const handleNextCard = () => selectCardByIndex(carouselIndex + 1);

  const getCarouselCard = (offset: number) => {
    if (paymentCards.length === 0) return null;
    const safeIndex = ((carouselIndex + offset) % paymentCards.length + paymentCards.length) % paymentCards.length;
    return paymentCards[safeIndex] || null;
  };

  const handleCarouselTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    carouselTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleCarouselTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = carouselTouchStartRef.current;
    carouselTouchStartRef.current = null;
    if (!start || paymentCards.length <= 1) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;
    if (deltaX > 0) handlePrevCard();
    else handleNextCard();
  };

  const handleDeleteCard = async (cardId: string) => {
    setIsSavingCard(true);
    setFeedback(null);
    try {
      await deletePaymentCard(cardId);
      const cards = await getPaymentCards();
      setPaymentCards(cards);
      if (selectedCardId === cardId) {
        const fallback = cards[0]?.id || null;
        setSelectedCardId(fallback);
        setCarouselIndex(0);
      }
      if (editingCardId === cardId) resetCardForm();
      setFeedback({ type: "success", message: "Cartão removido com sucesso." });
    } catch (error) {
      setFeedback({ type: "error", message: error instanceof Error ? error.message : "Falha ao remover o cartão." });
    } finally {
      setIsSavingCard(false);
    }
  };

  const renderCardFace = (input: { bankName: string; last4: string; type: PaymentCardType; brand?: string; dueDate?: number; className?: string }) => {
    const theme = getBankCardTheme(input.bankName, input.brand);
    const isCreditFunction = input.type === "credit_card" || input.type === "credit_and_debit";
    const displayName = userProfile?.displayName || "Cliente";
    
    return (
      <div className={`relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 ${theme.background} ${theme.shadow} ${input.className || ""}`}>
        <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent pointer-events-none" />
        <div className={`relative aspect-[1.58/1] min-h-[220px] w-full p-5 md:p-6 flex flex-col justify-between ${theme.foreground}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">Bank</p>
              <p className="text-xl font-bold leading-tight tracking-wide">{input.bankName || "SEU BANCO"}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] uppercase tracking-widest font-semibold ${theme.badge}`}>
              {input.type === "credit_card" ? "Credit" : input.type === "debit_card" ? "Debit" : "Multiple"}
            </Badge>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-11 rounded bg-yellow-300/90 border border-yellow-200/80 shadow-sm" />
              <span className={`text-xs font-medium ${theme.muted}`}><PiContactlessPaymentFill className="h-7 w-7"/></span>
            </div>
            <p className="text-lg tracking-[0.22em] font-semibold drop-shadow-sm font-mono">
              **** **** **** {(input.last4 || "0000").padStart(4, "0")}
            </p>
          </div>

          <div className="flex items-end justify-between mt-auto">
            <div>
              <p className={`text-[10px] uppercase tracking-widest ${theme.muted}`}>Cardholder</p>
              <p className="text-sm font-semibold tracking-wider">{displayName.slice(0, 22).toUpperCase()}</p>
            </div>
            <div className="text-right">
              {isCreditFunction && input.dueDate ? (
                <>
                  <p className={`text-[10px] uppercase tracking-widest ${theme.muted}`}>Vencimento</p>
                  <p className="text-[13px] font-semibold tracking-wider">DIA {input.dueDate}</p>
                </>
              ) : (
                <p className={`text-[11px] font-semibold ${theme.muted}`}>Vencimento Dia 10</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderCardPeek = (input: { bankName: string; brand?: string; className?: string }) => {
    const theme = getBankCardTheme(input.bankName, input.brand);

    return (
      <div className={`relative aspect-[1.58/1] min-h-[200px] overflow-hidden rounded-2xl border border-white/10 shadow-xl ${theme.background} ${theme.shadow} ${input.className || ""}`}>
        <div className="absolute inset-0 bg-linear-to-tr from-white/12 to-transparent" />
        <div className="absolute left-5 top-5 h-3 w-16 rounded-full bg-white/25" />
        <div className="absolute left-5 top-12 h-5 w-28 rounded-xl bg-white/20" />
        <div className="absolute bottom-8 left-5 h-7 w-36 rounded-xl bg-white/20" />
        <div className="absolute bottom-8 right-5 h-5 w-14 rounded-xl bg-white/20" />
      </div>
    );
  };

  if (authLoading || txLoading || isLoadingState || !user || !userProfile) {
    return <CardsPageSkeleton />;
  }

  const previousCarouselCard = paymentCards.length > 1 ? getCarouselCard(-1) : null;
  const nextCarouselCard = paymentCards.length > 1 ? getCarouselCard(1) : null;

  return (
    <div className="min-h-screen p-3 pb-20 font-sans sm:p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* HEADER */}
        <div id="tour-cards-header" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              <CreditCard className="h-6 w-6 md:h-8 md:w-8 text-primary" />
              Cartões
            </h1>
            <p className="mt-1 text-sm text-muted-foreground md:text-base">
              Gerencie seus cartões e limites inteligentes.
            </p>
          </div>
          <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
            <Button onClick={handleSyncHistorical} variant="outline" size="icon" className="h-10 w-full rounded-xl border-border/70 bg-card sm:h-10 sm:w-10 sm:rounded-full" disabled={isSyncing || showCardForm} title="Sincronizar Histórico" aria-label="Sincronizar histórico">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
            </Button>
          </div>
        </div>

        {/* ALERTS */}
        {feedback && (
          <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" :
            feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
            "border-primary/20 bg-accent text-primary"
          }`}>
            {feedback.type === "success" && <CheckCircle2 className="h-4 w-4" />}
            {feedback.type === "error" && <AlertTriangle className="h-4 w-4" />}
            {feedback.message}
          </div>
        )}

        {!onboardingLoading && !onboardingStatus.dismissed && !onboardingStatus.steps.firstCard && (
          <div className={`rounded-2xl border px-4 py-3 text-sm ${
            isCardOnboardingActive
              ? "border-primary/35 bg-accent text-accent-foreground ring-2 ring-ring/35"
              : "border-primary/20 bg-accent text-accent-foreground"
          }`}>
            Etapa atual: adicione seu primeiro cartão nesta tela para concluir essa etapa automaticamente.
          </div>
        )}

        {!showCardForm && paymentCards.length === 0 && (
          <Card className="rounded-3xl border-dashed bg-transparent shadow-none">
            <CardContent className="flex min-h-[300px] md:min-h-[360px] flex-col items-center justify-center py-8 md:py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CreditCard className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Nenhum cartão adicionado</h3>
              <p className="mt-2 mb-6 max-w-sm px-2 text-sm text-muted-foreground">
                Adicione seu primeiro cartão para acompanhar faturas, limites e alertas no mesmo lugar.
              </p>
              <Button
                id="tour-cards-add-button"
                onClick={() => setShowCardForm(true)}
                className={`w-full max-w-xs rounded-xl px-8 sm:w-auto ${isCardOnboardingActive ? "ring-2 ring-ring/45 ring-offset-2 ring-offset-background" : ""}`}
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar Cartão
              </Button>
            </CardContent>
          </Card>
        )}

        {/* SECTION 1.5: FORMULÁRIO DE NOVO CARTÃO */}
        {showCardForm && (
          <Card className="rounded-3xl border border-border/70 bg-card shadow-xl animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="border-b border-border/70 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle>{editingCardId ? "Editar Cartão" : "Novo Cartão"}</CardTitle>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar formulário de cartão"
                  onClick={resetCardForm}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-accent"
                >
                  <Plus className="h-5 w-5 rotate-45" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] xl:items-start">
                <div className="space-y-4">
                  <div className="mx-auto w-full max-w-[380px]">
                    {renderCardFace({
                      bankName: cardBankName || "",
                      last4: cardLast4,
                      type: cardType,
                      brand: cardBrand,
                      dueDate: cardDueDate ? Number(cardDueDate) : undefined,
                    })}
                  </div>

                  <div className="app-panel-soft rounded-3xl border p-4">
                    <p className="text-sm font-semibold text-foreground">Identificação pelo BIN</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {editingCardId
                        ? "Ao editar, o BIN continua como referência e não sobrescreve mais o nome do banco automaticamente."
                        : "Ao cadastrar, o BIN pode sugerir banco, bandeira e função para você revisar antes de salvar."}
                    </p>

                    <div className="mt-4 rounded-2xl border border-primary/15 bg-background/80 p-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-1">
                          BIN (6 primeiros dígitos)
                          <span className="text-xs font-normal text-muted-foreground">Opcional</span>
                        </Label>
                        <Input value={cardBin} maxLength={8} inputMode="numeric" placeholder="Ex: 539022" onChange={(e) => setCardBin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                        <div className="min-h-4">
                          {isIdentifyingCard ? (
                            <p className="flex items-center gap-1 text-xs text-primary animate-pulse">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Identificando banco...
                            </p>
                          ) : cardBrand ? (
                            <p className="flex items-center gap-1 text-xs text-emerald-600">
                              <CheckCircle2 className="h-3 w-3" /> {cardBankName || "Banco detectado"} • {cardBrand}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">Informe o BIN se quiser uma sugestão automática do banco.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5">
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Nome do Banco / Emissor</Label>
                      <Input value={cardBankName} maxLength={40} list="bank-options" placeholder="Ex: Nubank" onChange={(e) => setCardBankName(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                      <Label>Final do cartão (4 dígitos)</Label>
                      <Input value={cardLast4} maxLength={4} inputMode="numeric" placeholder="1234" onChange={(e) => setCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} />
                    </div>

                    <div className="space-y-2">
                      <Label>Função do Cartão</Label>
                      <Select value={cardType} onValueChange={(v) => setCardType(v as PaymentCardType)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit_card">Crédito</SelectItem>
                          <SelectItem value="debit_card">Débito</SelectItem>
                          <SelectItem value="credit_and_debit">Múltiplo (Crédito e Débito)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(cardType === "credit_card" || cardType === "credit_and_debit") && (
                      <div className="space-y-2 sm:col-span-2">
                        <Label>Dia de vencimento da fatura</Label>
                        <Input value={cardDueDate} inputMode="numeric" placeholder="Ex: 10" className="w-full sm:max-w-xs" onChange={(e) => setCardDueDate(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row">
                    <Button onClick={handleSaveCard} disabled={isSavingCard} className="w-full rounded-xl sm:flex-1">
                      {editingCardId ? "Salvar Alterações" : "Adicionar Cartão"}
                    </Button>
                    <Button variant="outline" onClick={resetCardForm} disabled={isSavingCard} className="w-full rounded-xl sm:flex-1">
                      Cancelar
                    </Button>
                  </div>
                </div>
              </div>
              <datalist id="bank-options">{BANK_OPTIONS.map((bank) => <option key={bank} value={bank} />)}</datalist>
            </CardContent>
          </Card>
        )}

        {!showCardForm && paymentCards.length > 0 && activeCard && (
          <div className="grid gap-6 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
            <div className="space-y-5">
              <div
                id="tour-cards-carousel"
                className="group relative mx-auto w-full max-w-[430px] touch-pan-y select-none overflow-hidden px-3 py-3"
                onTouchStart={handleCarouselTouchStart}
                onTouchEnd={handleCarouselTouchEnd}
              >
                {paymentCards.length > 1 && (
                  <>
                    <button
                      type="button"
                      aria-label="Cartão anterior"
                      onClick={handlePrevCard}
                      className="absolute left-3 top-[35%] z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-lg backdrop-blur transition-all hover:bg-accent md:left-0"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Próximo cartão"
                      onClick={handleNextCard}
                      className="absolute right-3 top-[35%] z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-card/90 text-muted-foreground shadow-lg backdrop-blur transition-all hover:bg-accent md:right-0"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}

                <div className="relative min-h-[232px] sm:min-h-[252px]">
                  {previousCarouselCard && (
                    <div className="pointer-events-none absolute left-0 top-1/2 z-0 w-[72%] -translate-x-[36%] -translate-y-1/2 scale-[0.84] opacity-45 blur-[0.2px] transition-all duration-300 sm:w-[76%] sm:-translate-x-[32%] sm:scale-90">
                      {renderCardPeek({
                        bankName: previousCarouselCard.bankName,
                        brand: previousCarouselCard.brand,
                      })}
                    </div>
                  )}

                  {nextCarouselCard && (
                    <div className="pointer-events-none absolute right-0 top-1/2 z-0 w-[72%] translate-x-[36%] -translate-y-1/2 scale-[0.84] opacity-45 blur-[0.2px] transition-all duration-300 sm:w-[76%] sm:translate-x-[32%] sm:scale-90">
                      {renderCardPeek({
                        bankName: nextCarouselCard.bankName,
                        brand: nextCarouselCard.brand,
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    aria-label={`Editar cartão ${activeCard.bankName || "selecionado"}`}
                    className={`relative z-10 mx-auto block rounded-2xl text-left transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${paymentCards.length > 1 ? "w-[88%] sm:w-[92%]" : "w-full"}`}
                    onClick={() => handleEditCard(activeCard)}
                  >
                    {renderCardFace({
                      bankName: activeCard.bankName,
                      last4: activeCard.last4,
                      type: activeCard.type,
                      brand: activeCard.brand,
                      dueDate: activeCard.dueDate,
                    })}
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3">
                  <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card shadow-sm hover:bg-accent" onClick={() => handleEditCard(activeCard)}>
                    <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full border-red-200 bg-card shadow-sm text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleDeleteCard(activeCard.id)}>
                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                  </Button>
                  <Button id="tour-cards-add-button" type="button" variant="default" size="sm" aria-label="Adicionar novo cartão" className="rounded-full shadow-sm" onClick={() => setShowCardForm(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Novo cartão
                  </Button>
                </div>

                {paymentCards.length > 1 && (
                  <div className="mt-5 flex items-center justify-center gap-1">
                    {paymentCards.map((card, index) => (
                      <button
                        key={card.id}
                        type="button"
                        aria-label={`Selecionar cartão ${index + 1}`}
                        onClick={() => selectCardByIndex(index)}
                        className="flex h-7 w-7 items-center justify-center rounded-full"
                      >
                        <span className={`h-2 rounded-full transition-all duration-300 ${activeCard.id === card.id ? "w-6 bg-primary" : "w-2.5 bg-muted"}`} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Cartão selecionado</p>
                      <p className="mt-1 truncate text-base font-semibold text-foreground">{activeCard.bankName} final {activeCard.last4}</p>
                    </div>
                    <Badge variant="secondary" className="app-panel-subtle shrink-0 text-muted-foreground">
                      {activeCard.type === "credit_card" ? "Crédito" : activeCard.type === "debit_card" ? "Débito" : "Múltiplo"}
                    </Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">BIN</p>
                      <p className="mt-2 font-semibold text-foreground">{activeCard.bin || "Não informado"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Bandeira</p>
                      <p className="mt-2 font-semibold text-foreground">{activeCard.brand || "Manual"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card id="tour-cards-limit-panel" className="overflow-hidden rounded-3xl border border-border/70 bg-card shadow-md">
                <CardContent className="space-y-6 p-6 md:p-8">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
                        <ShieldAlert className="h-5 w-5 text-primary" /> Limite e alertas do cartão
                      </h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ajuste limite, alerta de uso e a régua deste cartão no mesmo lugar.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="app-panel-subtle font-medium text-muted-foreground">Por cartão</Badge>
                      {activeCard.type !== "debit_card" && (
                        <Button variant={showSettings ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setShowSettings((prev) => !prev)}>
                          <Settings2 className="mr-2 h-4 w-4" />
                          {showSettings ? "Ocultar ajustes" : "Ajustar regras"}
                        </Button>
                      )}
                    </div>
                  </div>

                  {activeCard.type === "debit_card" ? (
                    <div className="rounded-2xl border border-primary/20 bg-accent px-4 py-3 text-sm text-primary">
                      Cartão de débito: as compras devem respeitar o saldo disponível da conta.
                    </div>
                  ) : (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-sm font-medium text-muted-foreground">Limite do cartão</p>
                          <p className="financial-value mt-2 text-xl font-bold text-foreground sm:text-2xl">{formatCurrency(activeCardCreditSummary?.limit || 0)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-sm font-medium text-muted-foreground">Usado na fatura</p>
                          <p className="financial-value mt-2 text-xl font-bold text-foreground sm:text-2xl">{formatCurrency(activeCardCreditSummary?.used || 0)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-sm font-medium text-muted-foreground">Disponível</p>
                          <p className={`financial-value mt-2 text-xl font-bold sm:text-2xl ${(activeCardCreditSummary?.available || 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                            {formatCurrency(activeCardCreditSummary?.available || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full transition-all duration-700 ease-out ${danger ? "bg-red-500" : warning ? "bg-amber-400" : "bg-primary"}`}
                            style={{ width: `${Math.min(100, Math.max(0, activeCardCreditSummary?.usagePct || 0))}%` }}
                          />
                        </div>
                        <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-medium text-muted-foreground">{(activeCardCreditSummary?.usagePct || 0).toFixed(1)}% utilizado</span>
                          {danger && <span className="flex items-center gap-1 font-semibold text-red-600"><AlertTriangle className="h-4 w-4" /> Limite excedido</span>}
                          {warning && !danger && <span className="font-semibold text-amber-600">Próximo do alerta configurado</span>}
                        </div>
                        <div className="pt-1">
                          <Link href={`/piggy-bank/new?goal=card_limit&cardId=${encodeURIComponent(activeCard.id)}`}>
                            <Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                              <PiggyBank className="mr-2 h-4 w-4" />
                              Aumentar limite com cofrinho do cartão
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </>
                  )}

                  <div className="border-t border-border/70 pt-6">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">Regras deste cartão</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {activeCard.type === "debit_card"
                            ? "Cartões de débito usam o saldo da conta, por isso não possuem limite de fatura."
                            : "Defina quando alertar e qual teto este cartão deve respeitar."}
                        </p>
                      </div>
                      {activeCard.type !== "debit_card" && !showSettings && (
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">Alerta em {settings.alertThresholdPct}%</Badge>
                          <Badge variant="outline" className="rounded-full border-border/70 bg-background/80 px-3 py-1 text-xs text-muted-foreground">{settings.enabled ? "Controle ativo" : "Controle pausado"}</Badge>
                        </div>
                      )}
                    </div>

                    {activeCard.type === "debit_card" ? (
                      <div className="app-panel-subtle rounded-2xl border p-4 text-sm text-muted-foreground">
                        Use este cartão para gastos do dia a dia sem depender de fatura. A conferência acontece pelo saldo já disponível.
                      </div>
                    ) : showSettings ? (
                      <div className="space-y-5 rounded-3xl border border-border/70 bg-background/70 p-5">
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label>Limite deste cartão (R$)</Label>
                            <Input type="number" min={0} step="0.01" value={settings.limit} onChange={(e) => setSettings((prev) => ({ ...prev, limit: Number(e.target.value || 0) }))} />
                          </div>
                          <div className="space-y-2">
                            <Label>Alerta de uso (%)</Label>
                            <Input type="number" min={1} max={100} value={settings.alertThresholdPct} onChange={(e) => setSettings((prev) => ({ ...prev, alertThresholdPct: Number(e.target.value || 80) }))} />
                          </div>
                        </div>

                        <div className="app-panel-subtle flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">Ativar controle por limite</p>
                            <p className="text-xs text-muted-foreground">Monitorar compras para não estourar o teto configurado para este cartão.</p>
                          </div>
                          <Switch className="data-[state=checked]:bg-primary" checked={settings.enabled} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enabled: checked }))} />
                        </div>

                        <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-end">
                          <Button variant="outline" className="rounded-xl" onClick={() => setShowSettings(false)}>
                            Fechar ajustes
                          </Button>
                          <Button onClick={handleSave} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" /> {isSaving ? "Salvando..." : "Salvar Regras"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="flex items-center gap-2 px-2 text-lg font-bold text-foreground">
                  <ReceiptText className="h-5 w-5 text-primary" /> Lançamentos recentes
                </h3>
                <div className="rounded-3xl border border-border/70 bg-card p-2 shadow-sm">
                  {cardTransactions.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground">Nenhuma compra recente no {activeCard.bankName} final {activeCard.last4}.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/70">
                      {cardTransactions.map((tx) => (
                        <div key={tx.id} className="flex flex-col gap-4 rounded-2xl p-4 transition-colors hover:bg-accent/60 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tx.status === "pending" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                              <ReceiptText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-foreground">{tx.description}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">{tx.category} • Vence {tx.dueDate}</p>
                            </div>
                          </div>
                          <div className="text-left sm:text-right">
                            <p className="font-bold text-foreground">{formatCurrency(Number(tx.amount || 0))}</p>
                            <p className={`mt-1 text-[10px] font-semibold uppercase tracking-wider ${tx.status === "pending" ? "text-amber-600" : "text-emerald-600"}`}>
                              {tx.status === "pending" ? "Em aberto" : "Pago"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
