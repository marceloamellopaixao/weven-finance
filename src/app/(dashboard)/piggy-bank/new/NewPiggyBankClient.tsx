"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Home, Landmark, PiggyBank as PiggyBankIcon, Plane, PlusCircle, ShieldCheck, Sparkles, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useTransactions } from "@/hooks/useTransactions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useTranslations } from "@/i18n/T";
import { useFormatters } from "@/i18n/useFormatters";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { getCurrencySymbol } from "@/lib/money/formatMoney";
import { getPaymentCards } from "@/services/paymentCardService";
import { savePiggyDeposit } from "@/services/piggyBankService";
import { PaymentCard } from "@/types/paymentCard";
import { PiggyBankGoalType } from "@/types/piggyBank";

type GoalOption = {
  type: PiggyBankGoalType;
  labelKey: string;
  descriptionKey: string;
  icon: ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  { type: "card_limit", labelKey: "goals.cardLimit.label", descriptionKey: "goals.cardLimit.description", icon: Landmark },
  { type: "emergency_reserve", labelKey: "goals.emergencyReserve.label", descriptionKey: "goals.emergencyReserve.description", icon: ShieldCheck },
  { type: "travel", labelKey: "goals.travel.label", descriptionKey: "goals.travel.description", icon: Plane },
  { type: "home_renovation", labelKey: "goals.homeRenovation.label", descriptionKey: "goals.homeRenovation.description", icon: Home },
  { type: "dream_purchase", labelKey: "goals.dreamPurchase.label", descriptionKey: "goals.dreamPurchase.description", icon: Sparkles },
  { type: "custom", labelKey: "goals.custom.label", descriptionKey: "goals.custom.description", icon: PlusCircle },
];

function StepBadge({ current, label, active }: { current: boolean; label: string; active: boolean }) {
  const t = useTranslations("piggyBank.new");

  return (
    <div
      className={`rounded-2xl border px-4 py-3 transition-colors ${
        current
          ? "border-primary/35 bg-accent text-accent-foreground"
          : active
            ? "border-border/70 bg-background/80 text-foreground"
            : "border-border/50 bg-background/50 text-muted-foreground"
      }`}
    >
      <p className="text-xs uppercase tracking-[0.16em]">{t("stepLabel")}</p>
      <p className="mt-1 text-sm font-semibold">{label}</p>
    </div>
  );
}

