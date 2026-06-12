import { createSeedState, paymentMethods } from "../data/seed";
import type {
  ApiRequest,
  ApiResponse,
  AuditFlag,
  AuditFlagCode,
  AuditLog,
  BranchId,
  CartItem,
  DailySummary,
  Expense,
  FeatureGroup,
  FinishedLot,
  LocalState,
  LotBreakdown,
  PaymentMethod,
  PendingSale,
  Product,
  RawLot,
  RecipeItem,
  ReportSummary,
  Role,
  Sale,
  SaleItem,
  Session,
  Wastage
} from "../types";
import { dateOffsetBangkok, makeClientId, makeId, nowIso, todayBangkok } from "../utils/ids";
import { consumeFifo, previewFifo } from "../utils/fifo";

const STATE_KEY = "grands-house-local-state-v1";
const SESSION_KEY_PREFIX = "grands-house-local-session:";
const MAX_SALES_PER_BATCH = 50;
const MAX_ITEMS_PER_SALE = 100;
const MAX_QTY_PER_OPERATION = 10_000;
const MAX_ERROR_LOG_PER_DEVICE_DAY = 20;
const EXPENSE_TYPES: Expense["expense_type"][] = ["salary", "utility_water", "utility_electric", "maintenance", "supply_purchase", "other"];

const ROLE_ACTIONS: Record<Role, string[]> = {
  staff: ["app.snapshot", "product.list", "product.images", "stock.myBranch", "sale.syncBatch", "sale.void", "wastage.create", "stock.extendExpiry", "log.clientError"],
  office: [
    "app.snapshot",
    "product.list",
    "product.images",
    "item.list",
    "sale.void",
    "goods.receive",
    "rawlot.purchase",
    "inventory.list",
    "production.preview",
    "production.run",
    "recipe.list",
    "stockAdjust.request",
    "reconcile.getDaily",
    "reconcile.confirm",
    "expense.create",
    "expense.list",
    "rawWastage.create",
    "log.clientError"
  ],
  owner: ["*"]
};

export function loadState(): LocalState {
  const raw = localStorage.getItem(STATE_KEY);
  if (!raw) {
    const state = createSeedState();
    saveState(state);
    return state;
  }
  try {
    return JSON.parse(raw) as LocalState;
  } catch {
    const state = createSeedState();
    saveState(state);
    return state;
  }
}

