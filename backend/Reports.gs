// GAP-06: read pre-aggregated DailySummary instead of scanning the whole Sales sheet.
// DailySummary is maintained incrementally on every sale/void and rebuilt nightly.
function Reports_summary(payload) {
  var branch = payload.branch || "ALL";
  var from = payload.date_from || "0000-01-01";
  var to = payload.date_to || "9999-12-31";
  var summaries = SheetDB_all("DailySummary").filter(function (row) {
    return inBranch(row.branch_id, branch) && String(row.business_date) >= from && String(row.business_date) <= to;
  });
  var expenses = SheetDB_all("Expenses").filter(function (row) {
    return inBranch(row.branch_id, branch) && expenseInRange(row.expense_month, from, to);
  });
  var revenueByType = { normal: 0, discount: 0, freebie: 0, staff: 0 };
  var revenueByPayment = blankPaymentMap();
  var expenseBreakdown = { salary: 0, utility_water: 0, utility_electric: 0, maintenance: 0, supply_purchase: 0, other: 0 };
  var paymentColumns = { pay_qr1: "QR1", pay_qr2: "QR2", pay_grab: "GRAB", pay_cash: "CASH", pay_thai: "THAI_HELP_THAI", pay_other: "OTHER" };
  var grossRevenue = 0, cogs = 0, wastageValue = 0;
  var byDate = {};
  summaries.forEach(function (row) {
    revenueByType.normal += Number(row.rev_normal || 0);
    revenueByType.discount += Number(row.rev_discount || 0);
    revenueByType.freebie += Number(row.rev_freebie || 0);
    revenueByType.staff += Number(row.rev_staff || 0);
    Object.keys(paymentColumns).forEach(function (col) {
      revenueByPayment[paymentColumns[col]] = Number(revenueByPayment[paymentColumns[col]] || 0) + Number(row[col] || 0);
    });
    var rowRevenue = Number(row.rev_normal || 0) + Number(row.rev_discount || 0) + Number(row.rev_freebie || 0) + Number(row.rev_staff || 0);
    grossRevenue += rowRevenue;
    cogs += Number(row.cogs_total || 0);
    wastageValue += Number(row.wastage_value || 0);
    var d = String(row.business_date);
    if (!byDate[d]) byDate[d] = { date: d, revenue: 0, profit: 0 };
    byDate[d].revenue += rowRevenue;
    byDate[d].profit += rowRevenue - Number(row.cogs_total || 0);
  });
  expenses.forEach(function (expense) {
    expenseBreakdown[expense.expense_type] = Number(expenseBreakdown[expense.expense_type] || 0) + Number(expense.amount);
  });
  var totalExpenses = Object.keys(expenseBreakdown).reduce(function (sum, key) { return sum + Number(expenseBreakdown[key]); }, 0);
  var trend = Object.keys(byDate).sort().map(function (d) { return byDate[d]; });
  return {
    gross_revenue: grossRevenue,
    revenue_by_type: revenueByType,
    revenue_by_payment: revenueByPayment,
    cogs: cogs,
    gross_profit: grossRevenue - cogs,
    wastage_value: wastageValue,
    total_expenses: totalExpenses,
    expense_breakdown: expenseBreakdown,
    net_profit: grossRevenue - cogs - wastageValue - totalExpenses,
    daily_trend: trend
  };
}

function Reports_financialStatement(payload, session) {
  var summary = Reports_summary(payload || {}, session);
  var finishedValue = SheetDB_all("FinishedStock").reduce(function (sum, lot) { return sum + Number(lot.qty_remaining) * Number(lot.unit_cost); }, 0);
  var rawValue = SheetDB_all("RawLots").reduce(function (sum, lot) { return sum + Number(lot.qty_remaining) * Number(lot.unit_cost); }, 0);
  return {
    generated_at: nowIso(),
    parts: ["Part I Business Overview", "Part II Branch Performance", "Part III Financial Statements"],
    income_statement: summary,
    balance_sheet: {
      inventory_assets: finishedValue + rawValue,
      cash_and_bank_proxy: summary.gross_revenue,
      owner_equity_proxy: summary.net_profit + finishedValue + rawValue
    }
  };
}

function inBranch(rowBranch, selected) {
  return selected === "ALL" || rowBranch === selected;
}

function expenseInRange(expenseMonth, from, to) {
  var month = String(expenseMonth || "").slice(0, 7);
  if (!month) return true;
  var fromMonth = String(from || "0000-01-01").slice(0, 7);
  var toMonth = String(to || "9999-12-31").slice(0, 7);
  return month >= fromMonth && month <= toMonth;
}

function buildDailyTrend(sales) {
  var byDate = {};
  sales.forEach(function (sale) {
    var date = sale.business_date;
    if (!byDate[date]) byDate[date] = { date: date, revenue: 0, profit: 0 };
    byDate[date].revenue += Number(sale.total_amount || 0);
    byDate[date].profit += Number(sale.total_amount || 0) - Number(sale.total_cogs || 0);
  });
  return Object.keys(byDate).sort().map(function (date) { return byDate[date]; });
}
