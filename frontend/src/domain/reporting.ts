import { paymentMethods } from "../data/seed";
import type { BranchId, LocalState, ReportSummary, SaleType } from "../types";
import { bangkokDateFromIso } from "./lookups";

export type RangePreset = "today" | "month" | "quarter" | "year" | "inception";

export function resolveDateRange(range: RangePreset): { date_from?: string; date_to?: string } {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
  if (range === "inception") return {};
  if (range === "today") return { date_from: today, date_to: today };
  if (range === "month") return { date_from: `${today.slice(0, 7)}-01`, date_to: today };
  if (range === "quarter") {
    const month = Number(today.slice(5, 7)) - 1;
    const quarterStartMonth = Math.floor(month / 3) * 3;
    const start = `${today.slice(0, 4)}-${String(quarterStartMonth + 1).padStart(2, "0")}-01`;
    return { date_from: start, date_to: today };
  }
  return { date_from: `${today.slice(0, 4)}-01-01`, date_to: today };
}

export function countSales(state: LocalState, branch: BranchId | "ALL", range: { date_from?: string; date_to?: string }, saleType: SaleType) {
  return state.sales.filter((sale) =>
    sale.status === "active"
    && sale.sale_type === saleType
    && (branch === "ALL" || sale.branch_id === branch)
    && (!range.date_from || sale.business_date >= range.date_from)
    && (!range.date_to || sale.business_date <= range.date_to)
  ).length;
}

export function countWastage(state: LocalState, branch: BranchId | "ALL", range: { date_from?: string; date_to?: string }) {
  return state.wastage.filter((item) => {
    const date = bangkokDateFromIso(item.created_at);
    return (branch === "ALL" || item.branch_id === branch)
      && (!range.date_from || date >= range.date_from)
      && (!range.date_to || date <= range.date_to);
  }).length;
}

export function summarize(state: LocalState, filters: { branch?: BranchId | "ALL"; date_from?: string; date_to?: string } = {}): ReportSummary {
  const branch = filters.branch || "ALL";
  const inBranch = (branch_id: BranchId) => branch === "ALL" || branch_id === branch;
  const inDate = (date: string) => (!filters.date_from || date >= filters.date_from) && (!filters.date_to || date <= filters.date_to);
  const inExpenseMonth = (month: string) => {
    const fromMonth = (filters.date_from || "0000-01-01").slice(0, 7);
    const toMonth = (filters.date_to || "9999-12-31").slice(0, 7);
    return month >= fromMonth && month <= toMonth;
  };
  const activeSales = state.sales.filter((sale) => sale.status === "active" && inBranch(sale.branch_id) && inDate(sale.business_date));
  const wastage = state.wastage.filter((item) => inBranch(item.branch_id) && inDate(bangkokDateFromIso(item.created_at)));
  const expenses = state.expenses.filter((expense) => inBranch(expense.branch_id) && inExpenseMonth(expense.expense_month));
  const revenue_by_type = { normal: 0, discount: 0, freebie: 0, staff: 0 };
  const revenue_by_payment = { QR1: 0, QR2: 0, GRAB: 0, CASH: 0, THAI_HELP_THAI: 0, OTHER: 0 };
  const expense_breakdown = { salary: 0, utility_water: 0, utility_electric: 0, maintenance: 0, supply_purchase: 0, other: 0 };
  expenses.forEach((expense) => {
    expense_breakdown[expense.expense_type] += expense.amount;
  });
  const summaryRows = state.dailySummary.filter((row) => inBranch(row.branch_id) && inDate(row.business_date));
  const useDailySummary = summaryRows.length > 0;
  const byDate = new Map<string, { revenue: number; cogs: number }>();
  let gross_revenue = 0;
  let cogs = 0;
  let wastage_value = 0;
  if (useDailySummary) {
    summaryRows.forEach((row) => {
      revenue_by_type.normal += row.rev_normal || 0;
      revenue_by_type.discount += row.rev_discount || 0;
      revenue_by_type.freebie += row.rev_freebie || 0;
      revenue_by_type.staff += row.rev_staff || 0;
      revenue_by_payment.QR1 += row.pay_qr1 || 0;
      revenue_by_payment.QR2 += row.pay_qr2 || 0;
      revenue_by_payment.GRAB += row.pay_grab || 0;
      revenue_by_payment.CASH += row.pay_cash || 0;
      revenue_by_payment.THAI_HELP_THAI += row.pay_thai || 0;
      revenue_by_payment.OTHER += row.pay_other || 0;
      const revenue = (row.rev_normal || 0) + (row.rev_discount || 0) + (row.rev_freebie || 0) + (row.rev_staff || 0);
      gross_revenue += revenue;
      cogs += row.cogs_total || 0;
      wastage_value += row.wastage_value || 0;
      const daily = byDate.get(row.business_date) || { revenue: 0, cogs: 0 };
      daily.revenue += revenue;
      daily.cogs += row.cogs_total || 0;
      byDate.set(row.business_date, daily);
    });
  } else {
    activeSales.forEach((sale) => {
      revenue_by_type[sale.sale_type] += sale.total_amount;
      revenue_by_payment[sale.payment_method] += sale.total_amount;
      const row = byDate.get(sale.business_date) || { revenue: 0, cogs: 0 };
      row.revenue += sale.total_amount;
      row.cogs += sale.total_cogs;
      byDate.set(sale.business_date, row);
    });
    gross_revenue = activeSales.reduce((sum, sale) => sum + sale.total_amount, 0);
    cogs = activeSales.reduce((sum, sale) => sum + sale.total_cogs, 0);
    wastage_value = wastage.reduce((sum, item) => sum + item.total_cost_value, 0);
  }
  const total_expenses = Object.values(expense_breakdown).reduce((sum, value) => sum + value, 0);
  return {
    gross_revenue,
    revenue_by_type,
    revenue_by_payment,
    cogs,
    gross_profit: gross_revenue - cogs,
    wastage_value,
    total_expenses,
    expense_breakdown,
    net_profit: gross_revenue - cogs - wastage_value - total_expenses,
    daily_trend: [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, row]) => ({
      date,
      revenue: row.revenue,
      profit: row.revenue - row.cogs
    }))
  };
}

export { paymentMethods };
