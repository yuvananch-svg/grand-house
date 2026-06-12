export type Role = "staff" | "office" | "owner";
export type BranchId = "BR-KASET" | "BR-THARUA" | "BR-BANJO" | "ALL";
export type Language = "th" | "my";
export type SaleType = "normal" | "discount" | "freebie" | "staff";
export type PaymentMethod = "QR1" | "QR2" | "GRAB" | "CASH" | "THAI_HELP_THAI" | "OTHER";
export type ProductCategory = "rice_box" | "savory" | "drink" | "dessert" | "snack" | "other";
export type ProductSource = "parent" | "self_produced";
export type Warehouse = "raw_fresh" | "dry_supply";
export type BaseUnit = "g" | "ml" | "piece";
export type WastageType = "finished" | "raw";
export type ItemType = "PTG" | "PGH" | "RM" | "PK" | "SUP";
export type FeatureGroup =
  | "pos"
  | "wastage"
  | "inventory"
  | "production"
  | "reconcile"
  | "expense"
  | "admin"
  | "auth"
  | "report";
export type AuditFlagCode = "SUSPICIOUS" | "OVERSOLD" | "LATE_SYNC" | "CLOCK_DRIFT" | "PRICE_OVERRIDE";
export type AuditFlag = "" | AuditFlagCode | string;
export type ApiAction =
  | "login"
  | "app.snapshot"
  | "item.list"
  | "item.save"
  | "product.list"
  | "product.images"
  | "stock.myBranch"
  | "sale.syncBatch"
  | "sale.void"
  | "wastage.create"
  | "rawWastage.create"
  | "stock.extendExpiry"
  | "goods.receive"
  | "rawlot.purchase"
  | "inventory.list"
  | "production.preview"
  | "production.run"
  | "stockAdjust.request"
  | "reconcile.getDaily"
  | "reconcile.confirm"
  | "expense.create"
  | "expense.list"
  | "recipe.save"
  | "recipe.list"
  | "report.summary"
  | "report.financialStatement"
  | "audit.query"
  | "user.manage"
  | "log.clientError";

export interface Branch {
  branch_id: BranchId;
  branch_name: string;
  active: boolean;
}

export interface User {
  id: string;
  user_id: string;
  password: string;
  display_name: string;
  role: Role;
  branch_id: BranchId;
  active: boolean;
  approval_pin?: string;
  failed_attempts: number;
  locked_until?: string;
  pin_failed_attempts?: number;
  pin_locked_until?: string;
}

export interface Session {
  token: string;
  user_id: string;
  display_name: string;
  role: Role;
  branch_id: BranchId;
  device_id: string;
  expires_at: string;
}

export interface Product {
  id: string;
  item_code: string;
  name_th: string;
  name_my: string;
  image_url: string;
  image_data?: string;
  category: ProductCategory;
  source_type: ProductSource;
  sell_price: number;
  staff_price: number;
  shelf_life_days: number;
  is_perishable: boolean;
  active: boolean;
}

export interface FinishedLot {
  lot_id: string;
  branch_id: BranchId;
  product_id: string;
  qty_in: number;
  qty_remaining: number;
  unit_cost: number;
  received_date: string;
  expiry_date: string;
  source: "parent_receive" | "production";
  source_ref: string;
  extend_count?: number;
}

export interface RawMaterial {
  id: string;
  item_code: string;
  name_th: string;
  name_my: string;
  warehouse: Warehouse;
  base_unit: BaseUnit;
  display_unit: string;
  display_factor: number;
  is_packaging: boolean;
  active: boolean;
}

export interface SupplyItem {
  id: string;
  item_code: string;
  name_th: string;
  name_my: string;
  category: string;
  unit: string;
  active: boolean;
}

export interface MasterItem {
  id: string;
  item_code: string;
  name_th: string;
  name_my: string;
  type: ItemType;
  category: string;
  unit: string;
  active: boolean;
  sell_price?: number;
  staff_price?: number;
  source_id?: string;
}

export interface RawLot {
  lot_id: string;
  material_id: string;
  branch_id: BranchId;
  qty_in: number;
  qty_remaining: number;
  unit_cost: number;
  purchase_date: string;
  supplier_note: string;
}

export interface Recipe {
  id: string;
  product_id: string;
  name: string;
  active: boolean;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  material_id: string;
  qty_per_unit: number;
}

export interface LotBreakdown {
  lot_id: string;
  qty: number;
  unit_cost: number;
}

export interface SaleItemDraft {
  id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  is_freebie: boolean;
}

export interface PendingSale {
  id: string;
  branch_id: BranchId;
  user_id: string;
  sale_type: SaleType;
  payment_method: PaymentMethod;
  total_amount: number;
  cash_received: number;
  change_given: number;
  client_created_at: string;
  device_id: string;
  items: SaleItemDraft[];
}

export interface Sale {
  id: string;
  branch_id: BranchId;
  user_id: string;
  sale_type: SaleType;
  payment_method: PaymentMethod;
  total_amount: number;
  cash_received: number;
  change_given: number;
  total_cogs: number;
  client_created_at: string;
  server_received_at: string;
  business_date: string;
  synced_at: string;
  reconcile_status: "pending" | "reconciled";
  status: "active" | "voided";
  void_reason?: string;
  voided_by?: string;
  voided_at?: string;
  late_after_reconcile: boolean;
  device_id: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  qty: number;
  unit_price: number;
  is_freebie: boolean;
  unit_cost: number;
  lot_breakdown: LotBreakdown[];
}

