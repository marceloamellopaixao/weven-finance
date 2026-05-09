"use client";

import type { Row as ExcelRow, Worksheet as ExcelWorksheet } from "exceljs";
import type { MonthlyReport, ReportSlice } from "@/types/report";
import { formatCategoryLabel } from "@/lib/category-utils";
import { formatPaymentMethodLabel, formatReportCurrency } from "@/lib/reports/monthlyReport";

const BRAND = {
  primary: "#f8b600",
  ink: "#111827",
  muted: "#64748b",
  border: "#e2e8f0",
  panel: "#f8fafc",
  income: "#059669",
  expense: "#dc2626",
  balance: "#2563eb",
};

const CHART_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#be123c", "#4f46e5"];
const PIE_CANVAS_WIDTH = 900;
const PIE_CANVAS_HEIGHT = 520;

type ExportOptions = {
  element?: HTMLElement;
  workspaceName?: string;
  userName?: string;
};

type PdfDoc = {
  internal: {
    pageSize: {
      getWidth: () => number;
      getHeight: () => number;
    };
  };
  getTextWidth: (text: string) => number;
  getNumberOfPages: () => number;
  setPage: (page: number) => void;
  addPage: () => void;
  addImage: (imageData: string, format: string, x: number, y: number, width: number, height: number) => void;
  setFillColor: (color: string) => void;
  setDrawColor: (color: string) => void;
  setFont: (family: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (color: string) => void;
  text: (text: string, x: number, y: number, options?: { align?: "left" | "center" | "right" }) => void;
  rect: (x: number, y: number, width: number, height: number, style?: string) => void;
  roundedRect: (x: number, y: number, width: number, height: number, rx: number, ry: number, style?: string) => void;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  save: (fileName: string) => void;
};

function getReportFileName(report: MonthlyReport, extension: "pdf" | "xlsx") {
  return `wevenfinance-relatorio-${report.month}.${extension}`;
}

function formatDate(value?: string) {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
}

function getMonthLabel(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, monthIndex - 1, 2);
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function getTransactionTitle(transaction: MonthlyReport["transactions"][number]) {
  return transaction.title || transaction.description || "Lançamento";
}

function stripDataUrl(dataUrl: string) {
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}

function triggerDownload(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function truncate(pdf: { getTextWidth: (text: string) => number }, text: string, maxWidth: number) {
  if (pdf.getTextWidth(text) <= maxWidth) return text;
  let output = text;
  while (output.length > 3 && pdf.getTextWidth(`${output}...`) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}

function ensurePdfSpace(pdf: PdfDoc, y: number, neededHeight: number, margin: number) {
  const pageHeight = pdf.internal.pageSize.getHeight();
  if (y + neededHeight <= pageHeight - margin - 14) return y;
  pdf.addPage();
  return margin;
}

function drawWalletLogo(pdf: PdfDoc, x: number, y: number) {
  pdf.setFillColor(BRAND.primary);
  pdf.roundedRect(x, y, 10, 10, 2.2, 2.2, "F");
  pdf.setDrawColor(BRAND.ink);
  pdf.roundedRect(x + 2.2, y + 3, 6.4, 4.6, 0.8, 0.8, "S");
  pdf.line(x + 3, y + 2.5, x + 7.2, y + 2.5);
  pdf.setFillColor(BRAND.ink);
  pdf.roundedRect(x + 6.7, y + 4.4, 1.2, 1.2, 0.6, 0.6, "F");
}

function createPieChartImage(rows: ReportSlice[], title: string) {
  if (typeof document === "undefined" || rows.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = PIE_CANVAS_WIDTH;
  canvas.height = PIE_CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = BRAND.ink;
  ctx.font = "bold 30px Arial";
  ctx.fillText(title, 34, 52);

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const centerX = 250;
  const centerY = 285;
  const radius = 150;
  let angle = -Math.PI / 2;

  rows.forEach((row, index) => {
    const slice = total > 0 ? (row.value / total) * Math.PI * 2 : 0;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fill();
    angle += slice;
  });

  ctx.beginPath();
  ctx.fillStyle = "#ffffff";
  ctx.arc(centerX, centerY, 76, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = BRAND.muted;
  ctx.font = "bold 22px Arial";
  ctx.textAlign = "center";
  ctx.fillText("Total", centerX, centerY - 8);
  ctx.fillStyle = BRAND.ink;
  ctx.font = "bold 26px Arial";
  ctx.fillText(formatReportCurrency(total), centerX, centerY + 26);
  ctx.textAlign = "left";

  const legendX = 470;
  let legendY = 112;
  ctx.font = "17px Arial";
  rows.slice(0, 8).forEach((row, index) => {
    const color = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fillStyle = color;
    ctx.fillRect(legendX, legendY - 13, 16, 16);
    ctx.fillStyle = BRAND.ink;
    ctx.font = "bold 17px Arial";
    const label = row.name.length > 32 ? `${row.name.slice(0, 32)}...` : row.name;
    ctx.fillText(label, legendX + 26, legendY);
    ctx.fillStyle = BRAND.muted;
    ctx.font = "16px Arial";
    ctx.fillText(`${formatReportCurrency(row.value)} · ${row.percentage}%`, legendX + 26, legendY + 22);
    legendY += 50;
  });

  return canvas.toDataURL("image/png");
}

function createBarChartImage(rows: ReportSlice[], title: string) {
  if (typeof document === "undefined" || rows.length === 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = BRAND.ink;
  ctx.font = "bold 30px Arial";
  ctx.fillText(title, 34, 52);

  const max = Math.max(...rows.map((row) => row.value), 1);
  let y = 100;
  rows.slice(0, 8).forEach((row, index) => {
    const barWidth = Math.max(8, (row.value / max) * 540);
    ctx.fillStyle = CHART_COLORS[index % CHART_COLORS.length];
    ctx.fillRect(260, y - 18, barWidth, 22);
    ctx.fillStyle = BRAND.ink;
    ctx.font = "bold 17px Arial";
    ctx.fillText(row.name.length > 25 ? `${row.name.slice(0, 25)}...` : row.name, 34, y);
    ctx.fillStyle = BRAND.muted;
    ctx.font = "16px Arial";
    ctx.fillText(`${formatReportCurrency(row.value)} · ${row.percentage}%`, 260 + barWidth + 14, y);
    y += 38;
  });

  return canvas.toDataURL("image/png");
}

function drawHorizontalChart(
  pdf: PdfDoc,
  title: string,
  rows: Array<{ name: string; value: number; percentage: number }>,
  x: number,
  y: number,
  width: number,
  colorOffset = 0
) {
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(11);
  pdf.setTextColor(BRAND.ink);
  pdf.text(title, x, y);

  if (rows.length === 0) {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND.muted);
    pdf.text("Sem dados no período.", x, y + 8);
    return y + 18;
  }

  const max = Math.max(...rows.map((row) => row.value), 1);
  let cursorY = y + 9;
  rows.slice(0, 7).forEach((row, index) => {
    const color = CHART_COLORS[(index + colorOffset) % CHART_COLORS.length];
    const barWidth = Math.max(3, (row.value / max) * (width - 42));
    pdf.setFillColor(color);
    pdf.roundedRect(x, cursorY, barWidth, 4.2, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(BRAND.ink);
    pdf.text(truncate(pdf, row.name, 48), x, cursorY + 9);
    pdf.setTextColor(BRAND.muted);
    pdf.text(`${formatReportCurrency(row.value)} (${row.percentage}%)`, x + width, cursorY + 9, { align: "right" });
    cursorY += 15;
  });
  return cursorY + 2;
}

function addFooter(pdf: PdfDoc, margin: number) {
  const totalPages = pdf.getNumberOfPages();
  const pageHeight = pdf.internal.pageSize.getHeight();
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page);
    pdf.setDrawColor(BRAND.border);
    pdf.line(margin, pageHeight - 13, pdf.internal.pageSize.getWidth() - margin, pageHeight - 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(BRAND.muted);
    pdf.text(`Gerado em ${new Date().toLocaleString("pt-BR")} · Página ${page}/${totalPages}`, margin, pageHeight - 7);
  }
}

export async function exportMonthlyReportToPdf(report: MonthlyReport, options: ExportOptions = {}) {
  const { default: jsPDF } = await import("jspdf");
  const pdf = new jsPDF("p", "mm", "a4") as PdfDoc;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const margin = 12;
  const contentWidth = pageWidth - margin * 2;
  const contextName = options.workspaceName || options.userName || "Relatório financeiro";

  pdf.setFillColor(BRAND.ink);
  pdf.rect(0, 0, pageWidth, 31, "F");
  drawWalletLogo(pdf, margin, 8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor("#ffffff");
  pdf.text("Weven", margin + 14, 14);
  pdf.setTextColor(BRAND.primary);
  pdf.text("Finance", margin + 33, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor("#cbd5e1");
  pdf.text(`${contextName} · ${getMonthLabel(report.month)}`, margin + 14, 22);

  let y = 42;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.setTextColor(BRAND.ink);
  pdf.text("Relatório financeiro mensal", margin, y);
  y += 8;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setTextColor(BRAND.muted);
  pdf.text("Resumo executivo, gráficos e lançamentos do período.", margin, y);
  y += 10;

  const cards = [
    ["Receitas", report.totals.income, BRAND.income],
    ["Despesas", report.totals.expense, BRAND.expense],
    ["Saldo", report.totals.balance, BRAND.balance],
    ["Lançamentos", report.highlights.transactionCount, BRAND.primary],
    ["Despesas pagas", report.totals.paidExpense, BRAND.expense],
    ["Despesas pendentes", report.totals.pendingExpense, BRAND.expense],
    ["Receitas recebidas", report.totals.paidIncome, BRAND.income],
    ["Receitas pendentes", report.totals.pendingIncome, BRAND.income],
  ] as const;
  const cardW = (contentWidth - 9) / 4;
  cards.forEach(([label, value, color], index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = margin + col * (cardW + 3);
    const cy = y + row * 24;
    pdf.setFillColor(BRAND.panel);
    pdf.setDrawColor(BRAND.border);
    pdf.roundedRect(x, cy, cardW, 19, 2.5, 2.5, "FD");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    pdf.setTextColor(BRAND.muted);
    pdf.text(label.toUpperCase(), x + 4, cy + 6);
    pdf.setFontSize(11);
    pdf.setTextColor(color);
    pdf.text(typeof value === "number" && label !== "Lançamentos" ? formatReportCurrency(value) : String(value), x + 4, cy + 14);
  });
  y += 54;

  const totalBar = Math.max(report.totals.income, report.totals.expense, 1);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(BRAND.ink);
  pdf.text("Receitas x despesas", margin, y);
  y += 7;
  [
    { label: "Receitas", value: report.totals.income, color: BRAND.income },
    { label: "Despesas", value: report.totals.expense, color: BRAND.expense },
  ].forEach((item) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND.ink);
    pdf.text(item.label, margin, y + 4);
    pdf.setFillColor("#eef2f7");
    pdf.roundedRect(margin + 25, y, contentWidth - 67, 6, 2, 2, "F");
    pdf.setFillColor(item.color);
    pdf.roundedRect(margin + 25, y, Math.max(3, ((contentWidth - 67) * item.value) / totalBar), 6, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.text(formatReportCurrency(item.value), pageWidth - margin, y + 4.5, { align: "right" });
    y += 11;
  });

  y += 6;
  const pieWidth = contentWidth;
  const pieHeight = (pieWidth * PIE_CANVAS_HEIGHT) / PIE_CANVAS_WIDTH;
  const expensePie = createPieChartImage(report.categoryExpenses, "Despesas por categoria");
  const incomePie = createPieChartImage(report.categoryIncomes, "Receitas por categoria");
  if (expensePie || incomePie) {
    y = ensurePdfSpace(pdf, y, 7 + pieHeight, margin);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.setTextColor(BRAND.ink);
    pdf.text("Categorias", margin, y);
    y += 7;
    if (expensePie) {
      pdf.addImage(expensePie, "PNG", margin, y, pieWidth, pieHeight);
      y += pieHeight + 8;
    }
    if (incomePie) {
      y = ensurePdfSpace(pdf, y, pieHeight, margin);
      pdf.addImage(incomePie, "PNG", margin, y, pieWidth, pieHeight);
      y += pieHeight + 8;
    }
  } else {
    const leftY = drawHorizontalChart(pdf, "Despesas por categoria", report.categoryExpenses, margin, y, 84, 0);
    const rightY = drawHorizontalChart(pdf, "Receitas por categoria", report.categoryIncomes, margin + 100, y, 84, 2);
    y = Math.max(leftY, rightY) + 4;
  }

  y = ensurePdfSpace(pdf, y, 75, margin);
  y = drawHorizontalChart(pdf, "Métodos de pagamento", report.paymentMethods, margin, y, contentWidth, 4);
  y += 4;

  y = ensurePdfSpace(pdf, y, 46, margin);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(BRAND.ink);
  pdf.text("Destaques", margin, y);
  y += 7;
  const highlights = [
    ["Maior categoria de despesa", report.highlights.topExpenseCategory ? `${report.highlights.topExpenseCategory.name} · ${formatReportCurrency(report.highlights.topExpenseCategory.value)}` : "Sem despesas no mês"],
    ["Maior transação", report.highlights.largestTransaction ? `${getTransactionTitle(report.highlights.largestTransaction)} · ${formatReportCurrency(report.highlights.largestTransaction.amount)}` : "Nenhum lançamento encontrado"],
    ["Variação vs mês anterior", report.comparison ? `Saldo ${formatReportCurrency(report.comparison.balanceChange)}` : "Sem dados suficientes para comparar"],
  ];
  highlights.forEach(([label, value]) => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(BRAND.ink);
    pdf.text(label, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(BRAND.muted);
    pdf.text(truncate(pdf, value, contentWidth), margin, y + 5);
    y += 12;
  });

  if (report.transactions.length > 0) {
    pdf.addPage();
    y = margin;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(BRAND.ink);
    pdf.text("Transações", margin, y);
    y += 8;
    const columns = [
      { label: "Data", x: margin, width: 18 },
      { label: "Tipo", x: margin + 21, width: 20 },
      { label: "Categoria", x: margin + 44, width: 34 },
      { label: "Descrição", x: margin + 81, width: 44 },
      { label: "Método", x: margin + 128, width: 28 },
      { label: "Status", x: margin + 159, width: 18 },
      { label: "Valor", x: pageWidth - margin, width: 28, align: "right" as const },
    ];
    pdf.setFillColor(BRAND.panel);
    pdf.rect(margin, y - 5, contentWidth, 8, "F");
    columns.forEach((column) => {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(BRAND.muted);
      pdf.text(column.label, column.x, y, { align: column.align });
    });
    y += 6;

    report.transactions.forEach((transaction, index) => {
      y = ensurePdfSpace(pdf, y, 10, margin);
      if (index % 2 === 0) {
        pdf.setFillColor("#fbfdff");
        pdf.rect(margin, y - 4, contentWidth, 8, "F");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(BRAND.ink);
      pdf.text(formatDate(transaction.dueDate), columns[0].x, y);
      pdf.text(transaction.type === "income" ? "Receita" : "Despesa", columns[1].x, y);
      pdf.text(truncate(pdf, formatCategoryLabel(transaction.category || "-"), columns[2].width), columns[2].x, y);
      pdf.text(truncate(pdf, getTransactionTitle(transaction), columns[3].width), columns[3].x, y);
      pdf.text(truncate(pdf, formatPaymentMethodLabel(transaction.paymentMethod), columns[4].width), columns[4].x, y);
      pdf.text(transaction.status === "paid" ? "Pago" : "Pendente", columns[5].x, y);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(transaction.type === "income" ? BRAND.income : BRAND.expense);
      pdf.text(formatReportCurrency(transaction.amount), columns[6].x, y, { align: "right" });
      y += 8;
    });
  }

  addFooter(pdf, margin);
  pdf.save(getReportFileName(report, "pdf"));
}

function styleHeader(row: ExcelRow) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF111827" } };
}

function formatWorksheetCurrency(worksheet: ExcelWorksheet, columnKeys: string[]) {
  columnKeys.forEach((key) => {
    const column = worksheet.getColumn(key);
    column.numFmt = '"R$" #,##0.00;-"R$" #,##0.00';
  });
}

function autosizeColumns(worksheet: ExcelWorksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const value = cell.value;
      const text = value == null ? "" : String(value);
      maxLength = Math.max(maxLength, Math.min(42, text.length + 2));
    });
    column.width = maxLength;
  });
}

export async function exportMonthlyReportToExcel(report: MonthlyReport, options: ExportOptions = {}) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WevenFinance";
  workbook.created = new Date();

  const summary = workbook.addWorksheet("Resumo", { views: [{ state: "frozen", ySplit: 5 }] });
  summary.mergeCells("A1:B1");
  summary.getCell("A1").value = "WevenFinance - Relatório mensal";
  summary.getCell("A1").font = { bold: true, size: 16, color: { argb: "FF111827" } };
  summary.getCell("A2").value = "Contexto";
  summary.getCell("B2").value = options.workspaceName || options.userName || "WevenFinance";
  summary.getCell("A3").value = "Mês";
  summary.getCell("B3").value = getMonthLabel(report.month);
  summary.addRow([]);
  const summaryHeader = summary.addRow(["Indicador", "Valor"]);
  styleHeader(summaryHeader);
  [
    ["Receitas", report.totals.income],
    ["Despesas", report.totals.expense],
    ["Saldo", report.totals.balance],
    ["Despesas pagas", report.totals.paidExpense],
    ["Despesas pendentes", report.totals.pendingExpense],
    ["Receitas recebidas", report.totals.paidIncome],
    ["Receitas pendentes", report.totals.pendingIncome],
    ["Quantidade de lançamentos", report.highlights.transactionCount],
    ["Maior categoria de despesa", report.highlights.topExpenseCategory?.name || ""],
    ["Maior transação", report.highlights.largestTransaction ? getTransactionTitle(report.highlights.largestTransaction) : ""],
    ["Receitas vs mês anterior", report.comparison?.incomeChange ?? ""],
    ["Despesas vs mês anterior", report.comparison?.expenseChange ?? ""],
    ["Saldo vs mês anterior", report.comparison?.balanceChange ?? ""],
  ].forEach((row) => summary.addRow(row));
  formatWorksheetCurrency(summary, ["B"]);
  autosizeColumns(summary);

  const charts = workbook.addWorksheet("Gráficos");
  charts.getCell("A1").value = "Gráficos do relatório";
  charts.getCell("A1").font = { bold: true, size: 16 };
  const expensePie = createPieChartImage(report.categoryExpenses, "Despesas por categoria");
  const incomePie = createPieChartImage(report.categoryIncomes, "Receitas por categoria");
  const methodsBar = createBarChartImage(report.paymentMethods, "Métodos de pagamento");
  let chartRow = 3;
  for (const imageData of [expensePie, incomePie, methodsBar]) {
    if (!imageData) continue;
    const imageId = workbook.addImage({ base64: stripDataUrl(imageData), extension: "png" });
    charts.addImage(imageId, {
      tl: { col: 0, row: chartRow - 1 },
      ext: { width: 720, height: imageData === methodsBar ? 336 : 416 },
    });
    chartRow += imageData === methodsBar ? 18 : 22;
  }
  charts.columns = [{ width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 }];

  const categories = workbook.addWorksheet("Categorias", { views: [{ state: "frozen", ySplit: 1 }] });
  categories.columns = [
    { header: "Tipo", key: "type", width: 14 },
    { header: "Categoria", key: "category", width: 30 },
    { header: "Valor", key: "value", width: 16 },
    { header: "Percentual", key: "percentage", width: 14 },
  ];
  styleHeader(categories.getRow(1));
  [...report.categoryIncomes.map((item) => ({ type: "Receita", category: item.name, value: item.value, percentage: item.percentage / 100 })),
    ...report.categoryExpenses.map((item) => ({ type: "Despesa", category: item.name, value: item.value, percentage: item.percentage / 100 }))]
    .forEach((row) => categories.addRow(row));
  formatWorksheetCurrency(categories, ["C"]);
  categories.getColumn("D").numFmt = "0.0%";

  const methods = workbook.addWorksheet("Métodos", { views: [{ state: "frozen", ySplit: 1 }] });
  methods.columns = [
    { header: "Método", key: "method", width: 24 },
    { header: "Valor", key: "value", width: 16 },
    { header: "Percentual", key: "percentage", width: 14 },
  ];
  styleHeader(methods.getRow(1));
  report.paymentMethods.forEach((item) => methods.addRow({ method: item.name, value: item.value, percentage: item.percentage / 100 }));
  formatWorksheetCurrency(methods, ["B"]);
  methods.getColumn("C").numFmt = "0.0%";

  const transactions = workbook.addWorksheet("Transações", { views: [{ state: "frozen", ySplit: 1 }] });
  transactions.columns = [
    { header: "Data", key: "date", width: 12 },
    { header: "Vencimento", key: "dueDate", width: 12 },
    { header: "Tipo", key: "type", width: 12 },
    { header: "Categoria", key: "category", width: 30 },
    { header: "Descrição/Título", key: "title", width: 34 },
    { header: "Método de pagamento", key: "paymentMethod", width: 22 },
    { header: "Status", key: "status", width: 16 },
    { header: "Valor", key: "amount", width: 16 },
  ];
  styleHeader(transactions.getRow(1));
  report.transactions.forEach((transaction) => {
    transactions.addRow({
      date: formatDate(transaction.date),
      dueDate: formatDate(transaction.dueDate),
      type: transaction.type === "income" ? "Receita" : "Despesa",
      category: formatCategoryLabel(transaction.category),
      title: getTransactionTitle(transaction),
      paymentMethod: formatPaymentMethodLabel(transaction.paymentMethod),
      status: transaction.status === "paid" ? "Pago/Recebido" : "Pendente",
      amount: transaction.amount,
    });
  });
  formatWorksheetCurrency(transactions, ["H"]);
  transactions.autoFilter = "A1:H1";

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(buffer, getReportFileName(report, "xlsx"));
}
