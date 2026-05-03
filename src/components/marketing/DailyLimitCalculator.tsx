"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateDailyLimit } from "@/lib/finance/daily-limit";

const money = (value: number | null) =>
  value === null
    ? "R$ 0,00"
    : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseNumber = (value: string) => Number(value.replace(/\./g, "").replace(",", ".")) || 0;

export function DailyLimitCalculator() {
  const [balance, setBalance] = useState("1500");
  const [income, setIncome] = useState("0");
  const [bills, setBills] = useState("900");
  const [card, setCard] = useState("300");
  const [reserve, setReserve] = useState("100");

  const result = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return calculateDailyLimit({
      today,
      transactions: [
        { type: "income", amount: parseNumber(balance), status: "paid", dueDate: today, date: today, paymentMethod: "pix" },
        { type: "income", amount: parseNumber(income), status: "pending", dueDate: today, date: today, paymentMethod: "pix" },
        { type: "expense", amount: parseNumber(bills), status: "pending", dueDate: today, date: today, paymentMethod: "boleto" },
        { type: "expense", amount: parseNumber(card), amountForLimit: parseNumber(card), status: "pending", dueDate: today, date: today, paymentMethod: "credit_card" },
      ],
      goalReserve: parseNumber(reserve),
    });
  }, [balance, bills, card, income, reserve]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-5 shadow-xl shadow-primary/10 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ["Saldo atual", balance, setBalance],
            ["Receitas ainda previstas", income, setIncome],
            ["Contas e gastos fixos", bills, setBills],
            ["Fatura/cartao previsto", card, setCard],
            ["Valor que quer guardar", reserve, setReserve],
          ].map(([label, value, setter]) => (
            <div key={String(label)} className="space-y-2">
              <Label>{String(label)}</Label>
              <Input inputMode="decimal" value={String(value)} onChange={(event) => (setter as (next: string) => void)(event.target.value)} className="h-12 rounded-xl" />
            </div>
          ))}
        </div>
      </div>

      <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-6 shadow-xl shadow-primary/10">
        <Calculator className="h-8 w-8 text-primary" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Resultado estimado</p>
        <h2 className="mt-2 text-4xl font-bold">{money(result.amount)}</h2>
        <p className="mt-3 text-muted-foreground">
          Esse e o valor medio que voce poderia gastar por dia ate o fim do mes, considerando os dados informados.
        </p>
        <div className="mt-5 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          Previsao de fechamento: <strong className="text-foreground">{money(result.projectedEndBalance)}</strong>
        </div>
        <Button asChild className="mt-6 h-12 w-full rounded-full">
          <Link href="/register">Salvar no WevenFinance <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
