"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { adjustPiggyBankBalance, deletePiggyBank, getPiggyBankBySlug, updatePiggyBank } from "@/services/piggyBankService";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { PiggyBankDetail } from "@/types/piggyBank";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Pencil, PiggyBank as PiggyBankIcon, Trash2, WalletCards } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

const getPiggyErrorMessage = (message?: string | null) => {
  if (!message) return "Não foi possível carregar o porquinho.";
  if (message === "piggy_bank_not_found") return "Esse porquinho não existe mais ou foi removido.";
  return message;
};

export default function PiggyBankDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = String(params?.slug || "");

  const [detail, setDetail] = useState<PiggyBankDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<"deposit" | "withdraw">("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustSourceType, setAdjustSourceType] = useState<"bank" | "cash">("bank");
  const [editName, setEditName] = useState("");
  const [editWithdrawalMode, setEditWithdrawalMode] = useState("");
  const [editYieldType, setEditYieldType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPiggyBankBySlug(slug);
        if (!mounted) return;
        setDetail(data);
        setEditName(data.name);
        setEditWithdrawalMode(data.withdrawalMode || "");
        setEditYieldType(data.yieldType || "");
      } catch (err) {
        if (!mounted) return;
        setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const totalEntries = useMemo(() => detail?.history.length || 0, [detail]);
  const parsedAdjustAmount = useMemo(() => {
    return parseCurrencyInput(adjustAmount);
  }, [adjustAmount]);

  const handleEdit = async () => {
    if (!detail) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await updatePiggyBank(detail.slug, {
        name: editName,
        withdrawalMode: editWithdrawalMode,
        yieldType: editYieldType,
      });
      setDetail(updated);
      setIsEditOpen(false);
    } catch (err) {
      setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjust = async () => {
    if (!detail || parsedAdjustAmount <= 0) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await adjustPiggyBankBalance(detail.slug, {
        amount: parsedAdjustAmount,
        direction: adjustDirection,
        sourceType: adjustSourceType,
      });
      setDetail(updated);
      setAdjustAmount("");
      setAdjustDirection("deposit");
      setAdjustSourceType("bank");
      setIsAdjustOpen(false);
    } catch (err) {
      setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await deletePiggyBank(detail.slug);
      router.push("/porquinho");
    } catch (err) {
      setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] bg-zinc-50/40 p-3 sm:p-6 md:p-8">
        <div className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-md rounded-3xl border-zinc-200">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-3 p-8 text-center">
              <PiggyBankIcon className="h-10 w-10 text-violet-600" />
              <p className="text-base font-semibold text-zinc-900">Carregando porquinho</p>
              <p className="text-sm text-zinc-500">Buscando os dados e o histórico deste objetivo.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-[70vh] bg-zinc-50/40 p-3 sm:p-6 md:p-8">
        <div className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-md rounded-3xl border-red-200 bg-white">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
              <PiggyBankIcon className="h-10 w-10 text-red-500" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-zinc-900">Porquinho indisponível</p>
                <p className="text-sm text-red-600">{error || "Porquinho não encontrado."}</p>
              </div>
              <Button variant="outline" className="rounded-xl" onClick={() => router.push("/porquinho")}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Voltar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/40 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-violet-600" />
              {detail.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500">Acompanhamento do total guardado e do histórico deste porquinho.</p>
          </div>
          <Link href="/porquinho">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" className="rounded-xl" onClick={() => setIsAdjustOpen(true)}>
            <WalletCards className="mr-2 h-4 w-4" />
            Adicionar ou Retirar Valor
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => setIsEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar Porquinho
          </Button>
          <Button variant="destructive" className="rounded-xl" onClick={() => setIsDeleteOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Total Guardado</CardTitle>
            <CardDescription>Resumo atual do porquinho selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-emerald-600">{formatCurrency(detail.totalSaved)}</p>
            {detail.withdrawalMode && <p className="text-sm text-zinc-600">Modalidade de retirada: {detail.withdrawalMode}</p>}
            {detail.yieldType && <p className="text-sm text-zinc-600">Tipo de rendimento: {detail.yieldType}</p>}
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Histórico</CardTitle>
            <CardDescription>{totalEntries} movimentação(ões) registrada(s).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.history.length === 0 ? (
              <p className="text-sm text-zinc-500">Ainda não há movimentações neste porquinho.</p>
            ) : (
              detail.history.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-zinc-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-zinc-900">{formatCurrency(entry.amount)}</p>
                    <p className="text-xs text-zinc-500">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-600">
                    <span>Origem: {entry.sourceType === "cash" ? "Dinheiro Vivo" : "Saldo em Banco"}</span>
                    {entry.withdrawalMode && <span>Retirada: {entry.withdrawalMode}</span>}
                    {entry.yieldType && <span>Rendimento: {entry.yieldType}</span>}
                    {entry.appliedToCardLimit && <span>Aplicado no limite do cartão</span>}
                    {entry.cardLabel && <span>Cartão: {entry.cardLabel}</span>}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Ajustar saldo do porquinho</DialogTitle>
              <DialogDescription>Você pode adicionar mais valor ou retirar parte do saldo guardado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de ajuste</Label>
                <Select value={adjustDirection} onValueChange={(value) => setAdjustDirection(value as "deposit" | "withdraw")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Adicionar valor</SelectItem>
                    <SelectItem value="withdraw">Retirar valor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input value={adjustAmount} onChange={(e) => setAdjustAmount(formatCurrencyInput(e.target.value))} placeholder="R$ 0,00" inputMode="decimal" />
                {adjustDirection === "withdraw" && (
                  <p className="text-xs text-zinc-500">Saldo disponível para retirada: {formatCurrency(detail.totalSaved)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Origem/Destino</Label>
                <Select value={adjustSourceType} onValueChange={(value) => setAdjustSourceType(value as "bank" | "cash")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Saldo em Banco</SelectItem>
                    <SelectItem value="cash">Dinheiro Vivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAdjustOpen(false)}>Cancelar</Button>
              <Button onClick={handleAdjust} disabled={isSubmitting || parsedAdjustAmount <= 0 || (adjustDirection === "withdraw" && parsedAdjustAmount > detail.totalSaved)}>
                {isSubmitting ? "Salvando..." : "Confirmar ajuste"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Editar porquinho</DialogTitle>
              <DialogDescription>Atualize o nome e as informações complementares deste porquinho.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>Modalidade de retirada</Label>
                <Input value={editWithdrawalMode} onChange={(e) => setEditWithdrawalMode(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Tipo de rendimento</Label>
                <Input value={editYieldType} onChange={(e) => setEditYieldType(e.target.value)} maxLength={120} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button onClick={handleEdit} disabled={isSubmitting || !editName.trim()}>
                {isSubmitting ? "Salvando..." : "Salvar alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="rounded-2xl">
            <DialogHeader>
              <DialogTitle>Excluir porquinho</DialogTitle>
              <DialogDescription>
                Essa ação remove o porquinho, o histórico dele e desfaz vínculos aplicados, como aumento de limite em cartão.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? "Excluindo..." : "Excluir porquinho"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
