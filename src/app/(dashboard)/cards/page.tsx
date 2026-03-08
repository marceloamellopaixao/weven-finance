"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { syncCreditCardAmountForLimit } from "@/services/transactionService";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const BANK_THEMES: Array<{
  matcher: RegExp;
  background: string;
  foreground: string;
  muted: string;
}> = [
  { matcher: /nubank|nu\b/i, background: "bg-linear-to-br from-fuchsia-700 to-violet-900", foreground: "text-white", muted: "text-white/75" },
  { matcher: /inter/i, background: "bg-linear-to-br from-zinc-400 to-zinc-700", foreground: "text-white", muted: "text-white/80" },
  { matcher: /itau|ita[uú]/i, background: "bg-linear-to-br from-orange-700 to-orange-400", foreground: "text-white", muted: "text-white/80" },
  { matcher: /bradesco/i, background: "bg-linear-to-br from-rose-700 to-red-900", foreground: "text-white", muted: "text-white/80" },
  { matcher: /santander/i, background: "bg-linear-to-br from-red-600 to-rose-800", foreground: "text-white", muted: "text-white/80" },
  { matcher: /caixa/i, background: "bg-linear-to-br from-blue-700 to-cyan-600", foreground: "text-white", muted: "text-white/80" },
  { matcher: /banco do brasil|bb\b/i, background: "bg-linear-to-br from-yellow-400 to-blue-700", foreground: "text-zinc-900", muted: "text-zinc-800/80" },
  { matcher: /picpay/i, background: "bg-linear-to-br from-emerald-500 to-green-700", foreground: "text-white", muted: "text-white/80" },
  { matcher: /c6/i, background: "bg-linear-to-br from-zinc-800 to-black", foreground: "text-white", muted: "text-zinc-400" },
  { matcher: /neon/i, background: "bg-linear-to-br from-green-700 to-green-900", foreground: "text-white", muted: "text-white/80" },
  { matcher: /next/i, background: "bg-linear-to-br from-blue-600 to-blue-900", foreground: "text-white", muted: "text-white/80" },
  { matcher: /original/i, background: "bg-linear-to-br from-yellow-400 to-yellow-600", foreground: "text-zinc-900", muted: "text-zinc-800/80" },
  { matcher: /neobank|nobank/i, background: "bg-linear-to-br from-gray-700 to-gray-900", foreground: "text-white", muted: "text-zinc-400" },
  { matcher: /serasa/i, background: "bg-linear-to-br from-yellow-500 to-yellow-700", foreground: "text-zinc-900", muted: "text-zinc-800/80" },
  { matcher: /credicard/i, background: "bg-linear-to-br from-blue-700 to-blue-900", foreground: "text-white", muted: "text-white/80" },
  { matcher: /safra/i, background: "bg-linear-to-br from-green-700 to-green-900", foreground: "text-white", muted: "text-white/80" },
  { matcher: /mercado pago/i, background: "bg-linear-to-br from-blue-400 to-blue-800", foreground: "text-white", muted: "text-white/80" },
  { matcher: /.*/, background: "bg-linear-to-br from-zinc-800 to-zinc-900", foreground: "text-white", muted: "text-zinc-400" },
];

const BANK_OPTIONS = ["Nubank", "Inter", "Itau", "Bradesco", "Santander", "Caixa", "Banco do Brasil", "PicPay", "C6 Bank", "Neon", "Next", "Original", "Serasa", "Credicard", "Safra", "Mercado Pago"];

function getBankTheme(bankName: string) {
  return BANK_THEMES.find((theme) => theme.matcher.test(bankName || "")) || BANK_THEMES[BANK_THEMES.length - 1];
}

const defaultSettings: CreditCardSettings = { enabled: false, cardName: "Cartão principal", limit: 0, alertThresholdPct: 80, blockOnLimitExceeded: false, autoUnblockWhenBelowLimit: true };

