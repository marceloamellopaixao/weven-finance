"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calculator } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { calculateDailyLimit } from "@/lib/finance/daily-limit";
import { formatMoney, getDefaultCurrencyForLocale, parseMoneyInput } from "@/lib/money/formatMoney";

export function DailyLimitCalculator() {
  const { locale } = useI18n();
  const t = useTranslations("calculator.dailyLimit");
  const currency = getDefaultCurrencyForLocale(locale);
  const [balance, setBalance] = useState("1500");
  const [income, setIncome] = useState("0");
  const [bills, setBills] = useState("900");
  const [card, setCard] = useState("300");
  const [reserve, setReserve] = useState("100");

  const result = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const parseCurrency = (value: string) => parseMoneyInput(value, locale);

    return calculateDailyLimit({
      today,
      transactions: [
        { type: "income", amount: parseCurrency(balance), status: "paid", dueDate: today, date: today, paymentMethod: "pix" },
        { type: "income", amount: parseCurrency(income), status: "pending", dueDate: today, date: today, paymentMethod: "pix" },
        { type: "expense", amount: parseCurrency(bills), status: "pending", dueDate: today, date: today, paymentMethod: "boleto" },
        { type: "expense", amount: parseCurrency(card), amountForLimit: parseCurrency(card), status: "pending", dueDate: today, date: today, paymentMethod: "credit_card" },
      ],
      goalReserve: parseCurrency(reserve),
    });
  }, [balance, bills, card, income, reserve, locale]);

  const formatCurrency = (value: number | null) => formatMoney(value, currency, locale);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
      <div className="app-panel-soft rounded-3xl border border-color:var(--app-panel-border) p-5 shadow-xl shadow-primary/10 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            [t("fields.balance"), balance, setBalance],
            [t("fields.income"), income, setIncome],
            [t("fields.bills"), bills, setBills],
            [t("fields.card", { currency }), card, setCard],
            [t("fields.reserve"), reserve, setReserve],
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
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-primary">{t("resultLabel")}</p>
        <h2 className="mt-2 text-4xl font-bold">{formatCurrency(result.amount)}</h2>
        <p className="mt-3 text-muted-foreground">{t("resultDescription")}</p>
        <div className="mt-5 rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
          {t("projectedBalance")}: <strong className="text-foreground">{formatCurrency(result.projectedEndBalance)}</strong>
        </div>
        <Button asChild className="mt-6 h-12 w-full rounded-full">
          <Link href="/register">{t("saveCta")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
