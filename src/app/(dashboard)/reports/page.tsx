"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileSpreadsheet, FileText, Loader2, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { CategoryLabel } from "@/components/categories/CategoryLabel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { usePreferredCurrency } from "@/hooks/usePreferredCurrency";
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useTransactions } from "@/hooks/useTransactions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useI18n } from "@/i18n/I18nProvider";
import { useTranslations } from "@/i18n/T";
import { translateDefaultCategoryValue } from "@/lib/categories/defaultCategories";
import { buildMonthlyReport, formatPaymentMethodLabel, formatReportCurrency } from "@/lib/reports/monthlyReport";
import { exportMonthlyReportToExcel, exportMonthlyReportToPdf } from "@/services/reportExportService";
import type { Workspace } from "@/types/workspace";

const REPORT_COLORS = {
  primary: "#f8b600",
  income: "#059669",
  expense: "#dc2626",
  balance: "#2563eb",
};

const CHART_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be123c", "#4f46e5"];

function getMonthLabel(month: string, locale = "pt-BR") {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 2);
  const label = date.toLocaleDateString(locale, { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getTransactionTitle(transaction?: { title?: string; description?: string } | null) {
  return transaction?.title || transaction?.description || "-";
}

function getPaymentMethodTranslationKey(label: string) {
  const normalized = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const keys: Record<string, string> = {
    pix: "paymentMethods.Pix",
    boleto: "paymentMethods.Boleto",
    dinheiro: "paymentMethods.Dinheiro",
    transferencia: "paymentMethods.Transferencia",
    "cartao de debito": "paymentMethods.CartaoDebito",
    "cartao de credito": "paymentMethods.CartaoCredito",
    outro: "paymentMethods.Outro",
  };

  return keys[normalized] || "";
}

const DEFAULT_WORKSPACE_NAMES = new Set([
  "Minha vida financeira",
  "Meu trabalho",
  "Igreja / Ministério",
  "Família / Casa",
  "Meu negócio",
  "Pessoal",
  "Profissional / Autônomo",
  "Pequeno negócio",
]);

function isDefaultWorkspaceName(name?: string) {
  return Boolean(name && DEFAULT_WORKSPACE_NAMES.has(name));
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone?: "income" | "expense" | "neutral";
}) {
  const Icon = tone === "expense" ? TrendingDown : tone === "income" ? TrendingUp : Wallet;
  const toneColor =
    tone === "income" ? REPORT_COLORS.income : tone === "expense" ? REPORT_COLORS.expense : REPORT_COLORS.balance;

  return (
    <Card className="app-panel-soft rounded-xl">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{title}</p>
          <p className="financial-value mt-1 text-xl font-bold tracking-tight" style={{ color: toneColor }}>
            {value}
          </p>
        </div>
        <div className="rounded-lg p-2" style={{ backgroundColor: `${toneColor}18`, color: toneColor }}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const reportRef = useRef<HTMLDivElement>(null);
  const { locale } = useI18n();
  const currency = usePreferredCurrency();
  const t = useTranslations("reports");
  const { userProfile, privacyMode } = useAuth();
  const { transactions, loading: transactionsLoading } = useTransactions();
  const { workspaces, defaultWorkspace, loading: workspacesLoading } = useWorkspaces();
  const { status: onboardingStatus, loading: onboardingLoading, completeTour, isActive: isOnboardingActive } = useOnboarding();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("default");
  const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  usePlatformTour({
    route: "reports",
    disabled: onboardingLoading || isOnboardingActive,
    hasSeen: onboardingStatus.tourCompleted,
    onComplete: completeTour,
  });

  const workspaceOptions = useMemo(() => {
    const byId = new Map(workspaces.map((workspace) => [workspace.id, workspace]));
    return Array.from(byId.values());
  }, [workspaces]);

  useEffect(() => {
    if (selectedWorkspaceId !== "default") return;
    if (defaultWorkspace?.id) setSelectedWorkspaceId(defaultWorkspace.id);
  }, [defaultWorkspace?.id, selectedWorkspaceId]);

  const selectedWorkspace = useMemo(() => {
    if (selectedWorkspaceId === "default") return defaultWorkspace;
    return workspaceOptions.find((workspace) => workspace.id === selectedWorkspaceId) || defaultWorkspace;
  }, [defaultWorkspace, selectedWorkspaceId, workspaceOptions]);

  const availableMonths = useMemo(() => {
    const months = new Set<string>([new Date().toISOString().slice(0, 7)]);
    transactions.forEach((transaction) => {
      if (transaction.dueDate) months.add(transaction.dueDate.slice(0, 7));
    });
    return Array.from(months).sort().reverse();
  }, [transactions]);

  const report = useMemo(() => buildMonthlyReport(transactions, selectedMonth), [selectedMonth, transactions]);
  const loading = transactionsLoading || workspacesLoading;
  const money = (value: number) => formatReportCurrency(value, locale, currency);
  const translatedCategoryExpenses = report.categoryExpenses.map((item) => ({ ...item, name: translateDefaultCategoryValue(item.name, locale) }));
  const translatedCategoryIncomes = report.categoryIncomes.map((item) => ({ ...item, name: translateDefaultCategoryValue(item.name, locale) }));
  const translatedPaymentMethods = report.paymentMethods.map((item) => {
    const key = getPaymentMethodTranslationKey(item.name);
    return { ...item, name: key ? t(key) : item.name };
  });
  const getWorkspaceDisplayName = (workspace?: Workspace | null) => {
    if (!workspace) return t("filters.personal");
    if (isDefaultWorkspaceName(workspace.name)) return t(`workspaces.${workspace.type}`);
    return workspace.name;
  };

  const incomeExpenseData = [
    { name: t("stats.income"), value: report.totals.income },
    { name: t("stats.expenses"), value: report.totals.expense },
  ];

  const privacyConfirm = () => {
    if (!privacyMode) return true;
    return window.confirm(t("privacy.exportConfirm"));
  };

  const handlePdf = async () => {
    if (!reportRef.current || !privacyConfirm()) return;
    setExporting("pdf");
    setExportError(null);
    try {
      await exportMonthlyReportToPdf(report, {
        element: reportRef.current,
        userName: userProfile?.displayName,
        workspaceName: getWorkspaceDisplayName(selectedWorkspace),
        locale,
        currency,
        t,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t("errors.pdfExport"));
    } finally {
      setExporting(null);
    }
  };

  const handleExcel = async () => {
    if (!privacyConfirm()) return;
    setExporting("excel");
    setExportError(null);
    try {
      await exportMonthlyReportToExcel(report, {
        workspaceName: getWorkspaceDisplayName(selectedWorkspace),
        userName: userProfile?.displayName,
        locale,
        currency,
        t,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : t("errors.excelExport"));
    } finally {
      setExporting(null);
    }
  };

  const legendFormatter = (value: string) => <span className="text-xs text-muted-foreground">{value}</span>;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 pb-32 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary">
                {t("header.eyebrow")}
              </p>
              <h1 id="tour-reports-header" className="text-3xl font-bold tracking-tight sm:text-4xl">{t("header.title")}</h1>
            </div>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            {t("header.description")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
          <div className="space-y-2">
            <Label htmlFor="report-month">{t("filters.month")}</Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="report-month" className="h-11 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((month) => (
                  <SelectItem key={month} value={month}>
                    {getMonthLabel(month, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="report-workspace">{t("filters.accountType")}</Label>
            <Select value={selectedWorkspace?.id || "default"} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="report-workspace" className="h-11 rounded-xl">
                <SelectValue placeholder={t("filters.personal")} />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.length === 0 ? (
                  <SelectItem value="default">{getWorkspaceDisplayName(defaultWorkspace)}</SelectItem>
                ) : null}
                {workspaceOptions.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {getWorkspaceDisplayName(workspace)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {getWorkspaceDisplayName(selectedWorkspace) || "WevenFinance"} - {getMonthLabel(selectedMonth, locale)}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button id="tour-reports-export" variant="outline" className="h-11 rounded-xl" onClick={handleExcel} disabled={loading || exporting !== null}>
            {exporting === "excel" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileSpreadsheet className="mr-2 h-4 w-4" />}
            Excel
          </Button>
          <Button className="h-11 rounded-xl" onClick={handlePdf} disabled={loading || exporting !== null}>
            {exporting === "pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>

      {exportError ? (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {exportError}
        </div>
      ) : null}

      <section ref={reportRef} className="space-y-6 bg-background p-1">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard title={t("stats.income")} value={money(report.totals.income)} tone="income" />
          <StatCard title={t("stats.expenses")} value={money(report.totals.expense)} tone="expense" />
          <StatCard title={t("stats.monthBalance")} value={money(report.totals.balance)} tone="neutral" />
          <StatCard title={t("stats.transactions")} value={String(report.highlights.transactionCount)} tone="neutral" />
          <StatCard title={t("stats.paidExpenses")} value={money(report.totals.paidExpense)} tone="expense" />
          <StatCard title={t("stats.pendingExpenses")} value={money(report.totals.pendingExpense)} tone="expense" />
          <StatCard title={t("stats.receivedIncome")} value={money(report.totals.paidIncome)} tone="income" />
          <StatCard title={t("stats.pendingIncome")} value={money(report.totals.pendingIncome)} tone="income" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card id="tour-reports-summary-chart" className="app-panel-subtle rounded-xl lg:col-span-2">
            <CardHeader>
              <CardTitle>{t("charts.incomeVsExpenses")}</CardTitle>
              <CardDescription>{t("charts.selectedMonthComparison")}</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => money(Number(value))} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {incomeExpenseData.map((entry, index) => (
                      <Cell key={entry.name} fill={index === 0 ? REPORT_COLORS.income : REPORT_COLORS.expense} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="app-panel-subtle rounded-xl">
            <CardHeader>
              <CardTitle>{t("highlights.title")}</CardTitle>
              <CardDescription>{t("highlights.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold">{t("highlights.topExpenseCategory")}</p>
                <p className="text-muted-foreground">
                  {report.highlights.topExpenseCategory
                    ? `${translateDefaultCategoryValue(report.highlights.topExpenseCategory.name, locale)} - ${money(report.highlights.topExpenseCategory.value)}`
                    : t("highlights.noExpenses")}
                </p>
              </div>
              <div>
                <p className="font-semibold">{t("highlights.largestTransaction")}</p>
                <p className="text-muted-foreground">
                  {report.highlights.largestTransaction
                    ? `${getTransactionTitle(report.highlights.largestTransaction)} - ${money(report.highlights.largestTransaction.amount)}`
                    : t("highlights.noTransactions")}
                </p>
              </div>
              <div>
                <p className="font-semibold">{t("highlights.previousMonthVariation")}</p>
                <p className="text-muted-foreground">
                  {report.comparison
                    ? `${t("stats.balance")} ${money(report.comparison.balanceChange)}`
                    : t("highlights.insufficientComparisonData")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card className="app-panel-soft rounded-xl">
            <CardContent className="flex min-h-[220px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("states.loading")}
            </CardContent>
          </Card>
        ) : report.transactions.length === 0 ? (
          <Card className="app-panel-soft rounded-xl">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <Download className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{t("states.emptyTitle")}</p>
                <p className="text-sm text-muted-foreground">{t("states.emptyDescription")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card id="tour-reports-categories" className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{t("charts.expensesByCategory")}</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={translatedCategoryExpenses} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={2}>
                        {translatedCategoryExpenses.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, name) => [money(Number(value)), String(name)]} />
                      <Legend formatter={legendFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{t("charts.incomeByCategory")}</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={translatedCategoryIncomes} dataKey="value" nameKey="name" innerRadius={58} outerRadius={98} paddingAngle={2}>
                        {translatedCategoryIncomes.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(value, name) => [money(Number(value)), String(name)]} />
                      <Legend formatter={legendFormatter} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{t("charts.dailyEvolution")}</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.dailyEvolution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => money(Number(value))} />
                      <Area type="monotone" dataKey="income" stackId="1" stroke={REPORT_COLORS.income} fill={REPORT_COLORS.income} fillOpacity={0.25} name={t("stats.income")} />
                      <Area type="monotone" dataKey="expense" stackId="2" stroke={REPORT_COLORS.expense} fill={REPORT_COLORS.expense} fillOpacity={0.2} name={t("stats.expenses")} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{t("charts.paymentMethods")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {translatedPaymentMethods.map((method, index) => (
                    <div key={method.name} className="rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                        <span>{method.name}</span>
                        <span>{money(method.value)}</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, method.percentage)}%`,
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t("charts.monthVolumePercentage", { percentage: method.percentage })}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="app-panel-subtle rounded-xl">
              <CardHeader>
                <CardTitle>{t("table.title")}</CardTitle>
                <CardDescription>{t("table.description")}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">{t("table.date")}</th>
                      <th className="py-3 pr-4">{t("table.type")}</th>
                      <th className="py-3 pr-4">{t("table.category")}</th>
                      <th className="py-3 pr-4">{t("table.descriptionColumn")}</th>
                      <th className="py-3 pr-4">{t("table.method")}</th>
                      <th className="py-3 pr-4">{t("table.status")}</th>
                      <th className="py-3 text-right">{t("table.amount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.map((transaction) => (
                      <tr key={transaction.id || `${transaction.dueDate}-${transaction.description}`} className="border-b last:border-0 hover:bg-muted/80">
                        <td className="py-3 pr-4">{transaction.dueDate}</td>
                        <td className="py-3 pr-4">{transaction.type === "income" ? t("table.income") : t("table.expense")}</td>
                        <td className="py-3 pr-4">
                          <CategoryLabel value={transaction.category} className="max-w-52 gap-1.5" iconClassName="h-3 w-3" />
                        </td>
                        <td className="py-3 pr-4">{getTransactionTitle(transaction)}</td>
                        <td className="py-3 pr-4">{(getPaymentMethodTranslationKey(formatPaymentMethodLabel(transaction.paymentMethod)) ? t(getPaymentMethodTranslationKey(formatPaymentMethodLabel(transaction.paymentMethod))) : formatPaymentMethodLabel(transaction.paymentMethod))}</td>
                        <td className="py-3 pr-4">{transaction.status === "paid" ? t("table.paid") : t("table.pending")}</td>
                        <td
                          className="financial-value py-3 text-right font-semibold"
                          style={{ color: transaction.type === "income" ? REPORT_COLORS.income : REPORT_COLORS.expense }}
                        >
                          {money(transaction.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </>
        )}
      </section>
    </main>
  );
}