export function saveState(state: LocalState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function resetLocalState(): LocalState {
  localStorageKeys()
    .filter((key) => key.startsWith(SESSION_KEY_PREFIX))
    .forEach((key) => localStorage.removeItem(key));
  const state = createSeedState();
  saveState(state);
  return state;
}

export function getLocalSession(token?: string): Session | null {
  if (!token) return null;
  const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${token}`);
  return raw ? (JSON.parse(raw) as Session) : null;
}

function saveSession(session: Session): void {
  localStorage.setItem(`${SESSION_KEY_PREFIX}${session.token}`, JSON.stringify(session));
}

function localStorageKeys(): string[] {
  return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key): key is string => Boolean(key));
}

function ok<T>(data: T, state: LocalState): ApiResponse<T> {
  return { ok: true, data, catalog_version: state.config.catalog_version };
}

function err(code: string, message: string): ApiResponse<never> {
  return { ok: false, code, message };
}

function assertIntegerRange(value: unknown, code: string, min: number, max: number): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < min || numberValue > max) throw new Error(code);
  return numberValue;
}

function assertPaymentMethod(value: unknown): asserts value is PaymentMethod {
  if (!paymentMethods.includes(value as PaymentMethod)) throw new Error("BAD_PAYMENT_METHOD");
}

function assertExpenseType(value: unknown): asserts value is Expense["expense_type"] {
  if (!EXPENSE_TYPES.includes(value as Expense["expense_type"])) throw new Error("BAD_EXPENSE_TYPE");
}

function revokeLocalSessionsForUser(userId: string): void {
  localStorageKeys()
    .filter((key) => key.startsWith(SESSION_KEY_PREFIX))
    .forEach((key) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      try {
        if ((JSON.parse(raw) as Session).user_id === userId) localStorage.removeItem(key);
      } catch {
        localStorage.removeItem(key);
      }
    });
}

function featureFor(action: string): FeatureGroup {
  if (action.startsWith("sale")) return "pos";
  if (action.includes("wastage") || action.includes("Expiry")) return "wastage";
  if (action.startsWith("goods") || action.startsWith("rawlot") || action.startsWith("inventory") || action.startsWith("stock")) return "inventory";
  if (action.startsWith("production") || action.startsWith("recipe")) return "production";
  if (action.startsWith("reconcile")) return "reconcile";
  if (action.startsWith("expense")) return "expense";
  if (action.startsWith("report")) return "report";
  if (action.startsWith("login") || action.includes("TOKEN")) return "auth";
  return "admin";
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return `H${Math.abs(hash).toString(36).toUpperCase()}`;
}

function audit(
  state: LocalState,
  session: Pick<Session, "user_id" | "role" | "branch_id" | "device_id"> | null,
  action: string,
  ref_id: string,
  detail: unknown,
  success = true,
  flag: AuditFlag = ""
): void {
  const previous = state.auditLog.at(-1);
  const row: AuditLog = {
    id: makeId("AUD"),
    timestamp: nowIso(),
    user_id: session?.user_id || "anonymous",
    role: session?.role || "anonymous",
    branch_id: session?.branch_id || "ALL",
    action,
    feature_group: featureFor(action),
    ref_id,
    detail: JSON.stringify(detail),
    flag,
    device_id: session?.device_id || "UNKNOWN",
    success,
    prev_hash: previous?.row_hash || "GENESIS",
    row_hash: ""
  };
  row.row_hash = simpleHash(`${row.prev_hash}|${row.timestamp}|${row.user_id}|${row.action}|${row.ref_id}|${row.detail}`);
  state.auditLog.push(row);
}

function isAllowed(role: Role, action: string): boolean {
  const allowed = ROLE_ACTIONS[role];
  return allowed.includes("*") || allowed.includes(action) || allowed.some((item) => item.endsWith(".*") && action.startsWith(item.slice(0, -1)));
}

function enforceBranch(session: Session, branch_id?: BranchId): BranchId {
  return session.role === "staff" ? session.branch_id : branch_id || "BR-KASET";
}

function paymentKey(method: PaymentMethod): keyof Pick<DailySummary, "pay_qr1" | "pay_qr2" | "pay_grab" | "pay_cash" | "pay_thai" | "pay_other"> {
  const map = {
    QR1: "pay_qr1",
    QR2: "pay_qr2",
    GRAB: "pay_grab",
    CASH: "pay_cash",
    THAI_HELP_THAI: "pay_thai",
    OTHER: "pay_other"
  } as const;
  return map[method];
}

function ensureDailySummary(state: LocalState, branch_id: BranchId, business_date: string): DailySummary {
  const id = `DSM-${branch_id}-${business_date}`;
  let row = state.dailySummary.find((item) => item.id === id);
  if (!row) {
    row = {
      id,
      branch_id,
      business_date,
      rev_normal: 0,
      rev_discount: 0,
      rev_freebie: 0,
      rev_staff: 0,
      pay_qr1: 0,
      pay_qr2: 0,
      pay_grab: 0,
      pay_cash: 0,
      pay_thai: 0,
      pay_other: 0,
      cogs_total: 0,
      wastage_value: 0,
      bill_count: 0,
      void_count: 0,
      last_rebuilt_at: nowIso()
    };
    state.dailySummary.push(row);
  }
  return row;
}

function bangkokBusinessDate(date: Date, cutoffHour: number): string {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    hour12: false
  }).format(date));
  const adjusted = cutoffHour > 0 && hour < cutoffHour ? new Date(date.getTime() - 86_400_000) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(adjusted);
}

function bangkokDateFromIso(value: string): string {
  const date = new Date(value);
  return bangkokBusinessDate(Number.isNaN(date.getTime()) ? new Date() : date, 0);
}

function saleBusinessDate(clientCreatedAt: string, serverReceivedAt: string, cutoffHour: number): string {
  const clientDate = new Date(clientCreatedAt);
  const serverDate = new Date(serverReceivedAt);
  if (Number.isNaN(clientDate.getTime())) return bangkokBusinessDate(serverDate, cutoffHour);
  const diffMinutes = Math.abs(serverDate.getTime() - clientDate.getTime()) / 60_000;
  return bangkokBusinessDate(diffMinutes < 10 ? serverDate : clientDate, cutoffHour);
}

function hasClockDrift(clientCreatedAt: string, serverReceivedAt: string): boolean {
  const clientDate = new Date(clientCreatedAt);
  const serverDate = new Date(serverReceivedAt);
  if (Number.isNaN(clientDate.getTime())) return false;
  return Math.abs(serverDate.getTime() - clientDate.getTime()) > 48 * 60 * 60_000;
}

function reopenReconciliationIfNeeded(state: LocalState, branch_id: BranchId, business_date: string, serverBusinessDate: string): boolean {
  if (business_date >= serverBusinessDate) return false;
  const rows = state.reconciliations.filter((row) => row.branch_id === branch_id && row.business_date === business_date && row.status === "reconciled");
  rows.forEach((row) => {
    row.status = "reopened";
    row.note = row.note ? `${row.note}\nLate-arriving sale reopened this day.` : "Late-arriving sale reopened this day.";
  });
  return rows.length > 0;
}

function addAuditFlag(current: AuditFlag, next: AuditFlagCode): AuditFlag {
  const flags = String(current || "").split(",").filter(Boolean);
  if (!flags.includes(next)) flags.push(next);
  return flags.join(",");
}

function addSaleToSummary(state: LocalState, sale: Sale): void {
  const summary = ensureDailySummary(state, sale.branch_id, sale.business_date);
  summary[`rev_${sale.sale_type}`] += sale.total_amount;
  summary[paymentKey(sale.payment_method)] += sale.total_amount;
  summary.cogs_total += sale.total_cogs;
  summary.bill_count += 1;
  summary.last_rebuilt_at = nowIso();
}

function removeSaleFromSummary(state: LocalState, sale: Sale): void {
  const summary = ensureDailySummary(state, sale.branch_id, sale.business_date);
  summary[`rev_${sale.sale_type}`] = Math.max(0, summary[`rev_${sale.sale_type}`] - sale.total_amount);
  summary[paymentKey(sale.payment_method)] = Math.max(0, summary[paymentKey(sale.payment_method)] - sale.total_amount);
  summary.cogs_total = Math.max(0, summary.cogs_total - sale.total_cogs);
  summary.bill_count = Math.max(0, summary.bill_count - 1);
  summary.void_count += 1;
  summary.last_rebuilt_at = nowIso();
}

function recordMovement(
  state: LocalState,
  params: { branch_id: BranchId; lot_id: string; item_code: string; type: import("../types").StockMovement["type"]; qty_change: number; value_change: number; ref_id: string }
): void {
  state.stockMovements.push({
    id: makeId("MOV"),
    date: nowIso(),
    branch_id: params.branch_id,
    lot_id: params.lot_id,
    item_code: params.item_code,
    type: params.type,
    qty_change: params.qty_change,
    value_change: params.value_change,
    ref_id: params.ref_id
  });
}

function productCode(state: LocalState, product_id: string): string {
  return state.products.find((item) => item.id === product_id)?.item_code || product_id;
}

function materialCode(state: LocalState, material_id: string): string {
  return state.rawMaterials.find((item) => item.id === material_id)?.item_code || material_id;
}

function consumeFinishedFIFO(state: LocalState, branch_id: BranchId, product_id: string, qtyNeeded: number, sortByExpiry = false) {
  const lots = state.finishedLots
    .filter((lot) => lot.branch_id === branch_id && lot.product_id === product_id && lot.qty_remaining > 0)
    .sort((a, b) => (sortByExpiry ? a.expiry_date.localeCompare(b.expiry_date) : a.received_date.localeCompare(b.received_date)));
  return consumeFifo(lots, qtyNeeded);
}

function restoreFinishedLots(state: LocalState, breakdown: LotBreakdown[]): void {
  breakdown.forEach((piece) => {
    const lot = state.finishedLots.find((item) => item.lot_id === piece.lot_id);
    if (lot) lot.qty_remaining += piece.qty;
  });
}

function consumeRawFIFO(state: LocalState, branch_id: BranchId, material_id: string, qtyNeeded: number) {
  const lots = state.rawLots
    .filter((lot) => lot.branch_id === branch_id && lot.material_id === material_id && lot.qty_remaining > 0)
    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
  return consumeFifo(lots, qtyNeeded);
}

function previewRawFIFO(state: LocalState, branch_id: BranchId, material_id: string, qtyNeeded: number) {
  const lots = state.rawLots
    .filter((lot) => lot.branch_id === branch_id && lot.material_id === material_id && lot.qty_remaining > 0)
    .sort((a, b) => a.purchase_date.localeCompare(b.purchase_date));
  return previewFifo(lots, qtyNeeded);
}

function activeSales(state: LocalState) {
  return state.sales.filter((sale) => sale.status === "active");
}

function buildLocalSnapshot(state: LocalState, session: Session): LocalState {
  const products = state.products.map(withoutImageData);
  if (session.role !== "staff") return { ...state, products };
  const branch_id = session.branch_id;
  const saleIds = new Set(
    state.sales
      .filter((sale) => sale.branch_id === branch_id && sale.device_id === session.device_id)
      .map((sale) => sale.id)
  );
  return {
    ...state,
    products,
    users: [],
    finishedLots: state.finishedLots.filter((lot) => lot.branch_id === branch_id),
    rawLots: [],
    recipes: [],
    recipeItems: [],
    sales: state.sales.filter((sale) => saleIds.has(sale.id)),
    saleItems: state.saleItems.filter((item) => saleIds.has(item.sale_id)),
    wastage: state.wastage.filter((row) => row.branch_id === branch_id),
    goodsReceipts: [],
    productionOrders: [],
    stockAdjustments: [],
    reconciliations: [],
    expenses: [],
    dailySummary: state.dailySummary.filter((row) => row.branch_id === branch_id),
    priceHistory: [],
    devices: state.devices.filter((device) => device.device_id === session.device_id),
    errorLog: [],
    auditLog: []
  };
}

function withoutImageData(product: Product): Product {
  const { image_data: _image_data, ...rest } = product;
  return rest;
}

function buildReportSummary(state: LocalState, branch: BranchId | "ALL", date_from?: string, date_to?: string): ReportSummary {
  const inBranch = (branch_id: BranchId) => branch === "ALL" || branch_id === branch;
  const inDate = (date: string) => (!date_from || date >= date_from) && (!date_to || date <= date_to);
  const inExpenseMonth = (month: string) => {
    const fromMonth = (date_from || "0000-01-01").slice(0, 7);
    const toMonth = (date_to || "9999-12-31").slice(0, 7);
    return month >= fromMonth && month <= toMonth;
  };
  const sales = activeSales(state).filter((sale) => inBranch(sale.branch_id) && inDate(sale.business_date));
  const wastage = state.wastage.filter((item) => inBranch(item.branch_id) && inDate(bangkokDateFromIso(item.created_at)));
  const expenses = state.expenses.filter((item) => inBranch(item.branch_id) && inExpenseMonth(item.expense_month));
  const revenue_by_type = { normal: 0, discount: 0, freebie: 0, staff: 0 };
  const revenue_by_payment = { QR1: 0, QR2: 0, GRAB: 0, CASH: 0, THAI_HELP_THAI: 0, OTHER: 0 };
  const expense_breakdown: ReportSummary["expense_breakdown"] = {
    salary: 0,
    utility_water: 0,
    utility_electric: 0,
    maintenance: 0,
    supply_purchase: 0,
    other: 0
  };

  sales.forEach((sale) => {
    revenue_by_type[sale.sale_type] += sale.total_amount;
    revenue_by_payment[sale.payment_method] += sale.total_amount;
  });
  expenses.forEach((expense) => {
    expense_breakdown[expense.expense_type] += expense.amount;
  });

  const gross_revenue = sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  const cogs = sales.reduce((sum, sale) => sum + sale.total_cogs, 0);
  const wastage_value = wastage.reduce((sum, item) => sum + item.total_cost_value, 0);
  const total_expenses = Object.values(expense_breakdown).reduce((sum, value) => sum + value, 0);
  const byDate = new Map<string, { revenue: number; cogs: number }>();
  sales.forEach((sale) => {
    const row = byDate.get(sale.business_date) || { revenue: 0, cogs: 0 };
    row.revenue += sale.total_amount;
    row.cogs += sale.total_cogs;
    byDate.set(sale.business_date, row);
  });

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

function processSale(state: LocalState, session: Session, saleDraft: PendingSale) {
  if (state.sales.some((sale) => sale.id === saleDraft.id) || state.saleItems.some((item) => item.sale_id === saleDraft.id)) {
    return { id: saleDraft.id, status: "duplicate" };
  }
  validateSaleDraft(state, saleDraft);

  const branch_id = enforceBranch(session, saleDraft.branch_id);
  const serverNow = nowIso();
  const business_date = saleBusinessDate(saleDraft.client_created_at, serverNow, state.config.day_cutoff_hour);
  const serverBusinessDate = bangkokBusinessDate(new Date(serverNow), state.config.day_cutoff_hour);
  const lateAfterReconcile = reopenReconciliationIfNeeded(state, branch_id, business_date, serverBusinessDate);
  const saleItems: SaleItem[] = [];
  let total_cogs = 0;
  let flag: AuditFlag = "";
  if (hasClockDrift(saleDraft.client_created_at, serverNow)) flag = addAuditFlag(flag, "CLOCK_DRIFT");
  if (lateAfterReconcile) flag = addAuditFlag(flag, "LATE_SYNC");

  // SUSPICIOUS rule: staff buying too frequently in one day (Grand's 7.4)
  if (saleDraft.sale_type === "staff") {
    const staffSalesToday = state.sales.filter((s) => s.sale_type === "staff" && s.user_id === session.user_id && s.business_date === business_date && s.status === "active").length;
    if (staffSalesToday + 1 > (state.config.suspicious_staffsale_per_day || 5)) {
      flag = addAuditFlag(flag, "SUSPICIOUS");
    }
  }

  saleDraft.items.forEach((item) => {
    const product = state.products.find((entry) => entry.id === item.product_id);
    const listPrice = saleDraft.sale_type === "staff" ? product?.staff_price : product?.sell_price;
    if (product && saleDraft.sale_type !== "freebie" && !item.is_freebie && item.unit_price !== listPrice) {
      flag = addAuditFlag(flag, "PRICE_OVERRIDE");
      if (item.unit_price < Math.round(Number(listPrice || 0) * (state.config.suspicious_price_pct || 50) / 100)) {
        flag = addAuditFlag(flag, "SUSPICIOUS");
      }
    }
    const consumed = consumeFinishedFIFO(state, branch_id, item.product_id, item.qty);
    if (consumed.shortBy > 0) flag = addAuditFlag(flag, "OVERSOLD");
    const unitCost = item.qty > 0 ? Math.round(consumed.totalCost / item.qty) : 0;
    total_cogs += consumed.totalCost;
    consumed.breakdown.forEach((piece) => {
      recordMovement(state, { branch_id, lot_id: piece.lot_id, item_code: productCode(state, item.product_id), type: "sale", qty_change: -piece.qty, value_change: -piece.qty * piece.unit_cost, ref_id: saleDraft.id });
    });
    saleItems.push({
      id: item.id,
      sale_id: saleDraft.id,
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price,
      is_freebie: item.is_freebie,
      unit_cost: unitCost,
      lot_breakdown: consumed.breakdown
    });
  });

  const sale: Sale = {
    id: saleDraft.id,
    branch_id,
    user_id: session.user_id,
    sale_type: saleDraft.sale_type,
    payment_method: saleDraft.payment_method,
    total_amount: saleDraft.total_amount,
    cash_received: saleDraft.cash_received,
    change_given: saleDraft.change_given,
    total_cogs,
    client_created_at: saleDraft.client_created_at,
    server_received_at: serverNow,
    business_date,
    synced_at: serverNow,
    reconcile_status: "pending",
    status: "active",
    late_after_reconcile: lateAfterReconcile,
    device_id: session.device_id
  };
  state.sales.push(sale);
  state.saleItems.push(...saleItems);
  addSaleToSummary(state, sale);
  audit(state, session, "SALE_CREATE", sale.id, { sale_type: sale.sale_type, total_amount: sale.total_amount }, true, flag);
  return { id: saleDraft.id, status: "ok", flag };
}

function validateSaleDraft(state: LocalState, saleDraft: PendingSale): void {
  if (!saleDraft.id || !saleDraft.items.length) throw new Error("BAD_REQUEST");
  if (!["normal", "discount", "freebie", "staff"].includes(saleDraft.sale_type)) throw new Error("BAD_SALE_TYPE");
  if (!paymentMethods.includes(saleDraft.payment_method)) throw new Error("BAD_PAYMENT");
  if (!Number.isInteger(saleDraft.total_amount) || saleDraft.total_amount < 0) throw new Error("BAD_TOTAL");
  if (!Number.isInteger(saleDraft.cash_received) || !Number.isInteger(saleDraft.change_given) || saleDraft.cash_received < 0 || saleDraft.change_given < 0) throw new Error("BAD_CASH");
  saleDraft.items.forEach((item) => {
    if (!state.products.some((product) => product.id === item.product_id)) throw new Error("BAD_PRODUCT");
    if (!Number.isInteger(item.qty) || !Number.isInteger(item.unit_price) || item.qty <= 0 || item.unit_price < 0) throw new Error("BAD_ITEM");
  });
  const serverTotal = saleDraft.items.reduce((sum, item) => sum + item.qty * item.unit_price, 0);
  if (serverTotal !== saleDraft.total_amount) throw new Error("TOTAL_MISMATCH");
  if (saleDraft.payment_method === "CASH" && saleDraft.cash_received < saleDraft.total_amount) throw new Error("INVALID_CASH");
}

function validateBatchSize(sales: PendingSale[]): void {
  if (sales.length > MAX_SALES_PER_BATCH) throw new Error("BATCH_TOO_LARGE");
  sales.forEach((sale) => {
    if ((sale.items || []).length > MAX_ITEMS_PER_SALE) throw new Error("BATCH_TOO_LARGE");
  });
}

function approveOwnerPin(state: LocalState, session: Session, pin: string, refId: string) {
  const owners = state.users.filter((user) => user.role === "owner" && user.active && user.approval_pin);
  const locked = owners.find((owner) => owner.pin_locked_until && new Date(owner.pin_locked_until) > new Date());
  if (locked) {
    audit(state, session, "PIN_LOCKED", refId || locked.user_id, { user_id: locked.user_id, pin_locked_until: locked.pin_locked_until }, false, "SUSPICIOUS");
    throw new Error("PIN_LOCKED");
  }
  const owner = owners.find((item) => item.approval_pin === pin);
  if (owner) {
    owner.pin_failed_attempts = 0;
    owner.pin_locked_until = "";
    return owner;
  }
  owners.forEach((entry) => {
    const attempts = Number(entry.pin_failed_attempts || 0) + 1;
    entry.pin_failed_attempts = attempts;
    entry.pin_locked_until = attempts >= state.config.login_lockout_attempts
      ? new Date(Date.now() + state.config.lockout_minutes * 60_000).toISOString()
      : "";
  });
  audit(state, session, "PIN_FAILED", refId || "OWNER_PIN", { failed_attempts: owners[0]?.pin_failed_attempts || 1 }, false, "SUSPICIOUS");
  return null;
}

export function nextItemCode(state: LocalState, prefix: string): string {
  const codes = [
    ...state.products.map((item) => item.item_code),
    ...state.rawMaterials.map((item) => item.item_code),
    ...state.supplyItems.map((item) => item.item_code)
  ].filter((code) => typeof code === "string" && code.indexOf(prefix + "-") === 0);
  let max = 0;
  codes.forEach((code) => {
    const n = Number(code.slice(prefix.length + 1));
    if (Number.isFinite(n) && n > max) max = n;
  });
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

function weightedAvgRawCost(state: LocalState, material_id: string, branch_id?: BranchId): number {
  const lots = state.rawLots.filter((lot) => lot.material_id === material_id && lot.qty_remaining > 0 && (!branch_id || lot.branch_id === branch_id));
  const qty = lots.reduce((sum, lot) => sum + lot.qty_remaining, 0);
  if (qty <= 0) return 0;
  return Math.round(lots.reduce((sum, lot) => sum + lot.qty_remaining * lot.unit_cost, 0) / qty);
}

function latestFinishedCost(state: LocalState, product_id: string): number {
  const lots = state.finishedLots
    .filter((lot) => lot.product_id === product_id)
    .sort((a, b) => b.received_date.localeCompare(a.received_date));
  return lots[0]?.unit_cost || 0;
}

function recipeUnitCost(state: LocalState, product_id: string, branch_id: BranchId): number {
  const recipe = state.recipes.find((item) => item.product_id === product_id && item.active);
  if (!recipe) return 0;
  const items = state.recipeItems.filter((item) => item.recipe_id === recipe.id);
  let total = 0;
  items.forEach((item) => {
    total += item.qty_per_unit * weightedAvgRawCost(state, item.material_id, branch_id);
  });
  return Math.round(total);
}

export function masterItemCost(state: LocalState, item: { type: string; source_id?: string; item_code?: string }, branch_id: BranchId = "BR-KASET"): number {
  const id = item.source_id;
  if (!id) return 0;
  if (item.type === "PTG") return latestFinishedCost(state, id);
  if (item.type === "PGH") return recipeUnitCost(state, id, branch_id);
  if (item.type === "RM" || item.type === "PK") return weightedAvgRawCost(state, id, branch_id);
  return 0;
}

function buildMasterItems(state: LocalState): import("../types").MasterItem[] {
  const items: import("../types").MasterItem[] = [];
  state.products.forEach((product) => {
    items.push({
      id: product.id,
      item_code: product.item_code,
      name_th: product.name_th,
      name_my: product.name_my,
      type: product.source_type === "parent" ? "PTG" : "PGH",
      category: product.category,
      unit: "กล่อง/ชิ้น",
      active: product.active,
      sell_price: product.sell_price,
      staff_price: product.staff_price,
      source_id: product.id
    });
  });
  state.rawMaterials.forEach((material) => {
    items.push({
      id: material.id,
      item_code: material.item_code,
      name_th: material.name_th,
      name_my: material.name_my,
      type: material.is_packaging ? "PK" : "RM",
      category: material.warehouse,
      unit: material.display_unit,
      active: material.active,
      source_id: material.id
    });
  });
  state.supplyItems.forEach((supply) => {
    items.push({
      id: supply.id,
      item_code: supply.item_code,
      name_th: supply.name_th,
      name_my: supply.name_my,
      type: "SUP",
      category: supply.category,
      unit: supply.unit,
      active: supply.active,
      source_id: supply.id
    });
  });
  return items;
}

interface ItemSavePayload {
  type: import("../types").ItemType;
  id?: string;
  name_th: string;
  name_my?: string;
  active?: boolean;
  // product
  category?: string;
  source_type?: import("../types").ProductSource;
  sell_price?: number;
  staff_price?: number;
  shelf_life_days?: number;
  is_perishable?: boolean;
  image_data?: string;
  // raw
  warehouse?: import("../types").Warehouse;
  base_unit?: import("../types").BaseUnit;
  display_unit?: string;
  display_factor?: number;
  // supply
  unit?: string;
}

function saveMasterItem(state: LocalState, session: Session, payload: ItemSavePayload): { item_code: string; id: string } {
  const type = payload.type;
  if (type === "PTG" || type === "PGH") {
    validateImageData(payload.image_data);
    const existing = payload.id ? state.products.find((item) => item.id === payload.id) : undefined;
    if (existing) {
      // PriceHistory on price change
      (["sell_price", "staff_price"] as const).forEach((field) => {
        const next = payload[field];
        if (typeof next === "number" && next !== existing[field]) {
          state.priceHistory.push({
            id: makeId("PRH"),
            product_id: existing.id,
            field,
            old_value: existing[field],
            new_value: next,
            changed_by: session.user_id,
            changed_at: nowIso()
          });
          audit(state, session, "PRICE_CHANGE", existing.id, { field, old_value: existing[field], new_value: next }, true);
          existing[field] = next;
        }
      });
      existing.name_th = payload.name_th ?? existing.name_th;
      existing.name_my = payload.name_my ?? existing.name_my;
      if (payload.category) existing.category = payload.category as import("../types").ProductCategory;
      if (typeof payload.shelf_life_days === "number") existing.shelf_life_days = payload.shelf_life_days;
      if (typeof payload.is_perishable === "boolean") existing.is_perishable = payload.is_perishable;
      if (typeof payload.image_data === "string") existing.image_data = payload.image_data;
      if (typeof payload.active === "boolean") existing.active = payload.active;
      audit(state, session, "ITEM_SAVE", existing.id, { item_code: existing.item_code, type }, true);
      state.config.catalog_version += 1;
      return { item_code: existing.item_code, id: existing.id };
    }
    const item_code = nextItemCode(state, type);
    const id = makeId("PRD");
    state.products.push({
      id,
      item_code,
      name_th: payload.name_th,
      name_my: payload.name_my || payload.name_th,
      image_url: "",
      image_data: payload.image_data || "",
      category: (payload.category as import("../types").ProductCategory) || "rice_box",
      source_type: type === "PTG" ? "parent" : "self_produced",
      sell_price: payload.sell_price || 0,
      staff_price: payload.staff_price || 0,
      shelf_life_days: payload.shelf_life_days || 1,
      is_perishable: payload.is_perishable ?? true,
      active: payload.active ?? true
    });
    audit(state, session, "ITEM_SAVE", id, { item_code, type }, true);
    state.config.catalog_version += 1;
    return { item_code, id };
  }

  if (type === "RM" || type === "PK") {
    const existing = payload.id ? state.rawMaterials.find((item) => item.id === payload.id) : undefined;
    if (existing) {
      existing.name_th = payload.name_th ?? existing.name_th;
      existing.name_my = payload.name_my ?? existing.name_my;
      if (payload.warehouse) existing.warehouse = payload.warehouse;
      if (payload.base_unit) existing.base_unit = payload.base_unit;
      if (payload.display_unit) existing.display_unit = payload.display_unit;
      if (typeof payload.display_factor === "number") existing.display_factor = payload.display_factor;
      if (typeof payload.active === "boolean") existing.active = payload.active;
      existing.is_packaging = type === "PK";
      audit(state, session, "ITEM_SAVE", existing.id, { item_code: existing.item_code, type }, true);
      state.config.catalog_version += 1;
      return { item_code: existing.item_code, id: existing.id };
    }
    const item_code = nextItemCode(state, type);
    const id = makeId("RAW");
    state.rawMaterials.push({
      id,
      item_code,
      name_th: payload.name_th,
      name_my: payload.name_my || payload.name_th,
      warehouse: payload.warehouse || (type === "PK" ? "dry_supply" : "raw_fresh"),
      base_unit: payload.base_unit || "piece",
      display_unit: payload.display_unit || "ชิ้น",
      display_factor: payload.display_factor || 1,
      is_packaging: type === "PK",
      active: payload.active ?? true
    });
    audit(state, session, "ITEM_SAVE", id, { item_code, type }, true);
    state.config.catalog_version += 1;
    return { item_code, id };
  }

  // SUP
  const existing = payload.id ? state.supplyItems.find((item) => item.id === payload.id) : undefined;
  if (existing) {
    existing.name_th = payload.name_th ?? existing.name_th;
    existing.name_my = payload.name_my ?? existing.name_my;
    if (payload.category) existing.category = payload.category;
    if (payload.unit) existing.unit = payload.unit;
    if (typeof payload.active === "boolean") existing.active = payload.active;
    audit(state, session, "ITEM_SAVE", existing.id, { item_code: existing.item_code, type }, true);
    state.config.catalog_version += 1;
    return { item_code: existing.item_code, id: existing.id };
  }
  const item_code = nextItemCode(state, "SUP");
  const id = makeId("SUP");
  state.supplyItems.push({
    id,
    item_code,
    name_th: payload.name_th,
    name_my: payload.name_my || payload.name_th,
    category: payload.category || "general",
    unit: payload.unit || "ชิ้น",
    active: payload.active ?? true
  });
  audit(state, session, "ITEM_SAVE", id, { item_code, type }, true);
  state.config.catalog_version += 1;
  return { item_code, id };
}

function validateImageData(value?: string): void {
  if (!value) return;
  if (!value.startsWith("data:image/webp;base64,") || value.length > 45_000) throw new Error("BAD_IMAGE");
}

function readPayload<T>(payload: unknown): T {
  return payload as T;
}

export async function callLocalApi<TData = unknown>(request: ApiRequest): Promise<ApiResponse<TData>> {
  const state = loadState();
  const action = request.action;

  if (action === "login") {
    const payload = readPayload<{ user_id: string; password: string }>(request.payload);
    const user = state.users.find((item) => item.user_id === payload.user_id && item.active);
    const device = state.devices.find((item) => item.device_id === request.device_id);
    if (device?.status === "blocked") {
      audit(state, null, "DEVICE_BLOCKED", request.device_id, {}, false, "SUSPICIOUS");
      saveState(state);
      return err("DEVICE_BLOCKED", "อุปกรณ์นี้ถูกบล็อก") as ApiResponse<TData>;
    }
    if (!user) {
      audit(state, null, "LOGIN_FAILED", payload.user_id || "unknown", { user_id: payload.user_id }, false, "SUSPICIOUS");
      saveState(state);
      return err("INVALID_LOGIN", "รหัสไม่ถูกต้อง") as ApiResponse<TData>;
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      audit(state, null, "LOGIN_LOCKED", user.user_id, { locked_until: user.locked_until }, false, "SUSPICIOUS");
      saveState(state);
      return err("LOCKED_OUT", "ล็อกอินผิดเกินกำหนด กรุณารอแล้วลองใหม่") as ApiResponse<TData>;
    }
    if (user.password !== payload.password) {
      user.failed_attempts += 1;
      if (user.failed_attempts >= state.config.login_lockout_attempts) {
        user.locked_until = new Date(Date.now() + state.config.lockout_minutes * 60_000).toISOString();
      }
      audit(state, null, "LOGIN_FAILED", payload.user_id || "unknown", { user_id: payload.user_id, failed_attempts: user.failed_attempts, locked_until: user.locked_until }, false, "SUSPICIOUS");
      saveState(state);
      return err(user.locked_until ? "LOCKED_OUT" : "INVALID_LOGIN", user.locked_until ? "ล็อกอินผิดเกินกำหนด กรุณารอแล้วลองใหม่" : "รหัสไม่ถูกต้อง") as ApiResponse<TData>;
    }
    user.failed_attempts = 0;
    user.locked_until = undefined;
    const session: Session = {
      token: `LOCAL-${crypto.randomUUID()}`,
      user_id: user.user_id,
      display_name: user.display_name,
      role: user.role,
      branch_id: user.branch_id,
      device_id: request.device_id,
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString()
    };
    if (device) {
      device.last_seen = nowIso();
    } else {
      state.devices.push({
        device_id: request.device_id,
        label: `${user.display_name} local device`,
        branch_id: user.branch_id,
        first_seen: nowIso(),
        last_seen: nowIso(),
        status: "active"
      });
    }
    saveSession(session);
    audit(state, session, "LOGIN", user.user_id, { role: user.role }, true);
    saveState(state);
    return ok(session, state) as ApiResponse<TData>;
  }

  const session = getLocalSession(request.token);
  if (!session) {
    audit(state, null, "INVALID_TOKEN", action, {}, false, "SUSPICIOUS");
    saveState(state);
    return err("AUTH_EXPIRED", "Session หมดอายุ") as ApiResponse<TData>;
  }
  const sessionUser = state.users.find((user) => user.user_id === session.user_id);
  if (!sessionUser?.active) {
    revokeLocalSessionsForUser(session.user_id);
    audit(state, session, "INACTIVE_USER_TOKEN", action, {}, false, "SUSPICIOUS");
    saveState(state);
    return err("AUTH_EXPIRED", "บัญชีนี้ถูกปิดใช้งานแล้ว") as ApiResponse<TData>;
  }
  if (!isAllowed(session.role, action)) {
    audit(state, session, "FORBIDDEN_ATTEMPT", action, {}, false, "SUSPICIOUS");
    saveState(state);
    return err("FORBIDDEN", "สิทธิ์ไม่พอ") as ApiResponse<TData>;
  }

  try {
    let data: unknown;
    switch (action) {
      case "product.list":
        data = { products: state.products.filter((product) => product.active).map(withoutImageData), catalog_version: state.config.catalog_version };
        break;
      case "product.images":
        data = { images: state.products.filter((product) => session.role !== "staff" || product.active).map((product) => ({ id: product.id, image_data: product.image_data || "" })) };
        break;
      case "item.list":
        data = { items: buildMasterItems(state) };
        break;
      case "item.save": {
        const payload = readPayload<ItemSavePayload>(request.payload);
        data = saveMasterItem(state, session, payload);
        break;
      }
      case "app.snapshot":
        data = buildLocalSnapshot(state, session);
        break;
      case "stock.myBranch": {
        const branch_id = enforceBranch(session, readPayload<{ branch_id?: BranchId }>(request.payload).branch_id);
        data = state.finishedLots.filter((lot) => lot.branch_id === branch_id && lot.qty_remaining > 0);
        break;
      }
      case "sale.syncBatch": {
        const payload = readPayload<{ sales: PendingSale[] }>(request.payload);
        validateBatchSize(payload.sales || []);
        data = {
          results: payload.sales.map((sale) => {
            try {
              return processSale(state, session, sale);
            } catch (error) {
              audit(state, session, "SALE_REJECTED", sale.id, { message: error instanceof Error ? error.message : String(error) }, false, "SUSPICIOUS");
              return { id: sale.id, status: "rejected", code: error instanceof Error ? error.message : "SERVER_ERROR", message: error instanceof Error ? error.message : "Cannot sync sale" };
            }
          }),
          stock: state.finishedLots.filter((lot) => lot.branch_id === session.branch_id)
        };
        break;
      }
      case "sale.void": {
        const payload = readPayload<{ sale_id: string; reason: string }>(request.payload);
        const sale = state.sales.find((item) => item.id === payload.sale_id);
        if (!sale || sale.status === "voided") return err("NOT_FOUND", "ไม่พบบิล") as ApiResponse<TData>;
        if (sale.reconcile_status === "reconciled") return err("RECONCILED", "บิลนี้ปิดบัญชีแล้ว") as ApiResponse<TData>;
        const ageMinutes = (Date.now() - Date.parse(sale.server_received_at)) / 60_000;
        if (session.role === "staff" && (sale.user_id !== session.user_id || ageMinutes > state.config.void_window_minutes)) {
          return err("VOID_WINDOW_EXPIRED", "พนักงานยกเลิกได้เฉพาะบิลตัวเองภายใน 15 นาที") as ApiResponse<TData>;
        }
        state.saleItems.filter((item) => item.sale_id === sale.id).forEach((item) => {
          restoreFinishedLots(state, item.lot_breakdown);
          item.lot_breakdown.forEach((piece) => {
            recordMovement(state, { branch_id: sale.branch_id, lot_id: piece.lot_id, item_code: productCode(state, item.product_id), type: "void", qty_change: piece.qty, value_change: piece.qty * piece.unit_cost, ref_id: sale.id });
          });
        });
        sale.status = "voided";
        sale.void_reason = payload.reason;
        sale.voided_by = session.user_id;
        sale.voided_at = nowIso();
        removeSaleFromSummary(state, sale);
        audit(state, session, "SALE_VOID", sale.id, payload, true, "SUSPICIOUS");
        data = sale;
        break;
      }
      case "wastage.create": {
        const payload = readPayload<{ product_id: string; qty: number; branch_id?: BranchId }>(request.payload);
        const branch_id = enforceBranch(session, payload.branch_id);
        const qty = assertIntegerRange(payload.qty, "BAD_QTY", 1, MAX_QTY_PER_OPERATION);
        if (!state.products.some((product) => product.id === payload.product_id && product.active)) return err("BAD_PRODUCT", "ไม่พบสินค้า") as ApiResponse<TData>;
        const consumed = consumeFinishedFIFO(state, branch_id, payload.product_id, qty, true);
        const row: Wastage = {
          id: makeId("WST"),
          wastage_type: "finished",
          branch_id,
          user_id: session.user_id,
          product_id: payload.product_id,
          qty,
          total_cost_value: consumed.totalCost,
          lot_breakdown: consumed.breakdown,
          created_at: nowIso()
        };
        state.wastage.push(row);
        consumed.breakdown.forEach((piece) => {
          recordMovement(state, { branch_id, lot_id: piece.lot_id, item_code: productCode(state, payload.product_id), type: "wastage", qty_change: -piece.qty, value_change: -piece.qty * piece.unit_cost, ref_id: row.id });
        });
        ensureDailySummary(state, branch_id, todayBangkok()).wastage_value += row.total_cost_value;
        audit(state, session, "WASTAGE_CREATE", row.id, row, true, row.total_cost_value > (state.config.suspicious_wastage_value || 50000) ? "SUSPICIOUS" : "");
        data = row;
        break;
      }
      case "rawWastage.create": {
        const payload = readPayload<{ material_id: string; qty: number; branch_id?: BranchId }>(request.payload);
        const branch_id = enforceBranch(session, payload.branch_id);
        const qty = assertIntegerRange(payload.qty, "BAD_QTY", 1, MAX_QTY_PER_OPERATION);
        if (!state.rawMaterials.some((material) => material.id === payload.material_id && material.active)) return err("BAD_MATERIAL", "ไม่พบวัตถุดิบ") as ApiResponse<TData>;
        const consumed = consumeRawFIFO(state, branch_id, payload.material_id, qty);
        const row: Wastage = {
          id: makeId("WST"),
          wastage_type: "raw",
          branch_id,
          user_id: session.user_id,
          material_id: payload.material_id,
          qty,
          total_cost_value: consumed.totalCost,
          lot_breakdown: consumed.breakdown,
          created_at: nowIso()
        };
        state.wastage.push(row);
        consumed.breakdown.forEach((piece) => {
          recordMovement(state, { branch_id, lot_id: piece.lot_id, item_code: materialCode(state, payload.material_id), type: "wastage", qty_change: -piece.qty, value_change: -piece.qty * piece.unit_cost, ref_id: row.id });
        });
        ensureDailySummary(state, branch_id, bangkokBusinessDate(new Date(row.created_at), state.config.day_cutoff_hour)).wastage_value += row.total_cost_value;
        audit(state, session, "RAW_WASTAGE_CREATE", row.id, row, true);
        data = row;
        break;
      }
      case "stock.extendExpiry": {
        const payload = readPayload<{ lot_id: string }>(request.payload);
        const lot = state.finishedLots.find((item) => item.lot_id === payload.lot_id);
        if (!lot) return err("NOT_FOUND", "ไม่พบล็อต") as ApiResponse<TData>;
        if (session.role === "staff" && lot.branch_id !== session.branch_id) return err("FORBIDDEN", "ยืดอายุล็อตข้ามสาขาไม่ได้") as ApiResponse<TData>;
        const extendCount = Number(lot.extend_count || 0);
        if (session.role === "staff" && extendCount >= 2) return err("EXTEND_LIMIT", "ล็อตนี้ยืดอายุเกิน 2 ครั้ง ต้องให้ออฟฟิศหรือเจ้าของตรวจ") as ApiResponse<TData>;
        lot.expiry_date = dateOffsetBangkok(lot.expiry_date, 1);
        lot.extend_count = extendCount + 1;
        audit(state, session, "STOCK_EXTEND_EXPIRY", lot.lot_id, { expiry_date: lot.expiry_date, extend_count: lot.extend_count }, true, lot.extend_count > 2 ? "SUSPICIOUS" : "");
        data = lot;
        break;
      }
      case "goods.receive": {
        const payload = readPayload<{ branch_id: BranchId; product_id: string; qty: number; unit_cost: number; received_date: string }>(request.payload);
        if (payload.received_date > todayBangkok()) return err("FUTURE_DATE", "วันที่รับของอยู่ในอนาคต") as ApiResponse<TData>;
        if (payload.qty <= 0 || payload.unit_cost < 0) return err("BAD_REQUEST", "จำนวนหรือต้นทุนไม่ถูกต้อง") as ApiResponse<TData>;
        const product = state.products.find((item) => item.id === payload.product_id);
        if (!product) return err("BAD_PRODUCT", "ไม่พบสินค้า") as ApiResponse<TData>;
        const receipt = { id: makeId("GRC"), user_id: session.user_id, ...payload };
        state.goodsReceipts.push(receipt);
        const grcLotId = makeId("FLOT");
        state.finishedLots.push({
          lot_id: grcLotId,
          branch_id: payload.branch_id,
          product_id: payload.product_id,
          qty_in: payload.qty,
          qty_remaining: payload.qty,
          unit_cost: payload.unit_cost,
          received_date: payload.received_date,
          expiry_date: dateOffsetBangkok(payload.received_date, product.shelf_life_days || 1),
          source: "parent_receive",
          source_ref: receipt.id,
          extend_count: 0
        });
        recordMovement(state, { branch_id: payload.branch_id, lot_id: grcLotId, item_code: productCode(state, payload.product_id), type: "receive", qty_change: payload.qty, value_change: payload.qty * payload.unit_cost, ref_id: receipt.id });
        audit(state, session, "GOODS_RECEIVE", receipt.id, receipt, true);
        data = receipt;
        break;
      }
      case "rawlot.purchase": {
        const payload = readPayload<{ branch_id: BranchId; material_id: string; qty: number; total_cost: number; supplier_note: string; purchase_date: string; as_expense?: boolean; payment_channel?: PaymentMethod }>(request.payload);
        if (payload.purchase_date > todayBangkok()) return err("FUTURE_DATE", "วันที่ซื้ออยู่ในอนาคต") as ApiResponse<TData>;
        if (payload.qty <= 0 || payload.total_cost < 0) return err("BAD_REQUEST", "จำนวนหรือต้นทุนไม่ถูกต้อง") as ApiResponse<TData>;
        if (payload.payment_channel) assertPaymentMethod(payload.payment_channel);
        const lot: RawLot = {
          lot_id: makeId("RLOT"),
          material_id: payload.material_id,
          branch_id: payload.branch_id,
          qty_in: payload.qty,
          qty_remaining: payload.qty,
          unit_cost: Math.round(payload.total_cost / Math.max(payload.qty, 1)),
          purchase_date: payload.purchase_date,
          supplier_note: payload.supplier_note
        };
        state.rawLots.push(lot);
        recordMovement(state, { branch_id: payload.branch_id, lot_id: lot.lot_id, item_code: materialCode(state, payload.material_id), type: "receive", qty_change: payload.qty, value_change: payload.total_cost, ref_id: lot.lot_id });
        audit(state, session, "RAWLOT_PURCHASE", lot.lot_id, lot, true);
        // "ซื้อเข้าคลัง" (approve2 §5.2): mirror the cash outflow into Expenses, linked by ref_id = lot_id
        if (payload.as_expense) {
          const expense: Expense = {
            id: makeId("EXP"),
            branch_id: payload.branch_id,
            user_id: session.user_id,
            expense_type: "supply_purchase",
            amount: payload.total_cost,
            expense_month: payload.purchase_date.slice(0, 7),
            note: payload.supplier_note || "ซื้อเข้าคลัง",
            created_at: nowIso(),
            payment_channel: payload.payment_channel,
            purchase_qty: payload.qty,
            item_code: materialCode(state, payload.material_id),
            ref_id: lot.lot_id
          };
          state.expenses.push(expense);
          audit(state, session, "EXPENSE_CREATE", expense.id, { ref_id: lot.lot_id, source: "rawlot.purchase" }, true);
          data = { lot, expense };
        } else {
          data = lot;
        }
        break;
      }
      case "inventory.list":
        data = {
          finishedLots: state.finishedLots,
          rawLots: state.rawLots,
          rawMaterials: state.rawMaterials,
          products: state.products.map(withoutImageData)
        };
        break;
      case "production.preview": {
        const payload = readPayload<{ recipe_id: string; branch_id: BranchId; qty: number }>(request.payload);
        const recipe = state.recipes.find((item) => item.id === payload.recipe_id && item.active);
        if (!recipe) return err("NOT_FOUND", "ไม่พบสูตรที่ใช้งาน") as ApiResponse<TData>;
        const product = state.products.find((item) => item.id === recipe.product_id && item.active);
        if (!product) return err("BAD_PRODUCT", "สินค้าในสูตรถูกปิดหรือไม่พบ") as ApiResponse<TData>;
        const items = state.recipeItems.filter((item) => item.recipe_id === payload.recipe_id);
        let total = 0;
        const lines = items.map((item: RecipeItem) => {
          const needed = item.qty_per_unit * payload.qty;
          const preview = previewRawFIFO(state, payload.branch_id, item.material_id, needed);
          total += preview.totalCost;
          return { material_id: item.material_id, needed, shortBy: preview.shortBy, cost: preview.totalCost };
        });
        data = { lines, canRun: lines.every((line) => line.shortBy === 0), estimated_unit_cost: Math.round(total / Math.max(payload.qty, 1)) };
        break;
      }
      case "production.run": {
        const payload = readPayload<{ recipe_id: string; branch_id: BranchId; qty: number }>(request.payload);
        const recipe = state.recipes.find((item) => item.id === payload.recipe_id && item.active);
        if (!recipe) return err("NOT_FOUND", "ไม่พบสูตรที่ใช้งาน") as ApiResponse<TData>;
        const product = state.products.find((item) => item.id === recipe.product_id && item.active);
        if (!product) return err("BAD_PRODUCT", "สินค้าในสูตรถูกปิดหรือไม่พบ") as ApiResponse<TData>;
        const items = state.recipeItems.filter((item) => item.recipe_id === payload.recipe_id);
        const shortages = items
          .map((item) => ({ material_id: item.material_id, shortBy: previewRawFIFO(state, payload.branch_id, item.material_id, item.qty_per_unit * payload.qty).shortBy }))
          .filter((item) => item.shortBy > 0);
        if (shortages.length) return err("INSUFFICIENT_STOCK", "วัตถุดิบไม่พอ") as ApiResponse<TData>;
        const consumption_detail: Record<string, LotBreakdown[]> = {};
        let materialCost = 0;
        let packagingCost = 0;
        for (const item of items) {
          const material = state.rawMaterials.find((entry) => entry.id === item.material_id);
          const consumed = consumeRawFIFO(state, payload.branch_id, item.material_id, item.qty_per_unit * payload.qty);
          if (consumed.shortBy > 0) return err("INSUFFICIENT_STOCK", "วัตถุดิบไม่พอ") as ApiResponse<TData>;
          consumption_detail[item.material_id] = consumed.breakdown;
          if (material?.is_packaging) packagingCost += consumed.totalCost;
          else materialCost += consumed.totalCost;
          consumed.breakdown.forEach((piece) => {
            recordMovement(state, { branch_id: payload.branch_id, lot_id: piece.lot_id, item_code: materialCode(state, item.material_id), type: "production", qty_change: -piece.qty, value_change: -piece.qty * piece.unit_cost, ref_id: payload.recipe_id });
          });
        }
        const outputLotId = makeId("FLOT");
        const unitCost = Math.round((materialCost + packagingCost) / Math.max(payload.qty, 1));
        state.finishedLots.push({
          lot_id: outputLotId,
          branch_id: payload.branch_id,
          product_id: recipe.product_id,
          qty_in: payload.qty,
          qty_remaining: payload.qty,
          unit_cost: unitCost,
          received_date: todayBangkok(),
          expiry_date: dateOffsetBangkok(todayBangkok(), product.shelf_life_days || 1),
          source: "production",
          source_ref: outputLotId,
          extend_count: 0
        });
        const order = {
          id: makeId("PRO"),
          branch_id: payload.branch_id,
          user_id: session.user_id,
          recipe_id: payload.recipe_id,
          qty_produced: payload.qty,
          total_material_cost: materialCost,
          total_packaging_cost: packagingCost,
          unit_cost_locked: unitCost,
          consumption_detail,
          created_at: nowIso(),
          output_lot_id: outputLotId
        };
        state.productionOrders.push(order);
        recordMovement(state, { branch_id: payload.branch_id, lot_id: outputLotId, item_code: productCode(state, recipe.product_id), type: "production", qty_change: payload.qty, value_change: materialCost + packagingCost, ref_id: order.id });
        audit(state, session, "PRODUCTION_RUN", order.id, order, true);
        data = order;
        break;
      }
      case "stockAdjust.request": {
        const payload = readPayload<{ target_type: "raw_lot" | "finished_lot"; lot_id: string; qty_after: number; reason: string; owner_pin: string }>(request.payload);
        const owner = approveOwnerPin(state, session, payload.owner_pin, payload.lot_id);
        if (!owner) {
          saveState(state);
          return err("PIN_FAILED", "PIN เจ้าของไม่ถูกต้อง") as ApiResponse<TData>;
        }
        const lot = payload.target_type === "finished_lot" ? state.finishedLots.find((item) => item.lot_id === payload.lot_id) : state.rawLots.find((item) => item.lot_id === payload.lot_id);
        if (!lot) return err("NOT_FOUND", "ไม่พบล็อต") as ApiResponse<TData>;
        const before = lot.qty_remaining;
        lot.qty_remaining = payload.qty_after;
        const adjustItemCode = payload.target_type === "finished_lot"
          ? productCode(state, (lot as FinishedLot).product_id)
          : materialCode(state, (lot as RawLot).material_id);
        recordMovement(state, { branch_id: (lot as FinishedLot | RawLot).branch_id, lot_id: payload.lot_id, item_code: adjustItemCode, type: "adjust", qty_change: payload.qty_after - before, value_change: (payload.qty_after - before) * (lot.unit_cost || 0), ref_id: payload.lot_id });
        const adjustment = {
          id: makeId("ADJ"),
          user_id: session.user_id,
          approved_by: owner.user_id,
          target_type: payload.target_type,
          lot_id: payload.lot_id,
          qty_before: before,
          qty_after: payload.qty_after,
          reason: payload.reason,
          created_at: nowIso()
        };
        state.stockAdjustments.push(adjustment);
        audit(state, session, "STOCK_ADJUST", adjustment.id, adjustment, true, "SUSPICIOUS");
        data = adjustment;
        break;
      }
      case "reconcile.getDaily": {
        const payload = readPayload<{ branch_id: BranchId; business_date: string }>(request.payload);
        const system = paymentMethods.reduce((acc, method) => ({ ...acc, [method]: 0 }), {} as Record<PaymentMethod, number>);
        activeSales(state)
          .filter((sale) => sale.branch_id === payload.branch_id && sale.business_date === payload.business_date)
          .forEach((sale) => {
            system[sale.payment_method] += sale.total_amount;
          });
        data = {
          system,
          sales: state.sales.filter((sale) => sale.branch_id === payload.branch_id && sale.business_date === payload.business_date),
          reconciliation: state.reconciliations.find((item) => item.branch_id === payload.branch_id && item.business_date === payload.business_date)
        };
        break;
      }
      case "reconcile.confirm": {
        const payload = readPayload<{ branch_id: BranchId; business_date: string; actual: Record<PaymentMethod, number>; note: string }>(request.payload);
        const existing = state.reconciliations.find((item) => item.branch_id === payload.branch_id && item.business_date === payload.business_date);
        if (existing && existing.status !== "reopened") return err("ALREADY_RECONCILED", "วันนี้ปิดบัญชีไปแล้ว") as ApiResponse<TData>;
        const system = paymentMethods.reduce((acc, method) => ({ ...acc, [method]: 0 }), {} as Record<PaymentMethod, number>);
        activeSales(state)
          .filter((sale) => sale.branch_id === payload.branch_id && sale.business_date === payload.business_date)
          .forEach((sale) => {
            system[sale.payment_method] += sale.total_amount;
            sale.reconcile_status = "reconciled";
          });
        const diff_total = paymentMethods.reduce((sum, method) => sum + (payload.actual[method] || 0) - system[method], 0);
        if (diff_total !== 0 && !payload.note.trim()) return err("NOTE_REQUIRED", "ยอดไม่ตรงต้องกรอกหมายเหตุ") as ApiResponse<TData>;
        const row = {
          id: existing?.id || makeId("RCN"),
          branch_id: payload.branch_id,
          business_date: payload.business_date,
          system,
          actual: payload.actual,
          diff_total,
          status: diff_total === 0 ? "reconciled" : "mismatch",
          reconciled_by: session.user_id,
          reconciled_at: nowIso(),
          note: payload.note
        } satisfies LocalState["reconciliations"][number];
        state.reconciliations = state.reconciliations.filter((item) => item.id !== row.id);
        state.reconciliations.push(row);
        audit(state, session, "RECONCILE_CONFIRM", row.id, row, true, diff_total === 0 ? "" : "SUSPICIOUS");
        data = row;
        break;
      }
      case "expense.create": {
        const payload = readPayload<Omit<Expense, "id" | "user_id" | "created_at">>(request.payload);
        assertExpenseType(payload.expense_type);
        if (payload.payment_channel) assertPaymentMethod(payload.payment_channel);
        if (!Number.isInteger(Number(payload.amount)) || Number(payload.amount) <= 0) return err("INVALID_AMOUNT", "จำนวนเงินไม่ถูกต้อง") as ApiResponse<TData>;
        const row: Expense = { ...payload, id: makeId("EXP"), user_id: session.user_id, created_at: nowIso() };
        state.expenses.push(row);
        audit(state, session, "EXPENSE_CREATE", row.id, row, true);
        data = row;
        break;
      }
      case "expense.list":
        data = state.expenses;
        break;
      case "recipe.list":
        data = { recipes: state.recipes, recipeItems: state.recipeItems };
        break;
      case "recipe.save": {
        const payload = readPayload<{ recipe_id?: string; product_id: string; name: string; items: { material_id: string; qty_per_unit: number }[] }>(request.payload);
        const recipeId = makeId("RCP");
        state.recipes = state.recipes.map((item) => (item.product_id === payload.product_id && item.active ? { ...item, active: false } : item));
        state.recipes.push({ id: recipeId, product_id: payload.product_id, name: payload.name, active: true });
        state.recipeItems.push(...payload.items.map((item) => ({ id: makeId("RCI"), recipe_id: recipeId, ...item })));
        audit(state, session, "RECIPE_SAVE", recipeId, payload, true);
        data = { recipe_id: recipeId };
        break;
      }
      case "report.summary": {
        const payload = readPayload<{ branch: BranchId | "ALL"; date_from?: string; date_to?: string }>(request.payload);
        data = buildReportSummary(state, payload.branch, payload.date_from, payload.date_to);
        break;
      }
      case "report.financialStatement": {
        const summary = buildReportSummary(state, "ALL");
        const inventoryValue =
          state.finishedLots.reduce((sum, lot) => sum + lot.qty_remaining * lot.unit_cost, 0) +
          state.rawLots.reduce((sum, lot) => sum + lot.qty_remaining * lot.unit_cost, 0);
        data = {
          generated_at: nowIso(),
          parts: ["Part I Business Overview", "Part II Branch Performance", "Part III Financial Statements"],
          income_statement: summary,
          balance_sheet: {
            inventory_assets: inventoryValue,
            cash_and_bank_proxy: summary.gross_revenue,
            owner_equity_proxy: summary.net_profit + inventoryValue
          }
        };
        break;
      }
      case "audit.query": {
        const payload = readPayload<{ feature_group?: FeatureGroup; flag?: AuditFlag; branch_id?: BranchId }>(request.payload);
        data = state.auditLog.filter((row) => {
          const byFeature = !payload.feature_group || row.feature_group === payload.feature_group;
          const byFlag = !payload.flag || String(row.flag || "").split(",").includes(payload.flag);
          const byBranch = !payload.branch_id || payload.branch_id === "ALL" || row.branch_id === payload.branch_id;
          return byFeature && byFlag && byBranch;
        });
        break;
      }
      case "user.manage": {
        const payload = readPayload<{
          mode: "block_device" | "unblock_device" | "set_config" | "add_user" | "update_user" | "reset_password" | "set_pin" | "force_logout";
          device_id?: string;
          config?: Partial<LocalState["config"]>;
          user?: Partial<import("../types").User> & { user_id?: string; password?: string };
          id?: string;
          password?: string;
          approval_pin?: string;
        }>(request.payload);
        if (session.role !== "owner") {
          audit(state, session, "FORBIDDEN_ATTEMPT", action, payload.mode, false, "SUSPICIOUS");
          return err("FORBIDDEN", "เฉพาะเจ้าของจัดการผู้ใช้ได้") as ApiResponse<TData>;
        }
        if (payload.mode === "set_config" && payload.config) {
          state.config = { ...state.config, ...payload.config };
          audit(state, session, "CONFIG_CHANGE", "CONFIG", payload.config, true);
        }
        if ((payload.mode === "block_device" || payload.mode === "unblock_device") && payload.device_id) {
          const device = state.devices.find((item) => item.device_id === payload.device_id);
          if (device) device.status = payload.mode === "block_device" ? "blocked" : "active";
          audit(state, session, "DEVICE_STATUS_CHANGE", payload.device_id, payload.mode, true, "SUSPICIOUS");
        }
        if (payload.mode === "add_user" && payload.user?.user_id) {
          if (state.users.some((item) => item.user_id === payload.user!.user_id)) {
            return err("DUPLICATE_USER", "มี user_id นี้แล้ว") as ApiResponse<TData>;
          }
          const newUser: import("../types").User = {
            id: makeId("USR"),
            user_id: payload.user.user_id,
            password: payload.user.password || "changeme",
            display_name: payload.user.display_name || payload.user.user_id,
            role: payload.user.role || "staff",
            branch_id: payload.user.branch_id || "BR-KASET",
            active: true,
            approval_pin: payload.user.approval_pin,
            failed_attempts: 0,
            pin_failed_attempts: 0,
            pin_locked_until: ""
          };
          state.users.push(newUser);
          audit(state, session, "USER_CREATE", newUser.id, { user_id: newUser.user_id, role: newUser.role, branch_id: newUser.branch_id }, true);
        }
        if (payload.mode === "update_user" && payload.id) {
          const user = state.users.find((item) => item.id === payload.id);
          if (!user) return err("NOT_FOUND", "ไม่พบผู้ใช้") as ApiResponse<TData>;
          if (payload.user?.display_name !== undefined) user.display_name = payload.user.display_name;
          if (payload.user?.role) user.role = payload.user.role;
          if (payload.user?.branch_id) user.branch_id = payload.user.branch_id;
          if (typeof payload.user?.active === "boolean") {
            user.active = payload.user.active;
            if (!payload.user.active) revokeLocalSessionsForUser(user.user_id);
          }
          audit(state, session, "USER_UPDATE", user.id, payload.user, true);
        }
        if (payload.mode === "reset_password" && payload.id && payload.password) {
          const user = state.users.find((item) => item.id === payload.id);
          if (!user) return err("NOT_FOUND", "ไม่พบผู้ใช้") as ApiResponse<TData>;
          user.password = payload.password;
          user.failed_attempts = 0;
          user.locked_until = undefined;
          audit(state, session, "USER_RESET_PASSWORD", user.id, { user_id: user.user_id }, true, "SUSPICIOUS");
        }
        if (payload.mode === "set_pin" && payload.id && payload.approval_pin) {
          const user = state.users.find((item) => item.id === payload.id);
          if (!user) return err("NOT_FOUND", "ไม่พบผู้ใช้") as ApiResponse<TData>;
          user.approval_pin = payload.approval_pin;
          user.pin_failed_attempts = 0;
          user.pin_locked_until = "";
          audit(state, session, "USER_SET_PIN", user.id, { user_id: user.user_id }, true, "SUSPICIOUS");
        }
        if (payload.mode === "force_logout" && payload.id) {
          const user = state.users.find((item) => item.id === payload.id);
          if (user) {
            revokeLocalSessionsForUser(user.user_id);
            audit(state, session, "USER_FORCE_LOGOUT", user.id, { user_id: user.user_id }, true, "SUSPICIOUS");
          }
        }
        data = { devices: state.devices, config: state.config, users: state.users.map((item) => ({ ...item, password: "***", approval_pin: item.approval_pin ? "***" : undefined })) };
        break;
      }
      case "log.clientError": {
        const payload = readPayload<{ message: string; stack?: string; url?: string }>(request.payload);
        const today = todayBangkok();
        const deviceErrorsToday = state.errorLog.filter((entry) => entry.device_id === session.device_id && bangkokDateFromIso(entry.created_at) === today).length;
        if (deviceErrorsToday >= MAX_ERROR_LOG_PER_DEVICE_DAY) return err("ERROR_LOG_RATE_LIMITED", "บันทึก error ของเครื่องนี้เกินโควตาวันนี้") as ApiResponse<TData>;
        const row = {
          id: makeId("ERR"),
          device_id: session.device_id,
          user_id: session.user_id,
          app_version: "0.1.0-local",
          message: payload.message.slice(0, 300),
          stack: (payload.stack || "").slice(0, 1000),
          url: payload.url || (typeof location === "undefined" ? "" : location.href),
          created_at: nowIso()
        };
        state.errorLog.push(row);
        data = row;
        break;
      }
      default:
        return err("NOT_IMPLEMENTED", `ยังไม่ได้ implement action ${action}`) as ApiResponse<TData>;
    }
    saveState(state);
    return ok(data as TData, state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    audit(state, session, `${action.toUpperCase()}_FAILED`, action, { message }, false, "SUSPICIOUS");
    saveState(state);
    return err(message, message) as ApiResponse<TData>;
  }
}

export function buildSaleDraftFromCart(params: {
  cart: CartItem[];
  sale_type: PendingSale["sale_type"];
  payment_method: PaymentMethod;
  cash_received: number;
  branch_id: BranchId;
  user_id: string;
  device_id: string;
}): PendingSale {
  const total_amount = params.cart.reduce((sum, item) => sum + item.unit_price * item.qty, 0);
  return {
    id: makeClientId("SAL", params.device_id),
    branch_id: params.branch_id,
    user_id: params.user_id,
    sale_type: params.sale_type,
    payment_method: params.payment_method,
    total_amount,
    cash_received: params.payment_method === "CASH" ? params.cash_received : 0,
    change_given: params.payment_method === "CASH" ? params.cash_received - total_amount : 0,
    client_created_at: nowIso(),
    device_id: params.device_id,
    items: params.cart.map((item) => ({
      id: makeClientId("SIT", params.device_id),
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price,
      is_freebie: item.is_freebie
    }))
  };
}
