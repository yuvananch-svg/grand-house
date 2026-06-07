import type { AppState, Branch, PaymentChannel } from "./types";

export type PeriodMode = "day" | "month" | "quarter" | "year" | "ytd" | "max";

export interface FinancialRow {
  label: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  opex: number;
  netProfit: number;
}

export interface ChannelRow {
  name: PaymentChannel;
  value: number;
}

export interface BranchRow {
  label: string;
  "บ้านโจ้": number;
  "ท่ารั้ว": number;
  "เกษตรใหม่": number;
}

export function financialRows(state: AppState, mode: PeriodMode): FinancialRow[] {
  const keys = periodKeys(state, mode);
  return keys.map((key) => rowForPeriod(state, key));
}

export function monthlyRows(state: AppState) {
  return financialRows(state, "month");
}

export function quarterlyRows(state: AppState) {
  return financialRows(state, "quarter");
}

export function yearlyRows(state: AppState) {
  return financialRows(state, "year");
}

export function ytdRows(state: AppState) {
  let runningRevenue = 0;
  let runningCogs = 0;
  let runningOpex = 0;
  return financialRows(state, "day")
    .filter((row) => row.label.startsWith("2026"))
    .map((row) => {
      runningRevenue += row.revenue;
      runningCogs += row.cogs;
      runningOpex += row.opex;
      return {
        label: row.label,
        revenue: runningRevenue,
        cogs: runningCogs,
        grossProfit: runningRevenue - runningCogs,
        opex: runningOpex,
        netProfit: runningRevenue - runningCogs - runningOpex,
      };
    });
}

export function maxRows(state: AppState) {
  return [rowForPeriod(state, "MAX")];
}

export function channelRows(state: AppState): ChannelRow[] {
  const channels: PaymentChannel[] = ["QR1", "QR2", "ไทยช่วยไทย", "เงินสด", "online(grab)", "อื่นๆ"];
  return channels.map((channel) => ({
    name: channel,
    value: state.payments.filter((payment) => payment.channel === channel).reduce((sum, payment) => sum + payment.amount, 0),
  }));
}

export function branchRows(state: AppState): BranchRow[] {
  const rows = monthlyRows(state);
  const activeSales = state.sales.filter((sale) => sale.status !== "ยกเลิก");
  return rows.map((row) => {
    const branches: Branch[] = ["บ้านโจ้", "ท่ารั้ว", "เกษตรใหม่"];
    const values = Object.fromEntries(
      branches.map((branch) => [
        branch,
        activeSales.filter((sale) => periodLabel(sale.date, "month") === row.label && sale.branch === branch).reduce((sum, sale) => sum + sale.total, 0),
      ]),
    ) as Record<Branch, number>;
    return { label: row.label, ...values };
  });
}

export function topProductRows(state: AppState) {
  const map = new Map<string, { name: string; revenue: number; grossProfit: number }>();
  const activeSaleIds = new Set(state.sales.filter((sale) => sale.status !== "ยกเลิก").map((sale) => sale.id));
  for (const item of state.saleItems) {
    if (!activeSaleIds.has(item.saleId)) continue;
    const product = state.products.find((p) => p.id === item.productId);
    const current = map.get(item.productId) || { name: product?.name || item.productId, revenue: 0, grossProfit: 0 };
    current.revenue += item.revenue;
    current.grossProfit += item.revenue - item.costOfGoods;
    map.set(item.productId, current);
  }
  for (const session of state.sessions) {
    const product = state.products.find((p) => p.id === session.productId);
    const current = map.get(session.productId) || { name: product?.name || session.productId, revenue: 0, grossProfit: 0 };
    current.revenue += session.revenue;
    current.grossProfit += session.revenue - session.costOfGoods;
    map.set(session.productId, current);
  }
  return [...map.values()].sort((a, b) => b.grossProfit - a.grossProfit).slice(0, 8);
}

