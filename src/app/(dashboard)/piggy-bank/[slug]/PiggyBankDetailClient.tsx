"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, Pencil, PiggyBank as PiggyBankIcon, Trash2, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { useTranslations } from "@/i18n/T";
import { useFormatters } from "@/i18n/useFormatters";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/money";
import { getCurrencySymbol } from "@/lib/money/formatMoney";
import { adjustPiggyBankBalance, deletePiggyBank, getPiggyBankBySlug, updatePiggyBank } from "@/services/piggyBankService";
import { PiggyBankDetail } from "@/types/piggyBank";

const HISTORY_PAGE_SIZE = 10;

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

export function PiggyBankDetailClient() {
  const t = useTranslations("piggyBank.detail");
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = String(params?.slug || "");

  const [detail, setDetail] = useState<PiggyBankDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [adjustDirection, setAdjustDirection] = useState<"deposit" | "withdraw">("deposit");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustSourceType, setAdjustSourceType] = useState<"bank" | "cash">("bank");
  const [editName, setEditName] = useState("");
  const [editWithdrawalMode, setEditWithdrawalMode] = useState("");
  const [editYieldType, setEditYieldType] = useState("");
  const currency = usePreferredCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { date, money } = useFormatters(currency);
  const moneyPlaceholder = `${getCurrencySymbol(currency)} 0,00`;

  const getPiggyErrorMessage = useCallback((message?: string | null) => {
    if (!message) return t("errors.load");
    if (message === "piggy_bank_not_found") return t("errors.notFound");
    return message;
  }, [t]);

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "-";
    return date(parsed, { dateStyle: "short", timeStyle: "short" });
  };

  useEffect(() => {
    if (!slug) return;
    let mounted = true;
    void (async () => {
      setHistoryLoading(true);
      setError(null);
      try {
        const data = await getPiggyBankBySlug(slug, {
          historyPage,
          historyLimit: HISTORY_PAGE_SIZE,
        });
        if (!mounted) return;
        setDetail(data);
        setEditName(data.name);
        setEditWithdrawalMode(data.withdrawalMode || "");
        setEditYieldType(data.yieldType || "");
      } catch (err) {
        if (!mounted) return;
        setError(getPiggyErrorMessage(err instanceof Error ? err.message : null));
      } finally {
        if (mounted) {
          setLoading(false);
          setHistoryLoading(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [getPiggyErrorMessage, historyPage, slug]);

  const totalEntries = useMemo(
    () => detail?.historyPagination?.total ?? detail?.history.length ?? 0,
    [detail],
  );
  const totalHistoryPages = detail?.historyPagination?.totalPages || 1;
  const parsedAdjustAmount = useMemo(() => parseCurrencyInput(adjustAmount), [adjustAmount]);

  const handleBack = () => {
    window.location.assign("/piggy-bank");
  };

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
      setHistoryPage(1);
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
      setHistoryPage(1);
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

  if (!detail) {
    return (
      <div className="min-h-[70vh] bg-transparent p-3 sm:p-6 md:p-8">
        <div className="mx-auto flex min-h-[55vh] max-w-5xl items-center justify-center">
          <Card className="w-full max-w-md rounded-3xl border border-red-200 bg-card shadow-sm">
            <CardContent className="flex min-h-56 flex-col items-center justify-center gap-4 p-8 text-center">
              <PiggyBankIcon className="h-10 w-10 text-red-500" />
              <div className="space-y-2">
                <p className="text-lg font-semibold text-foreground">{t("unavailable.title")}</p>
                <p className="text-sm text-red-600">{error || t("errors.notFound")}</p>
              </div>
              <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={handleBack}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                {t("actions.back")}
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
            <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={handleBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("actions.back")}
          </Button>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t("summary.title")}</CardTitle>
              <CardDescription>{t("summary.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="financial-value text-2xl font-bold text-emerald-600 sm:text-3xl">{money(detail.totalSaved)}</p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("fields.withdrawal")}</p>
                  <p className="mt-2 font-semibold text-foreground">{detail.withdrawalMode || t("fields.notProvided")}</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t("fields.yield")}</p>
                  <p className="mt-2 font-semibold text-foreground">{detail.yieldType || t("fields.notProvided")}</p>
                </div>
              </div>

              <div className="flex flex-col gap-3 border-t border-border/70 pt-4">
                <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={() => setIsAdjustOpen(true)}>
                  <WalletCards className="mr-2 h-4 w-4" />
                  {t("actions.adjust")}
                </Button>
                <Button variant="outline" className="rounded-xl border-border/70 bg-card" onClick={() => setIsEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("actions.edit")}
                </Button>
                <Button variant="destructive" className="rounded-xl" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("actions.delete")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl border border-border/70 bg-card shadow-sm">
            <CardHeader>
              <CardTitle>{t("history.title")}</CardTitle>
              <CardDescription>{t("history.count", { count: totalEntries })}</CardDescription>
            </CardHeader>
            <CardContent
              className={`space-y-3 transition-opacity ${historyLoading ? "opacity-60" : "opacity-100"}`}
              aria-busy={historyLoading}
            >
              {detail.history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-background/70 p-5 text-sm text-muted-foreground">
                  {t("history.empty")}
                </div>
              ) : (
                detail.history.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="financial-value font-semibold text-foreground">{money(entry.amount)}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span>{t("history.source", { source: entry.sourceType === "cash" ? t("source.cash") : t("source.bank") })}</span>
                      {entry.withdrawalMode && <span>{t("history.withdrawal", { value: entry.withdrawalMode })}</span>}
                      {entry.yieldType && <span>{t("history.yield", { value: entry.yieldType })}</span>}
                      {entry.appliedToCardLimit && <span>{t("history.appliedToCardLimit")}</span>}
                      {entry.cardLabel && <span>{t("history.card", { card: entry.cardLabel })}</span>}
                    </div>
                  </div>
                ))
              )}

              {totalHistoryPages > 1 ? (
                <div className="flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">
                    {t("history.pageSummary", {
                      page: detail.historyPagination.page,
                      totalPages: totalHistoryPages,
                      total: totalEntries,
                    })}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={historyLoading || historyPage <= 1}
                      onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      {t("history.previous")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={historyLoading || historyPage >= totalHistoryPages}
                      onClick={() => setHistoryPage((current) => Math.min(totalHistoryPages, current + 1))}
                    >
                      {t("history.next")}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>{t("adjust.title")}</DialogTitle>
              <DialogDescription>{t("adjust.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("adjust.typeLabel")}</Label>
                <Select value={adjustDirection} onValueChange={(value) => setAdjustDirection(value as "deposit" | "withdraw")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">{t("adjust.deposit")}</SelectItem>
                    <SelectItem value="withdraw">{t("adjust.withdraw")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("adjust.amountLabel")}</Label>
                <Input value={adjustAmount} onChange={(e) => setAdjustAmount(formatCurrencyInput(e.target.value))} placeholder={moneyPlaceholder} inputMode="decimal" />
                {adjustDirection === "withdraw" && (
                  <p className="text-xs text-muted-foreground">{t("adjust.availableToWithdraw", { amount: money(detail.totalSaved) })}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("adjust.sourceLabel")}</Label>
                <Select value={adjustSourceType} onValueChange={(value) => setAdjustSourceType(value as "bank" | "cash")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank">{t("source.bank")}</SelectItem>
                    <SelectItem value="cash">{t("source.cash")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsAdjustOpen(false)}>{t("actions.cancel")}</Button>
              <Button onClick={handleAdjust} disabled={isSubmitting || parsedAdjustAmount <= 0 || (adjustDirection === "withdraw" && parsedAdjustAmount > detail.totalSaved)}>
                {isSubmitting ? t("actions.saving") : t("adjust.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>{t("edit.title")}</DialogTitle>
              <DialogDescription>{t("edit.description")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("edit.nameLabel")}</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>{t("edit.withdrawalModeLabel")}</Label>
                <Input value={editWithdrawalMode} onChange={(e) => setEditWithdrawalMode(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>{t("edit.yieldTypeLabel")}</Label>
                <Input value={editYieldType} onChange={(e) => setEditYieldType(e.target.value)} maxLength={120} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsEditOpen(false)}>{t("actions.cancel")}</Button>
              <Button onClick={handleEdit} disabled={isSubmitting || !editName.trim()}>
                {isSubmitting ? t("actions.saving") : t("edit.save")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="rounded-2xl border border-border/70 bg-card">
            <DialogHeader>
              <DialogTitle>{t("delete.title")}</DialogTitle>
              <DialogDescription>{t("delete.description")}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>{t("actions.cancel")}</Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                {isSubmitting ? t("actions.deleting") : t("delete.confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
