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
import { usePlatformTour } from "@/hooks/usePlatformTour";
import { useTransactions } from "@/hooks/useTransactions";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useI18n } from "@/i18n/I18nProvider";
import { useUiText } from "@/i18n/T";
import { translateDefaultCategoryValue } from "@/lib/categories/defaultCategories";
import { buildMonthlyReport, formatPaymentMethodLabel, formatReportCurrency } from "@/lib/reports/monthlyReport";
import { exportMonthlyReportToExcel, exportMonthlyReportToPdf } from "@/services/reportExportService";

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
  const tt = useUiText();
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
  const money = (value: number) => formatReportCurrency(value, locale);
  const translatedCategoryExpenses = report.categoryExpenses.map((item) => ({ ...item, name: translateDefaultCategoryValue(item.name, locale) }));
  const translatedCategoryIncomes = report.categoryIncomes.map((item) => ({ ...item, name: translateDefaultCategoryValue(item.name, locale) }));
  const translatedPaymentMethods = report.paymentMethods.map((item) => ({ ...item, name: tt(item.name) }));

  const incomeExpenseData = [
    { name: tt("Receitas"), value: report.totals.income },
    { name: tt("Despesas"), value: report.totals.expense },
  ];

  const privacyConfirm = () => {
    if (!privacyMode) return true;
    return window.confirm(tt("O modo privacidade está ativo. A exportação vai incluir valores reais no arquivo. Deseja continuar?"));
  };

  const handlePdf = async () => {
    if (!reportRef.current || !privacyConfirm()) return;
    setExporting("pdf");
    setExportError(null);
    try {
      await exportMonthlyReportToPdf(report, {
        element: reportRef.current,
        workspaceName: selectedWorkspace?.name,
        userName: userProfile?.displayName,
        locale,
        t: tt,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : tt("Não foi possível exportar PDF"));
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
        workspaceName: selectedWorkspace?.name,
        userName: userProfile?.displayName,
        locale,
        t: tt,
      });
    } catch (error) {
      setExportError(error instanceof Error ? error.message : tt("Não foi possível exportar Excel"));
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
                {tt("Relatórios")}
              </p>
              <h1 id="tour-reports-header" className="text-3xl font-bold tracking-tight sm:text-4xl">{tt("Relatório financeiro mensal")}</h1>
            </div>
          </div>
          <p className="max-w-2xl text-muted-foreground">
            {tt("Resumo do mês, gráficos e exportação profissional em PDF ou Excel.")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
          <div className="space-y-2">
            <Label htmlFor="report-month">{tt("Mês")}</Label>
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
            <Label htmlFor="report-workspace">{tt("Tipo da conta")}</Label>
            <Select value={selectedWorkspace?.id || "default"} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger id="report-workspace" className="h-11 rounded-xl">
                <SelectValue placeholder={tt("Pessoal")} />
              </SelectTrigger>
              <SelectContent>
                {workspaceOptions.length === 0 ? (
                  <SelectItem value="default">{defaultWorkspace?.name || tt("Pessoal")}</SelectItem>
                ) : null}
                {workspaceOptions.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedWorkspace?.name || "WevenFinance"} - {getMonthLabel(selectedMonth, locale)}
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
          <StatCard title={tt("Receitas")} value={money(report.totals.income)} tone="income" />
          <StatCard title={tt("Despesas")} value={money(report.totals.expense)} tone="expense" />
          <StatCard title={tt("Saldo do mês")} value={money(report.totals.balance)} tone="neutral" />
          <StatCard title={tt("Lançamentos")} value={String(report.highlights.transactionCount)} tone="neutral" />
          <StatCard title={tt("Despesas pagas")} value={money(report.totals.paidExpense)} tone="expense" />
          <StatCard title={tt("Despesas pendentes")} value={money(report.totals.pendingExpense)} tone="expense" />
          <StatCard title={tt("Receitas recebidas")} value={money(report.totals.paidIncome)} tone="income" />
          <StatCard title={tt("Receitas pendentes")} value={money(report.totals.pendingIncome)} tone="income" />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card id="tour-reports-summary-chart" className="app-panel-subtle rounded-xl lg:col-span-2">
            <CardHeader>
              <CardTitle>{tt("Receitas x despesas")}</CardTitle>
              <CardDescription>{tt("Comparativo do mês selecionado")}</CardDescription>
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
              <CardTitle>{tt("Destaques")}</CardTitle>
              <CardDescription>{tt("Leituras rápidas do período")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold">{tt("Maior categoria de despesa")}</p>
                <p className="text-muted-foreground">
                  {report.highlights.topExpenseCategory
                    ? `${translateDefaultCategoryValue(report.highlights.topExpenseCategory.name, locale)} - ${money(report.highlights.topExpenseCategory.value)}`
                    : tt("Sem despesas no mês")}
                </p>
              </div>
              <div>
                <p className="font-semibold">{tt("Maior transação")}</p>
                <p className="text-muted-foreground">
                  {report.highlights.largestTransaction
                    ? `${getTransactionTitle(report.highlights.largestTransaction)} - ${money(report.highlights.largestTransaction.amount)}`
                    : tt("Nenhum lançamento encontrado")}
                </p>
              </div>
              <div>
                <p className="font-semibold">{tt("Variação vs mês anterior")}</p>
                <p className="text-muted-foreground">
                  {report.comparison
                    ? `${tt("Saldo")} ${money(report.comparison.balanceChange)}`
                    : tt("Sem dados suficientes para comparar")}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card className="app-panel-soft rounded-xl">
            <CardContent className="flex min-h-[220px] items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              {tt("Carregando relatório...")}
            </CardContent>
          </Card>
        ) : report.transactions.length === 0 ? (
          <Card className="app-panel-soft rounded-xl">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <Download className="h-8 w-8 text-primary" />
              <div>
                <p className="font-semibold">{tt("Nenhum lançamento encontrado neste mês")}</p>
                <p className="text-sm text-muted-foreground">{tt("Escolha outro mês ou registre novas receitas e despesas.")}</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card id="tour-reports-categories" className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{tt("Despesas por categoria")}</CardTitle>
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
                  <CardTitle>{tt("Receitas por categoria")}</CardTitle>
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
                  <CardTitle>{tt("Evolução diária")}</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={report.dailyEvolution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => money(Number(value))} />
                      <Area type="monotone" dataKey="income" stackId="1" stroke={REPORT_COLORS.income} fill={REPORT_COLORS.income} fillOpacity={0.25} name={tt("Receitas")} />
                      <Area type="monotone" dataKey="expense" stackId="2" stroke={REPORT_COLORS.expense} fill={REPORT_COLORS.expense} fillOpacity={0.2} name={tt("Despesas")} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="app-panel-subtle rounded-xl">
                <CardHeader>
                  <CardTitle>{tt("Métodos de pagamento")}</CardTitle>
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
                      <p className="mt-1 text-xs text-muted-foreground">{tt("{percentage}% do volume do mês", { percentage: method.percentage })}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card className="app-panel-subtle rounded-xl">
              <CardHeader>
                <CardTitle>{tt("Tabela de transações")}</CardTitle>
                <CardDescription>{tt("Dados usados no relatório exportável")}</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="py-3 pr-4">{tt("Data")}</th>
                      <th className="py-3 pr-4">{tt("Tipo")}</th>
                      <th className="py-3 pr-4">{tt("Categoria")}</th>
                      <th className="py-3 pr-4">{tt("Descrição")}</th>
                      <th className="py-3 pr-4">{tt("Método")}</th>
                      <th className="py-3 pr-4">{tt("Status")}</th>
                      <th className="py-3 text-right">{tt("Valor")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.transactions.map((transaction) => (
                      <tr key={transaction.id || `${transaction.dueDate}-${transaction.description}`} className="border-b last:border-0 hover:bg-muted/80">
                        <td className="py-3 pr-4">{transaction.dueDate}</td>
                        <td className="py-3 pr-4">{transaction.type === "income" ? tt("Receita") : tt("Despesa")}</td>
                        <td className="py-3 pr-4">
                          <CategoryLabel value={transaction.category} className="max-w-52 gap-1.5" iconClassName="h-3 w-3" />
                        </td>
                        <td className="py-3 pr-4">{getTransactionTitle(transaction)}</td>
                        <td className="py-3 pr-4">{tt(formatPaymentMethodLabel(transaction.paymentMethod))}</td>
                        <td className="py-3 pr-4">{transaction.status === "paid" ? tt("Pago") : tt("Pendente")}</td>
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