export function expenseRows(state: AppState) {
  const map = new Map<string, number>();
  for (const entry of state.cashEntries.filter((entry) => entry.type === "จ่ายเงิน")) {
    map.set(entry.category, (map.get(entry.category) || 0) + entry.amount);
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

export function wasteRows(state: AppState) {
  const map = new Map<string, number>();
  for (const session of state.sessions) {
    if (session.wasteQty <= 0) continue;
    map.set(session.date, (map.get(session.date) || 0) + session.wasteQty * (session.costOfGoods / Math.max(1, session.previousRemaining - session.countedRemaining)));
  }
  for (const adjustment of state.adjustments) {
    if (adjustment.quantityChange >= 0) continue;
    const lot = state.lots.find((item) => item.id === adjustment.lotId);
    const value = Math.abs(adjustment.quantityChange) * (lot?.unitCost || 0);
    map.set(adjustment.date, (map.get(adjustment.date) || 0) + value);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
}

export function exportCsv(filename: string, headers: string[], rows: Array<Array<string | number>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  downloadBlob(filename, "\uFEFF" + csv, "text/csv;charset=utf-8");
}

export function exportFinancialPdf(state: AppState) {
  const rows = monthlyRows(state);
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานงบการเงิน Grand House</title>
  <style>body{font-family:Tahoma,sans-serif;padding:32px;color:#221}h1{color:#9b1118}table{border-collapse:collapse;width:100%;margin-top:18px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#fff1f2}</style></head>
  <body><h1>รายงานงบการเงิน Grand House</h1><p>ข้อมูลสำหรับส่งบัญชีตรวจ ไม่ใช่คำแนะนำภาษีทางกฎหมาย</p>
  <table><thead><tr><th>งวด</th><th>ยอดขาย</th><th>ต้นทุนขาย</th><th>กำไรขั้นต้น</th><th>ค่าใช้จ่าย</th><th>กำไรสุทธิ</th></tr></thead><tbody>
  ${rows.map((row) => `<tr><td>${row.label}</td><td>${row.revenue.toFixed(2)}</td><td>${row.cogs.toFixed(2)}</td><td>${row.grossProfit.toFixed(2)}</td><td>${row.opex.toFixed(2)}</td><td>${row.netProfit.toFixed(2)}</td></tr>`).join("")}
  </tbody></table></body></html>`;
  downloadBlob("grand-house-financial-report.html", html, "text/html;charset=utf-8");
}

function rowForPeriod(state: AppState, key: string): FinancialRow {
  const allSales = state.sales.filter((sale) => sale.status !== "ยกเลิก");
  const sales = key === "MAX" ? allSales : allSales.filter((sale) => matchesPeriod(sale.date, key));
  const sessions = key === "MAX" ? state.sessions : state.sessions.filter((session) => matchesPeriod(session.date, key));
  const expenses = key === "MAX" ? state.cashEntries : state.cashEntries.filter((entry) => matchesPeriod(entry.date, key));
  const revenue = sales.reduce((sum, sale) => sum + sale.total, 0) + sessions.reduce((sum, session) => sum + session.revenue, 0);
  const cogs = sales.reduce((sum, sale) => sum + sale.costOfGoods, 0) + sessions.reduce((sum, session) => sum + session.costOfGoods, 0);
  const opex = expenses.filter((entry) => entry.type === "จ่ายเงิน").reduce((sum, entry) => sum + entry.amount, 0);
  return { label: key, revenue, cogs, grossProfit: revenue - cogs, opex, netProfit: revenue - cogs - opex };
}

function periodKeys(state: AppState, mode: PeriodMode) {
  if (mode === "max") return ["MAX"];
  const dates = [
    ...state.sales.filter((sale) => sale.status !== "ยกเลิก").map((sale) => sale.date),
    ...state.sessions.map((session) => session.date),
    ...state.cashEntries.map((entry) => entry.date),
  ];
  return [...new Set(dates.map((date) => periodLabel(date, mode)))].sort();
}

function periodLabel(date: string, mode: PeriodMode) {
  if (mode === "day" || mode === "ytd") return date;
  if (mode === "month") return date.slice(0, 7);
  if (mode === "year") return date.slice(0, 4);
  const month = Number(date.slice(5, 7));
  const quarter = Math.ceil(month / 3);
  return `${date.slice(0, 4)} Q${quarter}`;
}

function matchesPeriod(date: string, key: string) {
  return date === key || date.startsWith(key) || periodLabel(date, "quarter") === key || periodLabel(date, "year") === key;
}

function downloadBlob(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
