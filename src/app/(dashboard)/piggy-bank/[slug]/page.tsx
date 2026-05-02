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
  if (!message) return "Não foi possível carregar a meta.";
  if (message === "piggy_bank_not_found") return "Essa meta não existe mais ou foi removida.";
  return message;
};

function PiggyDetailSkeleton() {
  return (
    <div className="min-h-[70vh] bg-transparent p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl animate-pulse space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <div className="h-8 w-56 rounded-2xl bg-primary/12" />
            <div className="h-4 w-72 rounded-xl bg-muted" />
          </div>
          <div className="h-10 w-32 rounded-xl bg-muted" />
        </div>

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="h-6 w-40 rounded-xl bg-muted" />
            <div className="mt-5 h-10 w-44 rounded-xl bg-muted" />
            <div className="mt-5 space-y-3">
              <div className="h-16 rounded-2xl bg-muted" />
              <div className="h-16 rounded-2xl bg-muted" />
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-card p-6 shadow-sm">
            <div className="h-6 w-28 rounded-xl bg-muted" />
            <div className="mt-5 space-y-3">
              {[0, 1, 2].map((item) => (
                <div key={item} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <div className="h-4 w-24 rounded-xl bg-muted" />
                  <div className="mt-3 h-3 w-44 rounded-xl bg-muted" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const parsedAdjustAmount = useMemo(() => parseCurrencyInput(adjustAmount), [adjustAmount]);

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
      router.push("/piggy-bank");
    } catch (err) {
      setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <PiggyDetailSkeleton />;
  }

  if (error || !detail) {
    return (
      <div className="min-h-[70vh] bg-transparent p-3 sm:p-6 md:p-8">
        <div className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-md rounded-3xl border border-red-200 bg-card shadow-sm">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
              <PiggyBankIcon className="h-10 w-10 text-red-500" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">Meta indisponível</p>
                <p className="text-sm text-red-600">{error || "Meta não encontrada."}</p>
              </div>
              <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={() => router.push("/piggy-bank")}>
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
    <div className="min-h-screen bg-transparent p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground md:text-3xl">
              <PiggyBankIcon className="h-7 w-7 text-primary" />
              {detail.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Acompanhamento do total guardado e do histórico desta meta.</p>
          </div>
          <Link href="/piggy-bank">
            <Button variant="outline" className="rounded-xl border-border/70 bg-card">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Total guardado</CardTitle>
              <CardDescription>Resumo atual desta meta.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="financial-value text-2xl font-bold text-emerald-600 sm:text-3xl">{formatCurrency(detail.totalSaved)}</p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Retirada</p>
                  <p className="mt-2 font-semibold text-foreground">{detail.withdrawalMode || "Não informado"}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Rendimento</p>
                  <p className="mt-2 font-semibold text-foreground">{detail.yieldType || "Não informado"}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
                <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={() => setIsAdjustOpen(true)}>
                  <WalletCards className="mr-2 h-4 w-4" />
                  Adicionar ou retirar valor
                </Button>
                <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar meta
                </Button>
                <Button variant="destructive" className="rounded-xl" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>Historico</CardTitle>
              <CardDescription>{totalEntries} movimentação(ões) registrada(s).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {detail.history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
                  Ainda não há movimentações nesta meta.
                </div>
              ) : (
                detail.history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="financial-value font-semibold text-foreground">{formatCurrency(entry.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>Origem: {entry.sourceType === "cash" ? "Dinheiro vivo" : "Saldo em banco"}</span>
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
        </div>

        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>Ajustar saldo da meta</DialogTitle>
              <DialogDescription>Adicione mais valor ou retire parte do total guardado.</DialogDescription>
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
                  <p className="text-xs text-muted-foreground">Saldo disponível para retirada: {formatCurrency(detail.totalSaved)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Origem ou destino</Label>
                <Select value={adjustSourceType} onValueChange={(value) => setAdjustSourceType(value as "bank" | "cash")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">Saldo em banco</SelectItem>
                    <SelectItem value="cash">Dinheiro vivo</SelectItem>
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
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>Editar meta</DialogTitle>
              <DialogDescription>Atualize o nome e as informações complementares desta reserva.</DialogDescription>
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
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>Excluir meta</DialogTitle>
              <DialogDescription>
                Essa ação remove a meta, o histórico dela e desfaz vínculos aplicados, como aumento de limite em cartão.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? "Excluindo..." : "Excluir meta"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