export interface Wastage {
  id: string;
  wastage_type: WastageType;
  branch_id: BranchId;
  user_id: string;
  product_id?: string;
  material_id?: string;
  qty: number;
  total_cost_value: number;
  lot_breakdown: LotBreakdown[];
  created_at: string;
}

export interface GoodsReceipt {
  id: string;
  branch_id: BranchId;
  user_id: string;
  product_id: string;
  qty: number;
  unit_cost: number;
  received_date: string;
}

export interface ProductionOrder {
  id: string;
  branch_id: BranchId;
  user_id: string;
  recipe_id: string;
  qty_produced: number;
  total_material_cost: number;
  total_packaging_cost: number;
  unit_cost_locked: number;
  consumption_detail: Record<string, LotBreakdown[]>;
  created_at: string;
  output_lot_id: string;
}

export interface StockAdjustment {
  id: string;
  user_id: string;
  approved_by: string;
  target_type: "raw_lot" | "finished_lot";
  lot_id: string;
  qty_before: number;
  qty_after: number;
  reason: string;
  created_at: string;
}

export interface Reconciliation {
  id: string;
  branch_id: BranchId;
  business_date: string;
  system: Record<PaymentMethod, number>;
  actual: Record<PaymentMethod, number>;
  diff_total: number;
  status: "pending" | "reconciled" | "mismatch" | "reopened";
  reconciled_by?: string;
  reconciled_at?: string;
  note?: string;
}

export interface Expense {
  id: string;
  branch_id: BranchId;
  user_id: string;
  expense_type: "salary" | "utility_water" | "utility_electric" | "maintenance" | "supply_purchase" | "other";
  amount: number;
  expense_month: string;
  note: string;
  created_at: string;
  payment_channel?: PaymentMethod;
  purchase_qty?: number;
  item_code?: string;
  ref_id?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  branch_id: BranchId;
  lot_id: string;
  item_code: string;
  type: "sale" | "production" | "receive" | "adjust" | "wastage" | "void";
  qty_change: number;
  value_change: number;
  ref_id: string;
}

export interface DailySummary {
  id: string;
  branch_id: BranchId;
  business_date: string;
  rev_normal: number;
  rev_discount: number;
  rev_freebie: number;
  rev_staff: number;
  pay_qr1: number;
  pay_qr2: number;
  pay_grab: number;
  pay_cash: number;
  pay_thai: number;
  pay_other: number;
  cogs_total: number;
  wastage_value: number;
  bill_count: number;
  void_count: number;
  last_rebuilt_at: string;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  field: "sell_price" | "staff_price";
  old_value: number;
  new_value: number;
  changed_by: string;
  changed_at: string;
}

export interface Device {
  device_id: string;
  label: string;
  branch_id: BranchId;
  first_seen: string;
  last_seen: string;
  status: "active" | "blocked";
}

export interface ClientErrorLog {
  id: string;
  device_id: string;
  user_id?: string;
  app_version: string;
  message: string;
  stack: string;
  url: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  role: Role | "anonymous" | "system";
  branch_id: BranchId;
  action: string;
  feature_group: FeatureGroup;
  ref_id: string;
  detail: string;
  flag: AuditFlag;
  device_id: string;
  success: boolean;
  prev_hash: string;
  row_hash: string;
}

export interface Config {
  void_window_minutes: number;
  day_cutoff_hour: number;
  suspicious_price_pct: number;
  suspicious_staffsale_per_day: number;
  suspicious_wastage_value: number;
  suspicious_adjust_per_week: number;
  rate_limit_per_min: number;
  global_rate_limit_per_min: number;
  login_lockout_attempts: number;
  lockout_minutes: number;
  schema_version: number;
  catalog_version: number;
}

export interface LocalState {
  users: User[];
  branches: Branch[];
  products: Product[];
  finishedLots: FinishedLot[];
  rawMaterials: RawMaterial[];
  supplyItems: SupplyItem[];
  rawLots: RawLot[];
  recipes: Recipe[];
  recipeItems: RecipeItem[];
  sales: Sale[];
  saleItems: SaleItem[];
  wastage: Wastage[];
  goodsReceipts: GoodsReceipt[];
  productionOrders: ProductionOrder[];
  stockAdjustments: StockAdjustment[];
  reconciliations: Reconciliation[];
  expenses: Expense[];
  dailySummary: DailySummary[];
  priceHistory: PriceHistory[];
  devices: Device[];
  errorLog: ClientErrorLog[];
  stockMovements: StockMovement[];
  auditLog: AuditLog[];
  config: Config;
}

export interface ApiRequest<TPayload = unknown> {
  token?: string;
  action: ApiAction;
  payload: TPayload;
  device_id: string;
}

export type ApiResponse<TData = unknown> =
  | { ok: true; data: TData; catalog_version?: number }
  | { ok: false; code: string; message: string };

export interface OutboxItem {
  id: string;
  type: ApiAction;
  payload: unknown;
  created_at: string;
  status: "pending" | "sending" | "done" | "failed" | "dead";
  last_error?: string;
}

export interface CartItem {
  product_id: string;
  qty: number;
  unit_price: number;
  is_freebie: boolean;
}

export interface ReportSummary {
  gross_revenue: number;
  revenue_by_type: Record<SaleType, number>;
  revenue_by_payment: Record<PaymentMethod, number>;
  cogs: number;
  gross_profit: number;
  wastage_value: number;
  total_expenses: number;
  expense_breakdown: Record<Expense["expense_type"], number>;
  net_profit: number;
  daily_trend: { date: string; revenue: number; profit: number }[];
}
