"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { addTransaction } from "@/services/transactionService";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { PaymentMethod, TransactionType } from "@/types/transaction";
import { useEffect } from "react";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: true },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

export default function NewTransactionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { categories } = useCategories();

  const [type, setType] = useState<TransactionType>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("debit_card");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState("2");
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [selectedCardId, setSelectedCardId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    return subscribeToPaymentCards(user.uid, setPaymentCards, () => setPaymentCards([]));
  }, [user]);

  const monthCategories = useMemo(
    () => categories.filter((c) => c.type === type || c.type === "both"),
    [categories, type]
  );

  const showDueDateInput = useMemo(() => {
    const method = PAYMENT_METHODS.find((m) => m.value === paymentMethod);
    return Boolean(method?.hasDueDate);
  }, [paymentMethod]);

  const selectedCard = useMemo(
    () => paymentCards.find((card) => card.id === selectedCardId),
    [paymentCards, selectedCardId]
  );

  const currentBalance = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const paid = transactions.reduce((acc, t) => (t.status === "paid" ? (t.type === "income" ? acc + t.amount : acc - t.amount) : acc), 0);
    const overdue = transactions
      .filter((t) => t.status !== "paid" && typeof t.dueDate === "string" && t.dueDate < todayStr)
      .reduce((acc, t) => (t.type === "income" ? acc + t.amount : acc - t.amount), 0);
    return paid + overdue;
  }, [transactions]);

  const linkedCardTransactions = (card: PaymentCard) =>
    transactions.filter((tx) => {
      if (tx.type !== "expense") return false;
      if (tx.cardId && tx.cardId === card.id) return true;
      const label = String(tx.cardLabel || "").toLowerCase();
      return label.includes(card.last4) && label.includes(card.bankName.toLowerCase());
    });

  const validateLimit = (card: PaymentCard, method: PaymentMethod, amountTotal: number) => {
    if (amountTotal <= 0) return true;
    if (method === "debit_card") return amountTotal <= currentBalance;
    if (method !== "credit_card") return true;
    const used = linkedCardTransactions(card)
      .filter((tx) => tx.paymentMethod === "credit_card" && tx.status === "pending")
      .reduce((acc, tx) => acc + Number(tx.amountForLimit ?? tx.amount ?? 0), 0);
    return amountTotal <= Math.max(0, Number(card.creditLimit || 0) - used);
  };

  const onSubmit = async () => {
    if (!user) return;
    setError("");
    if (!description.trim() || !amount || !category) {
      setError("Preencha descrição, valor e categoria.");
      return;
    }

    const isCardPayment = paymentMethod === "credit_card" || paymentMethod === "debit_card";
    if (isCardPayment && !selectedCard) {
      setError("Selecione um cartão para continuar.");
      return;
    }

    const value = Number(amount);
    const count = isInstallment ? Math.max(1, Number(installmentsCount || 1)) : 1;
    const totalAmountToReserve = Math.round(value * count * 100) / 100;

    if (isCardPayment && selectedCard && !validateLimit(selectedCard, paymentMethod, totalAmountToReserve)) {
      setError(
        paymentMethod === "debit_card"
          ? `Saldo insuficiente no débito. Disponível: ${formatCurrency(currentBalance)}`
          : "Limite insuficiente para esta compra."
      );
      return;
    }

    setSaving(true);
    try {
      await addTransaction(user.uid, {
        description: description.trim(),
        amount: value,
        type,
        category,
        paymentMethod,
        cardId: selectedCard?.id,
        cardLabel: selectedCard ? `${selectedCard.bankName} •••• ${selectedCard.last4}` : undefined,
        cardType:
          paymentMethod === "credit_card" || paymentMethod === "debit_card" ? paymentMethod : undefined,
        date,
        dueDate: showDueDateInput ? dueDate : date,
        isInstallment,
        installmentsCount: count,
      });
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar a transação.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 md:p-6">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" className="mb-2" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-violet-600" /> Nova Transação
            </CardTitle>
            <CardDescription>Fluxo otimizado para mobile e desktop.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant={type === "expense" ? "default" : "outline"} onClick={() => setType("expense")}>Despesa</Button>
              <Button variant={type === "income" ? "default" : "outline"} onClick={() => setType("income")}>Receita</Button>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: Mercado" />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {monthCategories.map((cat) => (
                    <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método de pagamento</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(paymentMethod === "credit_card" || paymentMethod === "debit_card") && (
              <div className="space-y-2">
                <Label>Cartão vinculado</Label>
                <Select value={selectedCardId} onValueChange={setSelectedCardId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cartão" /></SelectTrigger>
                  <SelectContent>
                    {paymentCards.length === 0 ? (
                      <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
                    ) : paymentCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.bankName} •••• {card.last4}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              {showDueDateInput && (
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}
            </div>
            {type === "expense" && (
              <div className="rounded-xl border bg-zinc-50 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Compra parcelada</Label>
                  <Switch checked={isInstallment} onCheckedChange={setIsInstallment} />
                </div>
                {isInstallment && (
                  <Input
                    type="number"
                    min={2}
                    max={360}
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(e.target.value)}
                    placeholder="Número de parcelas"
                  />
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button variant="destructive" onClick={() => router.back()}>Cancelar</Button>
              <Button onClick={onSubmit} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                {saving ? "Salvando..." : "Salvar Transação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