export function NewPiggyBankClient() {
  const t = useTranslations("piggyBank.new");
  const tPiggy = useTranslations("piggyBank");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { activeWorkspaceId } = useWorkspaces();
  const { transactions } = useTransactions();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goalType, setGoalType] = useState((searchParams.get("goal") as PiggyBankGoalType) || "emergency_reserve");
  const [goalName, setGoalName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [withdrawalMode, setWithdrawalMode] = useState("");
  const [yieldType, setYieldType] = useState("");
  const [sourceType, setSourceType] = useState<"bank" | "cash">("bank");
  const [cardId, setCardId] = useState(searchParams.get("cardId") || "");
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const currency = usePreferredCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const { money } = useFormatters(currency);
  const moneyPlaceholder = `${getCurrencySymbol(currency)} 0,00`;

  const availableBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.status !== "paid") return acc;
      return tx.type === "income" ? acc + Number(tx.amount || 0) : acc - Number(tx.amount || 0);
    }, 0);
  }, [transactions]);

  const parsedAmount = useMemo(() => parseCurrencyInput(amountInput), [amountInput]);
  const selectedGoal = useMemo(() => GOAL_OPTIONS.find((item) => item.type === goalType) || GOAL_OPTIONS[0], [goalType]);
  const selectedGoalLabel = tPiggy(selectedGoal.labelKey);
  const effectiveGoalName = useMemo(() => {
    const customName = goalName.trim();
    if (goalType === "custom" && customName) return customName;
    return selectedGoalLabel;
  }, [goalName, goalType, selectedGoalLabel]);
  const selectedCard = useMemo(() => cards.find((card) => card.id === cardId), [cards, cardId]);

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    void (async () => {
      try {
        const loadedCards = await getPaymentCards();
        if (!mounted) return;
        setCards(loadedCards);
        if (loadedCards.length > 0) {
          setCardId((prev) => prev || loadedCards[0].id);
        }
      } catch (error) {
        if (!mounted) return;
        setFeedback(error instanceof Error ? error.message : t("feedback.loadError"));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [activeWorkspaceId, t, user]);

  const canGoStep2 = goalType !== "custom" || goalName.trim().length > 1;
  const canGoStep3 = parsedAmount > 0 && parsedAmount <= Math.max(0, availableBalance) && (goalType !== "card_limit" || Boolean(cardId));

  const handleSubmit = async () => {
    if (!user || !userProfile || !canGoStep3) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const slug = await savePiggyDeposit({
        goalType,
        goalName: effectiveGoalName,
        amount: parsedAmount,
        withdrawalMode: withdrawalMode.trim() || undefined,
        yieldType: yieldType.trim() || undefined,
        sourceType,
        cardId: goalType === "card_limit" ? cardId : undefined,
      });
      router.push(`/piggy-bank/${slug}`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : t("feedback.saveError"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !userProfile) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-primary" />
              {t("title")}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Link href="/piggy-bank">
            <Button variant="outline" className="rounded-xl border-border/70 bg-card">
              {t("actions.backToGoals")}
            </Button>
          </Link>
        </div>

        {feedback && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div>
        )}

        <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
          <CardHeader className="space-y-4 pb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t("stepTitle", { step })}</CardTitle>
                <CardDescription>
                  {step === 1 && t("steps.goal.description")}
                  {step === 2 && t("steps.amount.description")}
                  {step === 3 && t("steps.review.description")}
                </CardDescription>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <StepBadge current={step === 1} active={step >= 1} label={t("steps.goal.label")} />
                <StepBadge current={step === 2} active={step >= 2} label={t("steps.amount.label")} />
                <StepBadge current={step === 3} active={step >= 3} label={t("steps.review.label")} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-5">
                <Label className="text-base">{t("form.goalQuestion")}</Label>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {GOAL_OPTIONS.map((goal) => {
                    const Icon = goal.icon;
                    const selected = goalType === goal.type;
                    return (
                      <button
                        key={goal.type}
                        type="button"
                        onClick={() => setGoalType(goal.type)}
                        className={`rounded-2xl border p-4 text-left transition-all ${
                          selected
                            ? "border-primary/35 bg-accent shadow-sm"
                            : "border-border/70 bg-background/80 hover:border-primary/35 hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                          <p className={`font-semibold ${selected ? "text-primary" : "text-foreground"}`}>{tPiggy(goal.labelKey)}</p>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">{tPiggy(goal.descriptionKey)}</p>
                      </button>
                    );
                  })}
                </div>

                {goalType === "custom" && (
                  <div className="space-y-2">
                    <Label>{t("form.customNameLabel")}</Label>
                    <Input value={goalName} onChange={(e) => setGoalName(e.target.value)} placeholder={t("form.customNamePlaceholder")} maxLength={80} />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-2">
                    <Label>{t("form.amountLabel")}</Label>
                    <Input value={amountInput} onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))} placeholder={moneyPlaceholder} inputMode="decimal" />
                  </div>
                  <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t("form.availableBalance")}</p>
                    <p className="financial-value mt-1 text-lg font-bold text-foreground">{money(availableBalance)}</p>
                    {parsedAmount > availableBalance && (
                      <p className="mt-2 text-xs text-red-600">{t("validation.amountExceedsBalance")}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("form.withdrawalModeLabel")}</Label>
                    <Input value={withdrawalMode} onChange={(e) => setWithdrawalMode(e.target.value)} placeholder={t("form.withdrawalModePlaceholder")} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("form.yieldTypeLabel")}</Label>
                    <Input value={yieldType} onChange={(e) => setYieldType(e.target.value)} placeholder={t("form.yieldTypePlaceholder")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t("form.sourceTypeLabel")}</Label>
                    <Select value={sourceType} onValueChange={(value) => setSourceType(value as "bank" | "cash")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">{t("source.bank")}</SelectItem>
                        <SelectItem value="cash">{t("source.cash")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {goalType === "card_limit" && (
                    <div className="space-y-2">
                      <Label>{t("form.cardLabel")}</Label>
                      <Select value={cardId} onValueChange={setCardId}>
                        <SelectTrigger><SelectValue placeholder={t("form.cardPlaceholder")} /></SelectTrigger>
                        <SelectContent>
                          {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.bankName} •••• {card.last4}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cards.length === 0 && (
                        <p className="text-xs text-amber-700">{t("form.noCardsWarning")}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-5">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("review.title")}</p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{t("review.goal")}</p>
                    <p className="text-right font-semibold text-foreground">{effectiveGoalName}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{t("review.amount")}</p>
                    <p className="financial-value font-semibold text-foreground">{money(parsedAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-muted-foreground">{t("review.source")}</p>
                    <p className="font-semibold text-foreground">{sourceType === "cash" ? t("source.cash") : t("source.bank")}</p>
                  </div>
                  {withdrawalMode.trim() && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{t("review.withdrawal")}</p>
                      <p className="text-right font-semibold text-foreground">{withdrawalMode}</p>
                    </div>
                  )}
                  {yieldType.trim() && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{t("review.yield")}</p>
                      <p className="text-right font-semibold text-foreground">{yieldType}</p>
                    </div>
                  )}
                  {goalType === "card_limit" && selectedCard && (
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm text-muted-foreground">{t("review.appliedTo")}</p>
                      <p className="text-right font-semibold text-foreground">{selectedCard.bankName} •••• {selectedCard.last4}</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-primary/15 bg-accent p-5 text-sm text-accent-foreground">
                  <p className="font-semibold">{t("confirmation.title")}</p>
                  <p className="mt-2">{t("confirmation.description")}</p>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                className="rounded-xl border-border/70 bg-card"
                disabled={step === 1}
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> {t("actions.back")}
              </Button>

              {step < 3 ? (
                <Button
                  className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setStep((prev) => Math.min(3, prev + 1) as 1 | 2 | 3)}
                  disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
                >
                  {t("actions.continue")} <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleSubmit} disabled={!canGoStep3 || isSubmitting}>
                  <Wallet className="mr-1 h-4 w-4" />
                  {isSubmitting ? t("actions.saving") : t("actions.confirmAndSave")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
