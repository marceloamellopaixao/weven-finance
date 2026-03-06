"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PiggyBankDetail } from "@/types/piggyBank";
import { getPiggyBankBySlug } from "@/services/piggyBankService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, PiggyBank as PiggyBankIcon } from "lucide-react";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
};

export default function PiggyBankDetailPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = String(params?.slug || "");

  const [detail, setDetail] = useState<PiggyBankDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Não foi possível carregar o porquinho.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [slug]);

  const totalEntries = useMemo(() => detail?.history.length || 0, [detail]);

  if (loading) {
    return <div className="p-6 text-sm text-zinc-500">Carregando porquinho...</div>;
  }

  if (error || !detail) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-red-600">{error || "Porquinho não encontrado."}</p>
        <Button variant="outline" onClick={() => router.push("/porquinho")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/40 p-3 sm:p-6 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-zinc-900 flex items-center gap-2">
              <PiggyBankIcon className="h-7 w-7 text-violet-600" />
              {detail.name}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">Acompanhamento de total guardado e histórico do porquinho.</p>
          </div>
          <Link href="/porquinho">
            <Button variant="outline" className="rounded-xl">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Voltar
            </Button>
          </Link>
        </div>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Total Guardado</CardTitle>
            <CardDescription>Resumo atual do porquinho selecionado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-3xl font-bold text-emerald-600">{formatCurrency(detail.totalSaved)}</p>
            {detail.withdrawalMode && <p className="text-sm text-zinc-600">Modalidade de Retirada: {detail.withdrawalMode}</p>}
            {detail.yieldType && <p className="text-sm text-zinc-600">Tipo de Rendimento: {detail.yieldType}</p>}
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
                  <div className="mt-2 text-xs text-zinc-600 flex flex-wrap gap-3">
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
      </div>
    </div>
  );
}
