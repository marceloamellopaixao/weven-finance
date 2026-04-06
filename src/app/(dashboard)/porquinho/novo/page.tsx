"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PiggyBankGoalType } from "@/types/piggyBank";
import { getPaymentCards } from "@/services/paymentCardService";
import { savePiggyDeposit } from "@/services/piggyBankService";
import { useTransactions } from "@/hooks/useTransactions";
import { useAuth } from "@/hooks/useAuth";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { PaymentCard } from "@/types/paymentCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Home, Landmark, PiggyBank as PiggyBankIcon, Plane, PlusCircle, ShieldCheck, Sparkles, Wallet } from "lucide-react";

type GoalOption = {
  type: PiggyBankGoalType;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
};

const GOAL_OPTIONS: GoalOption[] = [
  { type: "card_limit", label: "Cofrinho do Cartão", description: "Aumentar limite do cartão com reserva dedicada.", icon: Landmark },
  { type: "emergency_reserve", label: "Reserva de Emergência", description: "Cobrir imprevistos com segurança.", icon: ShieldCheck },
  { type: "travel", label: "Fazer uma Viagem", description: "Guardar para transporte, hospedagem e passeios.", icon: Plane },
  { type: "home_renovation", label: "Reformar a Casa", description: "Separar valor para materiais e mão de obra.", icon: Home },
  { type: "dream_purchase", label: "Sonho de Consumo", description: "Chegar no seu objetivo sem bagunçar o orçamento.", icon: Sparkles },
  { type: "custom", label: "Criar Novo Objetivo", description: "Defina seu próprio porquinho.", icon: PlusCircle },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function NewPiggyBankPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, userProfile } = useAuth();
  const { transactions } = useTransactions();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goalType, setGoalType] = useState<PiggyBankGoalType>(
    (searchParams.get("goal") as PiggyBankGoalType) || "emergency_reserve"
  );
  const [goalName, setGoalName] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [withdrawalMode, setWithdrawalMode] = useState("");
  const [yieldType, setYieldType] = useState("");
  const [sourceType, setSourceType] = useState<"bank" | "cash">("bank");
  const [cardId, setCardId] = useState(searchParams.get("cardId") || "");
  const [cards, setCards] = useState<PaymentCard[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const availableBalance = useMemo(() => {
    return transactions.reduce((acc, tx) => {
      if (tx.status !== "paid") return acc;
      return tx.type === "income" ? acc + Number(tx.amount || 0) : acc - Number(tx.amount || 0);
    }, 0);
  }, [transactions]);

  const parsedAmount = useMemo(() => {
    return parseCurrencyInput(amountInput);
  }, [amountInput]);

  const selectedGoal = useMemo(
    () => GOAL_OPTIONS.find((item) => item.type === goalType) || GOAL_OPTIONS[0],
    [goalType]
  );

  const effectiveGoalName = useMemo(() => {
    const customName = goalName.trim();
    if (goalType === "custom" && customName) return customName;
    return selectedGoal.label;
  }, [goalName, goalType, selectedGoal.label]);

  const selectedCard = useMemo(
    () => cards.find((card) => card.id === cardId),
    [cards, cardId]
  );

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
        setFeedback(error instanceof Error ? error.message : "Não foi possível carregar os dados do porquinho.");
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const canGoStep2 = goalType !== "custom" || goalName.trim().length > 1;
  const canGoStep3 =
    parsedAmount > 0 &&
    parsedAmount <= Math.max(0, availableBalance) &&
    (goalType !== "card_limit" || Boolean(cardId));

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
      setFeedback(error instanceof Error ? error.message : "Falha ao guardar valor no porquinho.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user || !userProfile) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500">Carregando cofrinho...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/40 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-violet-600" />
              Criar Cofrinho
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Configure a meta, informe o valor e confirme o aporte em uma página dedicada.
            </p>
          </div>
          <Link href="/piggy-bank">
            <Button variant="outline" className="rounded-xl">Voltar para Porquinhos</Button>
          </Link>
        </div>

        {feedback && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{feedback}</div>
        )}

        <Card className="rounded-3xl border-zinc-200">
          <CardHeader className="pb-4">
            <CardTitle>Etapa {step} de 3</CardTitle>
            <CardDescription>
              {step === 1 && "Escolha o objetivo do seu cofrinho."}
              {step === 2 && "Informe quanto vai guardar e as opções adicionais."}
              {step === 3 && "Revise os dados antes de confirmar o envio para o porquinho."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <div className="space-y-5">
                <Label className="text-base">Qual é o objetivo deste porquinho?</Label>
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
                            ? "border-violet-400 bg-violet-50 shadow-sm"
                            : "border-zinc-200 bg-white hover:border-violet-300 hover:bg-violet-50/40"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`h-5 w-5 ${selected ? "text-violet-700" : "text-zinc-500"}`} />
                          <p className={`font-semibold ${selected ? "text-violet-800" : "text-zinc-800"}`}>{goal.label}</p>
                        </div>
                        <p className="mt-2 text-xs text-zinc-500">{goal.description}</p>
                      </button>
                    );
                  })}
                </div>

                {goalType === "custom" && (
                  <div className="space-y-2">
                    <Label>Nome do novo objetivo</Label>
                    <Input
                      value={goalName}
                      onChange={(e) => setGoalName(e.target.value)}
                      placeholder="Ex: Trocar de notebook"
                      maxLength={80}
                    />
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Quanto você quer guardar?</Label>
                    <Input
                      value={amountInput}
                      onChange={(e) => setAmountInput(formatCurrencyInput(e.target.value))}
                      placeholder="R$ 0,00"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                    <p className="text-xs text-zinc-500">Saldo disponível</p>
                    <p className="mt-1 text-lg font-bold text-zinc-900">{formatCurrency(availableBalance)}</p>
                    {parsedAmount > availableBalance && (
                      <p className="mt-2 text-xs text-red-600">O valor informado excede seu saldo disponível.</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Modalidade de retirada (opcional)</Label>
                    <Input
                      value={withdrawalMode}
                      onChange={(e) => setWithdrawalMode(e.target.value)}
                      placeholder="Ex: Dinheiro sempre disponível"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de rendimento (opcional)</Label>
                    <Input
                      value={yieldType}
                      onChange={(e) => setYieldType(e.target.value)}
                      placeholder="Ex: CDB, Tesouro Direto e etc"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Origem do valor</Label>
                    <Select value={sourceType} onValueChange={(value) => setSourceType(value as "bank" | "cash")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank">Saldo em Banco</SelectItem>
                        <SelectItem value="cash">Dinheiro Vivo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {goalType === "card_limit" && (
                    <div className="space-y-2">
                      <Label>Cartão para aumento de limite</Label>
                      <Select value={cardId} onValueChange={setCardId}>
                        <SelectTrigger><SelectValue placeholder="Selecione um cartão" /></SelectTrigger>
                        <SelectContent>
                          {cards.map((card) => (
                            <SelectItem key={card.id} value={card.id}>
                              {card.bankName} •••• {card.last4}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {cards.length === 0 && (
                        <p className="text-xs text-amber-700">Cadastre ao menos um cartão em `/cards` para usar Cofrinho do Cartão.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-widest text-zinc-500">Revisão</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Objetivo</p>
                    <p className="font-semibold text-zinc-900">{effectiveGoalName}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Valor</p>
                    <p className="font-semibold text-zinc-900">{formatCurrency(parsedAmount)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">Origem</p>
                    <p className="font-semibold text-zinc-900">{sourceType === "cash" ? "Dinheiro Vivo" : "Saldo em Banco"}</p>
                  </div>
                  {withdrawalMode.trim() && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-500">Modalidade de retirada</p>
                      <p className="font-semibold text-zinc-900">{withdrawalMode}</p>
                    </div>
                  )}
                  {yieldType.trim() && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-500">Tipo de rendimento</p>
                      <p className="font-semibold text-zinc-900">{yieldType}</p>
                    </div>
                  )}
                  {goalType === "card_limit" && selectedCard && (
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-zinc-500">Limite aplicado em</p>
                      <p className="font-semibold text-zinc-900">{selectedCard.bankName} •••• {selectedCard.last4}</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-500">Ao confirmar, o valor é lançado no extrato da dashboard e o saldo disponível é atualizado.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              <Button
                variant="outline"
                className="rounded-xl"
                disabled={step === 1}
                onClick={() => setStep((prev) => Math.max(1, prev - 1) as 1 | 2 | 3)}
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
              </Button>

              {step < 3 ? (
                <Button
                  className="rounded-xl bg-violet-600 hover:bg-violet-700"
                  onClick={() => setStep((prev) => Math.min(3, prev + 1) as 1 | 2 | 3)}
                  disabled={(step === 1 && !canGoStep2) || (step === 2 && !canGoStep3)}
                >
                  Continuar <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
                  onClick={handleSubmit}
                  disabled={!canGoStep3 || isSubmitting}
                >
                  <Wallet className="mr-1 h-4 w-4" />
                  {isSubmitting ? "Guardando..." : "Confirmar e Guardar"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
