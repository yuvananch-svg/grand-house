export type Role = "owner" | "staff" | "backoffice";
export type Branch = "บ้านโจ้" | "ท่ารั้ว" | "เกษตรใหม่";
export type ProductType =
  | "raw_material"
  | "packaging"
  | "purchased_finished_good"
  | "produced_finished_good";

export type LotStatus = "ปกติ" | "ใกล้หมดอายุ" | "หมดอายุ" | "หมดแล้ว" | "ตัดเสีย";
export type CashType = "รับเงิน" | "จ่ายเงิน" | "ย้ายต้นทุน";
export type PaymentChannel = "QR1" | "QR2" | "ไทยช่วยไทย" | "เงินสด" | "online(grab)" | "อื่นๆ";
export type MovementType = "POS" | "ผลิต" | "รับเข้า" | "ปรับสต็อก" | "ของเสีย" | "หมดอายุ" | "ยกเลิกบิล";
export type DocumentType = "ใบเสร็จ" | "ใบกำกับภาษี" | "ใบซื้อ" | "ใบค่าใช้จ่าย" | "ใบลดหนี้";
export type AuditActor = Role | "system";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  category: string;
  unit: string;
  salePrice?: number;
  supplier?: string;
  active: boolean;
}

export interface InventoryLot {
  id: string;
  productId: string;
  branch: Branch;
  quantityIn: number;
  remaining: number;
  unitCost: number;
  receivedDate: string;
  expiryDate: string;
  source: "ซื้อเข้า" | "ผลิตเอง" | "ปรับสต็อก";
  supplier?: string;
  statusOverride?: "ตัดเสีย";
  note?: string;
}

export interface RecipeIngredient {
  productId: string;
  quantity: number;
  unit: string;
}

export interface Recipe {
  id: string;
  name: string;
  outputProductId: string;
  outputQty: number;
  outputUnit: string;
  ingredients: RecipeIngredient[];
}

export interface ProductionBatch {
  id: string;
  recipeId: string;
  branch: Branch;
  producedQty: number;
  productionDate: string;
  expiryDate: string;
  totalCost: number;
  outputLotId: string;
}

export interface StockSession {
  id: string;
  lotId: string;
  date: string;
  branch: Branch;
  productId: string;
  previousRemaining: number;
  countedRemaining: number;
  normalSold: number;
  promoSold: number;
  promoPrice: number;
  giveawayQty: number;
  wasteQty: number;
  revenue: number;
  costOfGoods: number;
  note?: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  lotId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  revenue: number;
  costOfGoods: number;
  lineType?: "ขาย" | "แถมโปร" | "แถมเอง";
  promoLabel?: string;
}

export interface Sale {
  id: string;
  documentNo: string;
  date: string;
  branch: Branch;
  channel: PaymentChannel;
  subtotal: number;
  discount: number;
  total: number;
  costOfGoods: number;
  grossProfit: number;
  vatAmount: number;
  taxInvoiceNo?: string;
  note?: string;
  status?: "ปกติ" | "ยกเลิก";
  voidedDate?: string;
  voidReason?: string;
}

export interface Payment {
  id: string;
  saleId: string;
  date: string;
  branch: Branch;
  channel: PaymentChannel;
  amount: number;
}

export interface InventoryMovement {
  id: string;
  date: string;
  branch: Branch;
  lotId: string;
  productId: string;
  type: MovementType;
  quantityChange: number;
  valueChange: number;
  linkedId?: string;
  note?: string;
}

export interface CashEntry {
  id: string;
  date: string;
  branch: Branch;
  type: CashType;
  category: string;
  amount: number;
  note: string;
  linkedId?: string;
}

export interface AccountingDocument {
  id: string;
  documentNo: string;
  type: DocumentType;
  date: string;
  branch: Branch;
  party: string;
  category: string;
  amountBeforeVat: number;
  vatAmount: number;
  totalAmount: number;
  linkedId?: string;
  note?: string;
}

export interface TaxSettings {
  vatEnabled: boolean;
  vatRate: number;
  priceIncludesVat: boolean;
}

export interface Adjustment {
  id: string;
  date: string;
  lotId: string;
  productId: string;
  branch: Branch;
  quantityChange: number;
  reason: string;
}

export interface CloseShift {
  id: string;
  documentNo: string;
  date: string;
  branch: Branch;
  expectedByChannel: Record<PaymentChannel, number>;
  actualByChannel: Record<PaymentChannel, number>;
  expectedTotal: number;
  actualTotal: number;
  difference: number;
  salesTotal: number;
  costOfGoods: number;
  grossProfit: number;
  note: string;
}

export interface AuditLog {
  id: string;
  date: string;
  branch?: Branch;
  actor: AuditActor;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
}

export interface AppState {
  products: Product[];
  lots: InventoryLot[];
  recipes: Recipe[];
  batches: ProductionBatch[];
  sessions: StockSession[];
  sales: Sale[];
  saleItems: SaleItem[];
  payments: Payment[];
  movements: InventoryMovement[];
  documents: AccountingDocument[];
  cashEntries: CashEntry[];
  adjustments: Adjustment[];
  closeShifts: CloseShift[];
  auditLogs: AuditLog[];
  taxSettings: TaxSettings;
}

export interface AlertItem {
  lot: InventoryLot;
  product: Product;
  status: LotStatus;
  daysLeft: number;
}
