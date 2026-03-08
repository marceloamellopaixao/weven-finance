"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useTransactions } from "@/hooks/useTransactions";
import { useCategories } from "@/hooks/useCategories";
import { PaymentMethod, Transaction } from "@/types/transaction";
import { subscribeToPaymentCards } from "@/services/paymentCardService";
import { PaymentCard } from "@/types/paymentCard";
import { deleteTransaction, updateTransaction } from "@/services/transactionService";

const PAYMENT_METHODS: { value: PaymentMethod; label: string; hasDueDate: boolean }[] = [
  { value: "pix", label: "Pix", hasDueDate: false },
  { value: "boleto", label: "Boleto", hasDueDate: true },
  { value: "cash", label: "Dinheiro", hasDueDate: false },
  { value: "transfer", label: "Transferência", hasDueDate: false },
  { value: "debit_card", label: "Cartão de Débito", hasDueDate: false },
  { value: "credit_card", label: "Cartão de Crédito", hasDueDate: true },
];

export default function EditTransactionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { transactions, loading: loadingTransactions } = useTransactions();
  const { categories } = useCategories();

  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [resolvedTransaction, setResolvedTransaction] = useState(false);

  const txId = String(params?.id || "");

  useEffect(() => {
    if (!user) return;
    return subscribeToPaymentCards(user.uid, setPaymentCards, () => setPaymentCards([]));
  }, [user]);

  useEffect(() => {
    if (!txId) {
      setEditingTx(null);
      setResolvedTransaction(true);
      return;
    }

    if (loadingTransactions) return;

    const found = transactions.find((t) => t.id === txId) || null;
    setEditingTx(found ? { ...found } : null);
    setResolvedTransaction(true);
  }, [transactions, txId, loadingTransactions]);

  const groupedItems = useMemo(() => {
    if (!editingTx?.groupId) return [];
    return transactions
      .filter((t) => t.groupId === editingTx.groupId)
      .sort((a, b) => Number(a.installmentCurrent || 0) - Number(b.installmentCurrent || 0));
  }, [transactions, editingTx?.groupId]);

  const monthCategories = useMemo(() => {
    if (!editingTx) return [];
    return categories.filter((c) => c.type === editingTx.type || c.type === "both");
  }, [categories, editingTx]);

  const showDueDate = useMemo(() => {
    if (!editingTx) return false;
    const method = PAYMENT_METHODS.find((m) => m.value === editingTx.paymentMethod);
    return Boolean(method?.hasDueDate);
  }, [editingTx]);

  const save = async (updateGroup: boolean) => {
    if (!user || !editingTx?.id) return;
    setError("");
    setSaving(true);
    try {
      await updateTransaction(
        user.uid,
        editingTx.id,
        {
          description: editingTx.description,
          amount: Number(editingTx.amount || 0),
          category: editingTx.category,
          paymentMethod: editingTx.paymentMethod,
          cardId: editingTx.cardId,
          cardLabel: editingTx.cardLabel,
          cardType: editingTx.cardType,
          date: editingTx.date,
          dueDate: editingTx.dueDate,
        },
        updateGroup
      );
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (deleteGroup: boolean) => {
    if (!user || !editingTx?.id) return;
    setDeleting(true);
    setError("");
    try {
      await deleteTransaction(user.uid, editingTx.id, deleteGroup);
      router.push("/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível excluir.");
    } finally {
      setDeleting(false);
    }
  };

  if (loadingTransactions || !resolvedTransaction) {
    return (
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-2" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Carregando transação...</CardTitle></CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (!editingTx) {
    return (
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" className="mb-2" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          <Card className="rounded-2xl">
            <CardHeader><CardTitle>Transação não encontrada</CardTitle></CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6">
      <div className="mx-auto max-w-2xl">
        <Button variant="ghost" className="mb-2" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
        </Button>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Editar Transação</CardTitle>
            <CardDescription>
              {editingTx.groupId ? "Esta transação faz parte de um grupo de parcelas." : "Edição individual."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-red-600">{error}</p>}

            {groupedItems.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-700 mb-2">Parcelas do grupo</p>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {groupedItems.map((item) => (
                    <p key={item.id} className={`text-xs ${item.id === editingTx.id ? "font-bold text-violet-700" : "text-zinc-600"}`}>
                      {item.installmentCurrent}/{item.installmentTotal} • {item.dueDate} • R$ {Number(item.amount || 0).toFixed(2)}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={editingTx.description} onChange={(e) => setEditingTx({ ...editingTx, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input type="number" value={editingTx.amount} onChange={(e) => setEditingTx({ ...editingTx, amount: Number(e.target.value || 0) })} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={editingTx.category} onValueChange={(v) => setEditingTx({ ...editingTx, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {monthCategories.map((cat) => <SelectItem key={cat.name} value={cat.name}>{cat.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Método de pagamento</Label>
              <Select
                value={editingTx.paymentMethod}
                onValueChange={(v) => setEditingTx({ ...editingTx, paymentMethod: v as PaymentMethod })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {(editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card") && (
              <div className="space-y-2">
                <Label>Cartão vinculado</Label>
                <Select
                  value={editingTx.cardId || ""}
                  onValueChange={(id) => {
                    const card = paymentCards.find((c) => c.id === id);
                    if (!card) return;
                    setEditingTx({
                      ...editingTx,
                      cardId: card.id,
                      cardLabel: `${card.bankName} •••• ${card.last4}`,
                      cardType: editingTx.paymentMethod === "credit_card" || editingTx.paymentMethod === "debit_card" ? editingTx.paymentMethod : undefined,
                    });
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione um cartão" /></SelectTrigger>
                  <SelectContent>
                    {paymentCards.length === 0 ? (
                      <SelectItem value="__none" disabled>Nenhum cartão cadastrado</SelectItem>
                    ) : (
                      paymentCards.map((card) => (
                        <SelectItem key={card.id} value={card.id}>{card.bankName} •••• {card.last4}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={editingTx.date} onChange={(e) => setEditingTx({ ...editingTx, date: e.target.value })} />
              </div>
              {showDueDate && (
                <div className="space-y-2">
                  <Label>Vencimento</Label>
                  <Input type="date" value={editingTx.dueDate} onChange={(e) => setEditingTx({ ...editingTx, dueDate: e.target.value })} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <Button variant="outline" onClick={() => save(false)} disabled={saving}>
                <Save className="mr-2 h-4 w-4" /> Salvar Apenas Esta
              </Button>
              <Button onClick={() => save(Boolean(editingTx.groupId))} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
                <Save className="mr-2 h-4 w-4" /> {editingTx.groupId ? "Salvar Todas" : "Salvar Alterações"}
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Button variant="destructive" onClick={() => remove(false)} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir Esta
              </Button>
              {editingTx.groupId && (
                <Button variant="destructive" onClick={() => remove(true)} disabled={deleting} className="bg-red-700 hover:bg-red-800">
                  <Trash2 className="mr-2 h-4 w-4" /> Excluir Todas
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