export default function CreditCardPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
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
      setFeedback({ type: "info", message: "Cartão de débito usa o saldo disponivel. Não ha limite de fatura." });
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
  }, [cardBin]);

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

  const renderCardFace = (input: { bankName: string; last4: string; type: PaymentCardType; dueDate?: number; className?: string }) => {
    const theme = getBankTheme(input.bankName);
    const isCreditFunction = input.type === "credit_card" || input.type === "credit_and_debit";
    const displayName = userProfile?.displayName || "Cliente";
    
    return (
      <div className={`relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-300 ${theme.background} ${input.className || ""}`}>
        <div className="absolute inset-0 bg-linear-to-tr from-white/10 to-transparent pointer-events-none" />
        <div className={`relative aspect-[1.58/1] min-h-[220px] w-full p-5 md:p-6 flex flex-col justify-between ${theme.foreground}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] opacity-80">Bank</p>
              <p className="text-xl font-bold leading-tight tracking-wide">{input.bankName || "SEU BANCO"}</p>
            </div>
            <Badge variant="outline" className={`border-none bg-black/20 text-[10px] uppercase tracking-widest font-semibold backdrop-blur-md ${theme.foreground}`}>
              {input.type === "credit_card" ? "Credit" : input.type === "debit_card" ? "Debit" : "Multiple"}
            </Badge>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-11 rounded bg-yellow-300/90 border border-yellow-200/80 shadow-sm" />
              <span className={`text-xs font-medium ${theme.muted}`}><PiContactlessPaymentFill className="h-7 w-7"/></span>
            </div>
            <p className="text-3xl tracking-[0.22em] font-semibold drop-shadow-sm font-mono">
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
                <p className={`text-[11px] font-semibold ${theme.muted}`}>VÁLIDO ATÉ 12/40</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (authLoading || txLoading || isLoadingState || !user || !userProfile) {
    return (
      <div className="p-6 flex justify-center items-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-48 w-80 bg-zinc-200 dark:bg-zinc-800 rounded-2xl" />
          <p className="text-sm text-zinc-500">Acessando seus cartões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans p-3 sm:p-4 md:p-8 pb-20 bg-zinc-50/30 dark:bg-zinc-950/30 min-h-screen">
      <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <CreditCard className="h-6 w-6 md:h-8 md:w-8 text-violet-600" />
              Cartões
            </h1>
            <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 mt-1">
              Gerencie seus cartões e limites inteligentes.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSyncHistorical} variant="outline" size="icon" className="rounded-full h-10 w-10" disabled={isSyncing} title="Sincronizar Histórico">
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin text-violet-600" : "text-zinc-600"}`} />
            </Button>
            <Button onClick={() => setShowSettings(!showSettings)} variant={showSettings ? "default" : "outline"} size="icon" className="rounded-full h-10 w-10" title="Configurações">
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ALERTS */}
        {feedback && (
          <div className={`rounded-2xl border px-4 py-3 text-sm shadow-sm flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${
            feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" :
            feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
            "border-blue-200 bg-blue-50 text-blue-700"
          }`}>
            {feedback.type === "success" && <CheckCircle2 className="h-4 w-4" />}
            {feedback.type === "error" && <AlertTriangle className="h-4 w-4" />}
            {feedback.message}
          </div>
        )}

        {/* SECTION 1: O CARTÃO (HERO) */}
        {!showCardForm && (
          <div className="space-y-6">
            {paymentCards.length === 0 ? (
              <Card className="rounded-3xl border-dashed bg-transparent shadow-none">
                <CardContent className="flex min-h-[300px] md:min-h-[360px] flex-col items-center justify-center py-8 md:py-12 text-center">
                  <div className="h-16 w-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
                    <CreditCard className="h-8 w-8 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold">Nenhum cartão adicionado</h3>
                  <p className="text-sm text-zinc-500 max-w-sm mt-2 mb-6 px-2">
                    Adicione seu primeiro cartão para acompanhar faturas e limites em um só lugar.
                  </p>
                  <Button onClick={() => setShowCardForm(true)} className="rounded-xl px-8 w-full sm:w-auto max-w-xs">
                    <Plus className="mr-2 h-4 w-4" /> Adicionar Cartão
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center">
                {activeCard && (
                  <div className="w-full max-w-[400px] group relative">
                    {paymentCards.length > 1 && (
                      <>
                        <button onClick={handlePrevCard} className="absolute -left-12 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border hover:bg-zinc-50 text-zinc-600 transition-all z-10">
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={handleNextCard} className="absolute -right-12 top-1/2 -translate-y-1/2 hidden md:flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md border hover:bg-zinc-50 text-zinc-600 transition-all z-10">
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    
                    <div className="transform transition-transform hover:scale-[1.02] cursor-pointer" onClick={() => handleEditCard(activeCard)}>
                      {renderCardFace({
                        bankName: activeCard.bankName,
                        last4: activeCard.last4,
                        type: activeCard.type,
                        dueDate: activeCard.dueDate,
                      })}
                    </div>

                    <div className="flex items-center justify-center gap-4 mt-6">
                      <Button variant="outline" size="sm" className="rounded-full shadow-sm bg-white" onClick={() => handleEditCard(activeCard)}>
                        <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                      </Button>
                      <Button variant="outline" size="sm" className="rounded-full shadow-sm bg-white text-red-600 hover:text-red-700 hover:bg-red-50 border-red-100" onClick={() => handleDeleteCard(activeCard.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                      </Button>
                      <Button variant="default" size="sm" className="rounded-full shadow-sm" onClick={() => setShowCardForm(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    {paymentCards.length > 1 && (
                      <div className="flex items-center justify-center gap-1.5 mt-6">
                        {paymentCards.map((card, index) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => selectCardByIndex(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${activeCard.id === card.id ? "w-6 bg-violet-600" : "w-2.5 bg-zinc-300"}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SECTION 1.5: FORMULÁRIO DE NOVO CARTÃO */}
        {showCardForm && (
          <Card className="rounded-3xl border shadow-xl animate-in fade-in slide-in-from-bottom-4 bg-white dark:bg-zinc-950">
            <CardHeader className="pb-4 border-b">
              <div className="flex justify-between items-center">
                <CardTitle>{editingCardId ? "Editar Cartão" : "Novo Cartão"}</CardTitle>
                <Button variant="ghost" size="icon" onClick={resetCardForm} className="rounded-full h-8 w-8 text-zinc-500">
                  <Plus className="h-5 w-5 rotate-45" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex justify-center">
                <div className="w-full max-w-[380px]">
                  {/* Nosso renderizador de cartão customizado agora é usado aqui também! */}
                  {renderCardFace({
                    bankName: cardBankName || "",
                    last4: cardLast4,
                    type: cardType,
                    dueDate: cardDueDate ? Number(cardDueDate) : undefined,
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">BIN (6 primeiros dígitos) <span className="text-xs text-zinc-400 font-normal">- Opcional</span></Label>
                  <Label className="flex items-center gap-1"><span className="text-xs text-zinc-400 font-normal">Consulta e preenche automáticaticamente os dados do banco</span></Label>
                  <Input value={cardBin} maxLength={8} inputMode="numeric" placeholder="Ex: 539022" onChange={(e) => setCardBin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
                  <div className="h-4">
                    {isIdentifyingCard ? (
                      <p className="text-xs text-violet-600 animate-pulse flex items-center gap-1"><RefreshCw className="h-3 w-3 animate-spin" /> Identificando banco...</p>
                    ) : cardBrand ? (
                      <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {cardBankName} {cardBrand}</p>
                    ) : null}
                  </div>
                </div>
                
                <div className="space-y-2">
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
                  <div className="space-y-2 md:col-span-2">
                    <Label>Dia de Vencimento da Fatura</Label>
                    <Input type="number" min="1" max="31" value={cardDueDate} placeholder="Ex: 10" className="w-full md:w-1/2" onChange={(e) => setCardDueDate(e.target.value.replace(/\D/g, "").slice(0, 2))} />
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <Button onClick={handleSaveCard} disabled={isSavingCard} className="rounded-xl w-full sm:flex-1">
                  {editingCardId ? "Salvar Alterações" : "Adicionar Cartão"}
                </Button>
                <Button variant="outline" onClick={resetCardForm} disabled={isSavingCard} className="rounded-xl w-full sm:flex-1">Cancelar</Button>
              </div>
              <datalist id="bank-options">{BANK_OPTIONS.map((bank) => <option key={bank} value={bank} />)}</datalist>
            </CardContent>
          </Card>
        )}

        {/* SECTION 2: PAINEL DE LIMITES */}
        {!showCardForm && paymentCards.length > 0 && (
          <Card className="rounded-3xl border-none shadow-md bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="p-6 md:p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-zinc-400" /> Limite Inteligente
                </h2>
                <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 font-medium">Por Cartão</Badge>
              </div>

              {activeCard.type === "debit_card" ? (
                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                  Cartão de débito: as compras devem respeitar seu saldo disponivel (Pix, transferencias e entradas).
                </div>
              ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <p className="text-sm font-medium text-zinc-500 mb-1">Limite do Cartão</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(activeCardCreditSummary?.limit || 0)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500 mb-1">Usado (Pendente)</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(activeCardCreditSummary?.used || 0)}</p>
                </div>
                <div className="col-span-2 md:col-span-1">
                  <p className="text-sm font-medium text-zinc-500 mb-1">Disponivel</p>
                  <p className={`text-2xl font-bold ${(activeCardCreditSummary?.available || 0) < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {formatCurrency(activeCardCreditSummary?.available || 0)}
                  </p>
                </div>
              </div>
              )}

              {activeCard.type !== "debit_card" && (
              <div className="space-y-3">
                <div className="h-3 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex">
                  <div
                    className={`h-full transition-all duration-700 ease-out ${danger ? "bg-red-500" : warning ? "bg-amber-400" : "bg-violet-500"}`}
                    style={{ width: `${Math.min(100, Math.max(0, activeCardCreditSummary?.usagePct || 0))}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-600">{(activeCardCreditSummary?.usagePct || 0).toFixed(1)}% utilizado</span>
                  {danger && <span className="text-red-600 font-semibold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> Excedido</span>}
                  {warning && !danger && <span className="text-amber-600 font-semibold">Próximo ao limite</span>}
                </div>
                {activeCard && (
                  <div className="pt-2">
                    <Link href={`/porquinho?goal=card_limit&cardId=${encodeURIComponent(activeCard.id)}`}>
                      <Button className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
                        <PiggyBank className="mr-2 h-4 w-4" />
                        Aumentar limite com Cofrinho do Cartão
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
              )}
            </div>
          </Card>
        )}

        {/* SECTION 3: TIMELINE DE COMPRAS */}
        {!showCardForm && paymentCards.length > 0 && activeCard && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2 px-2 text-zinc-800 dark:text-zinc-200">
              <ReceiptText className="h-5 w-5 text-zinc-400" /> Lançamentos recentes
            </h3>
            
            <div className="bg-white dark:bg-zinc-950 rounded-3xl p-2 shadow-sm border border-zinc-100 dark:border-zinc-800">
              {cardTransactions.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-zinc-500">Nenhuma compra recente no {activeCard.bankName} final {activeCard.last4}.</p>
                </div>
              ) : (
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {cardTransactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors rounded-2xl">
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 rounded-full flex items-center justify-center ${tx.status === "pending" ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                          <ReceiptText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-zinc-900 dark:text-zinc-100">{tx.description}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {tx.category} • Vence {tx.dueDate}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{formatCurrency(Number(tx.amount || 0))}</p>
                        <p className={`text-[10px] font-semibold uppercase tracking-wider mt-1 ${tx.status === "pending" ? "text-amber-600" : "text-emerald-600"}`}>
                          {tx.status === "pending" ? "Em Aberto" : "Pago"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 4: SETTINGS */}
        {showSettings && (
          <Card className="rounded-3xl border-none shadow-lg animate-in fade-in slide-in-from-top-4 bg-zinc-800 text-white">
            <CardHeader>
              <CardTitle className="text-zinc-100">Configurações do Cartão Selecionado</CardTitle>
              <CardDescription className="text-zinc-400">As regras abaixo valem somente para o cartão ativo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {activeCard.type === "debit_card" ? (
                <div className="rounded-2xl border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300">
                  Cartão de débito não usa limite de fatura. O controle ocorre pelo saldo disponivel da conta.
                </div>
              ) : (
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-zinc-300">Limite deste cartão (R$)</Label>
                  <Input type="number" min={0} step="0.01" value={settings.limit} onChange={(e) => setSettings((prev) => ({ ...prev, limit: Number(e.target.value || 0) }))} className="bg-zinc-900 border-zinc-700 text-white" />
                </div>
                <div className="space-y-2">
                  <Label className="text-zinc-300">Alerta de uso (%)</Label>
                  <Input type="number" min={1} max={100} value={settings.alertThresholdPct} onChange={(e) => setSettings((prev) => ({ ...prev, alertThresholdPct: Number(e.target.value || 80) }))} className="bg-zinc-900 border-zinc-700 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-2xl border border-zinc-700 bg-zinc-800/50 p-4">
                  <div>
                    <p className="font-medium text-sm text-zinc-100">Ativar controle por limite</p>
                    <p className="text-xs text-zinc-400">Monitorar compras para não estourar o limite deste cartão.</p>
                  </div>
                  <Switch checked={settings.enabled} onCheckedChange={(checked) => setSettings((prev) => ({ ...prev, enabled: checked }))} />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} className="rounded-xl bg-white text-zinc-900 hover:bg-zinc-200" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" /> {isSaving ? "Salvando..." : "Salvar Regras"}
                </Button>
              </div>
              </>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}

