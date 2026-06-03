import type { AccountingDocument, AppState, Branch, CashEntry, InventoryLot, InventoryMovement, Payment, Product, Recipe, Sale, SaleItem } from "./types";

export const branches: Branch[] = ["บ้านโจ้", "ท่ารั้ว", "เกษตรใหม่"];

export const productTypeLabel: Record<Product["type"], string> = {
  raw_material: "วัตถุดิบ",
  packaging: "บรรจุภัณฑ์",
  purchased_finished_good: "ซื้อมาขาย",
  produced_finished_good: "ผลิตเอง",
};

export const products: Product[] = [
  { id: "RM-001", name: "ข้าวสารหอมมะลิ", type: "raw_material", category: "ของแห้ง", unit: "กก.", active: true },
  { id: "RM-002", name: "เนื้อไก่", type: "raw_material", category: "เนื้อสัตว์", unit: "กก.", active: true },
  { id: "RM-003", name: "หมูสับ", type: "raw_material", category: "เนื้อสัตว์", unit: "กก.", active: true },
  { id: "RM-004", name: "ไข่ไก่", type: "raw_material", category: "ของสด", unit: "ฟอง", active: true },
  { id: "RM-005", name: "กะเพรา", type: "raw_material", category: "ผัก", unit: "กก.", active: true },
  { id: "RM-006", name: "แครอท", type: "raw_material", category: "ผัก", unit: "กก.", active: true },
  { id: "RM-007", name: "ซอสหอยนางรม", type: "raw_material", category: "เครื่องปรุง", unit: "ขวด", active: true },
  { id: "RM-008", name: "น้ำปลา", type: "raw_material", category: "เครื่องปรุง", unit: "ขวด", active: true },
  { id: "PK-001", name: "กล่องดำ", type: "packaging", category: "กล่อง", unit: "ใบ", active: true },
  { id: "PK-002", name: "สติ๊กเกอร์โลโก้", type: "packaging", category: "ฉลาก", unit: "ดวง", active: true },
  { id: "PROD-001", name: "กะเพราไก่ไข่ดาว", type: "produced_finished_good", category: "ข้าวกล่อง", unit: "กล่อง", salePrice: 69, active: true },
  { id: "PROD-002", name: "ข้าวผัดหมู", type: "produced_finished_good", category: "ข้าวกล่อง", unit: "กล่อง", salePrice: 69, active: true },
  { id: "PROD-003", name: "ข้าวผัดจาก The Grand's", type: "purchased_finished_good", category: "ข้าวกล่อง", unit: "กล่อง", salePrice: 69, supplier: "The Grand's", active: true },
  { id: "PROD-004", name: "กระเพาะปลา", type: "purchased_finished_good", category: "อาหาร", unit: "กล่อง", salePrice: 69, supplier: "The Grand's", active: true },
  { id: "PROD-005", name: "น้ำดื่ม", type: "purchased_finished_good", category: "น้ำ", unit: "ขวด", salePrice: 10, supplier: "The Grand's", active: true },
  { id: "PROD-006", name: "เค้กกล้วยหอม", type: "purchased_finished_good", category: "ขนม", unit: "ชิ้น", salePrice: 49, supplier: "The Grand's", active: true },
  { id: "PROD-007", name: "ขนมถ้วย", type: "purchased_finished_good", category: "ขนม", unit: "ชุด", salePrice: 35, supplier: "The Grand's", active: true },
];

export const recipes: Recipe[] = [
  {
    id: "REC-001",
    name: "สูตรกะเพราไก่ไข่ดาว",
    outputProductId: "PROD-001",
    outputQty: 10,
    outputUnit: "กล่อง",
    ingredients: [
      { productId: "RM-001", quantity: 1.8, unit: "กก." },
      { productId: "RM-002", quantity: 1.5, unit: "กก." },
      { productId: "RM-004", quantity: 10, unit: "ฟอง" },
      { productId: "RM-005", quantity: 0.25, unit: "กก." },
      { productId: "RM-007", quantity: 0.18, unit: "ขวด" },
      { productId: "PK-001", quantity: 10, unit: "ใบ" },
      { productId: "PK-002", quantity: 10, unit: "ดวง" },
    ],
  },
  {
    id: "REC-002",
    name: "สูตรข้าวผัดหมู",
    outputProductId: "PROD-002",
    outputQty: 12,
    outputUnit: "กล่อง",
    ingredients: [
      { productId: "RM-001", quantity: 2.2, unit: "กก." },
      { productId: "RM-003", quantity: 1.2, unit: "กก." },
      { productId: "RM-004", quantity: 8, unit: "ฟอง" },
      { productId: "RM-006", quantity: 0.35, unit: "กก." },
      { productId: "RM-008", quantity: 0.12, unit: "ขวด" },
      { productId: "PK-001", quantity: 12, unit: "ใบ" },
      { productId: "PK-002", quantity: 12, unit: "ดวง" },
    ],
  },
];

export const initialLots: InventoryLot[] = [
  { id: "LOT-001", productId: "RM-001", branch: "บ้านโจ้", quantityIn: 60, remaining: 44, unitCost: 42, receivedDate: "2026-06-01", expiryDate: "2026-08-20", source: "ซื้อเข้า", supplier: "สวนครอบครัว" },
  { id: "LOT-002", productId: "RM-002", branch: "บ้านโจ้", quantityIn: 18, remaining: 11.5, unitCost: 98, receivedDate: "2026-06-02", expiryDate: "2026-06-04", source: "ซื้อเข้า", supplier: "ตลาดเมืองใหม่" },
  { id: "LOT-003", productId: "RM-003", branch: "บ้านโจ้", quantityIn: 12, remaining: 8.6, unitCost: 115, receivedDate: "2026-06-01", expiryDate: "2026-06-05", source: "ซื้อเข้า", supplier: "ตลาดเมืองใหม่" },
  { id: "LOT-004", productId: "RM-004", branch: "บ้านโจ้", quantityIn: 240, remaining: 162, unitCost: 4.1, receivedDate: "2026-06-02", expiryDate: "2026-06-10", source: "ซื้อเข้า", supplier: "ฟาร์มไข่" },
  { id: "LOT-005", productId: "RM-005", branch: "บ้านโจ้", quantityIn: 5, remaining: 2.1, unitCost: 75, receivedDate: "2026-06-02", expiryDate: "2026-06-03", source: "ซื้อเข้า", supplier: "ตลาดสด" },
  { id: "LOT-006", productId: "RM-006", branch: "ท่ารั้ว", quantityIn: 8, remaining: 7.2, unitCost: 38, receivedDate: "2026-06-01", expiryDate: "2026-06-06", source: "ซื้อเข้า", supplier: "ตลาดสด" },
  { id: "LOT-007", productId: "PK-001", branch: "บ้านโจ้", quantityIn: 500, remaining: 420, unitCost: 2.67, receivedDate: "2026-05-29", expiryDate: "2027-05-29", source: "ซื้อเข้า", supplier: "ร้านบรรจุภัณฑ์" },
  { id: "LOT-008", productId: "PK-002", branch: "บ้านโจ้", quantityIn: 500, remaining: 415, unitCost: 0.8, receivedDate: "2026-05-29", expiryDate: "2027-05-29", source: "ซื้อเข้า", supplier: "ร้านสติ๊กเกอร์" },
  { id: "LOT-009", productId: "PROD-003", branch: "บ้านโจ้", quantityIn: 40, remaining: 13, unitCost: 25, receivedDate: "2026-06-02", expiryDate: "2026-06-04", source: "ซื้อเข้า", supplier: "The Grand's" },
  { id: "LOT-010", productId: "PROD-004", branch: "ท่ารั้ว", quantityIn: 35, remaining: 5, unitCost: 27, receivedDate: "2026-06-01", expiryDate: "2026-06-02", source: "ซื้อเข้า", supplier: "The Grand's", note: "ตัวอย่างสินค้าหมดอายุที่ต้องตัดเสีย" },
  { id: "LOT-011", productId: "PROD-005", branch: "เกษตรใหม่", quantityIn: 120, remaining: 97, unitCost: 7, receivedDate: "2026-05-28", expiryDate: "2026-12-01", source: "ซื้อเข้า", supplier: "The Grand's" },
  { id: "LOT-012", productId: "PROD-006", branch: "บ้านโจ้", quantityIn: 28, remaining: 9, unitCost: 16, receivedDate: "2026-06-02", expiryDate: "2026-06-03", source: "ซื้อเข้า", supplier: "The Grand's" },
  { id: "LOT-013", productId: "PROD-001", branch: "บ้านโจ้", quantityIn: 30, remaining: 18, unitCost: 31.4, receivedDate: "2026-06-03", expiryDate: "2026-06-04", source: "ผลิตเอง", note: "ผลิตเช้า" },
  { id: "LOT-014", productId: "PROD-002", branch: "เกษตรใหม่", quantityIn: 24, remaining: 15, unitCost: 29.2, receivedDate: "2026-06-03", expiryDate: "2026-06-04", source: "ผลิตเอง", note: "ผลิตเช้า" },
  { id: "LOT-015", productId: "PROD-007", branch: "ท่ารั้ว", quantityIn: 30, remaining: 22, unitCost: 12, receivedDate: "2026-06-02", expiryDate: "2026-06-03", source: "ซื้อเข้า", supplier: "The Grand's" },
];

export const initialCashEntries: CashEntry[] = [
  { id: "CASH-001", date: "2026-06-01", branch: "บ้านโจ้", type: "จ่ายเงิน", category: "ซื้อวัตถุดิบ", amount: 5860, note: "รับวัตถุดิบเข้าคลัง" },
  { id: "CASH-002", date: "2026-06-02", branch: "บ้านโจ้", type: "จ่ายเงิน", category: "ซื้อสินค้าจากบริษัทแม่", amount: 2448, note: "รับข้าวกล่องและเค้ก" },
  { id: "CASH-003", date: "2026-06-03", branch: "บ้านโจ้", type: "รับเงิน", category: "ยอดขายจริง", amount: 3920, note: "QR1 2100, QR2 900, สด 920" },
  { id: "CASH-004", date: "2026-06-03", branch: "ท่ารั้ว", type: "รับเงิน", category: "ยอดขายจริง", amount: 2140, note: "QR และเงินสด" },
  { id: "CASH-005", date: "2026-06-01", branch: "บ้านโจ้", type: "จ่ายเงิน", category: "ค่าแรง", amount: 50000, note: "เงินเดือนพนักงาน" },
  { id: "CASH-006", date: "2026-06-01", branch: "บ้านโจ้", type: "จ่ายเงิน", category: "ค่าน้ำค่าไฟ", amount: 11000, note: "ค่าน้ำและค่าไฟ" },
];

export const initialSales: Sale[] = [
  { id: "SALE-001", documentNo: "RC-202606-0001", date: "2026-06-01", branch: "บ้านโจ้", channel: "QR1", subtotal: 1380, discount: 0, total: 1380, costOfGoods: 500, grossProfit: 880, vatAmount: 0, note: "ยอดขาย demo จาก POS" },
  { id: "SALE-002", documentNo: "RC-202606-0002", date: "2026-06-02", branch: "ท่ารั้ว", channel: "เงินสด", subtotal: 980, discount: 40, total: 940, costOfGoods: 320, grossProfit: 620, vatAmount: 0, note: "ยอดขาย demo จาก POS" },
  { id: "SALE-003", documentNo: "RC-202606-0003", date: "2026-06-03", branch: "เกษตรใหม่", channel: "ออนไลน์", subtotal: 1518, discount: 0, total: 1518, costOfGoods: 642, grossProfit: 876, vatAmount: 0, note: "ยอดขาย demo จาก POS" },
];

export const initialSaleItems: SaleItem[] = [
  { id: "ITEM-001", saleId: "SALE-001", productId: "PROD-003", lotId: "LOT-009", quantity: 10, unitPrice: 69, discount: 0, revenue: 690, costOfGoods: 250 },
  { id: "ITEM-002", saleId: "SALE-001", productId: "PROD-001", lotId: "LOT-013", quantity: 10, unitPrice: 69, discount: 0, revenue: 690, costOfGoods: 314 },
  { id: "ITEM-003", saleId: "SALE-002", productId: "PROD-006", lotId: "LOT-012", quantity: 20, unitPrice: 49, discount: 40, revenue: 940, costOfGoods: 320 },
  { id: "ITEM-004", saleId: "SALE-003", productId: "PROD-002", lotId: "LOT-014", quantity: 12, unitPrice: 69, discount: 0, revenue: 828, costOfGoods: 350 },
  { id: "ITEM-005", saleId: "SALE-003", productId: "PROD-005", lotId: "LOT-011", quantity: 69, unitPrice: 10, discount: 0, revenue: 690, costOfGoods: 483 },
];

export const initialPayments: Payment[] = [
  { id: "PAY-001", saleId: "SALE-001", date: "2026-06-01", branch: "บ้านโจ้", channel: "QR1", amount: 1380 },
  { id: "PAY-002", saleId: "SALE-002", date: "2026-06-02", branch: "ท่ารั้ว", channel: "เงินสด", amount: 940 },
  { id: "PAY-003", saleId: "SALE-003", date: "2026-06-03", branch: "เกษตรใหม่", channel: "ออนไลน์", amount: 1518 },
];

export const initialMovements: InventoryMovement[] = [
  { id: "MOVE-001", date: "2026-06-01", branch: "บ้านโจ้", lotId: "LOT-009", productId: "PROD-003", type: "POS", quantityChange: -10, valueChange: -250, linkedId: "SALE-001", note: "ขาย demo POS" },
  { id: "MOVE-002", date: "2026-06-01", branch: "บ้านโจ้", lotId: "LOT-013", productId: "PROD-001", type: "POS", quantityChange: -10, valueChange: -314, linkedId: "SALE-001", note: "ขาย demo POS" },
  { id: "MOVE-003", date: "2026-06-02", branch: "ท่ารั้ว", lotId: "LOT-012", productId: "PROD-006", type: "POS", quantityChange: -20, valueChange: -320, linkedId: "SALE-002", note: "ขาย demo POS" },
  { id: "MOVE-004", date: "2026-06-03", branch: "เกษตรใหม่", lotId: "LOT-014", productId: "PROD-002", type: "POS", quantityChange: -12, valueChange: -350, linkedId: "SALE-003", note: "ขาย demo POS" },
];

export const initialDocuments: AccountingDocument[] = [
  { id: "DOC-001", documentNo: "RC-202606-0001", type: "ใบเสร็จ", date: "2026-06-01", branch: "บ้านโจ้", party: "ลูกค้าหน้าร้าน", category: "ยอดขาย", amountBeforeVat: 1380, vatAmount: 0, totalAmount: 1380, linkedId: "SALE-001" },
  { id: "DOC-002", documentNo: "RC-202606-0002", type: "ใบเสร็จ", date: "2026-06-02", branch: "ท่ารั้ว", party: "ลูกค้าหน้าร้าน", category: "ยอดขาย", amountBeforeVat: 940, vatAmount: 0, totalAmount: 940, linkedId: "SALE-002" },
  { id: "DOC-003", documentNo: "RC-202606-0003", type: "ใบเสร็จ", date: "2026-06-03", branch: "เกษตรใหม่", party: "ลูกค้าหน้าร้าน", category: "ยอดขาย", amountBeforeVat: 1518, vatAmount: 0, totalAmount: 1518, linkedId: "SALE-003" },
];

export const initialState: AppState = {
  products,
  lots: initialLots,
  recipes,
  batches: [],
  sessions: [],
  sales: initialSales,
  saleItems: initialSaleItems,
  payments: initialPayments,
  movements: initialMovements,
  documents: initialDocuments,
  cashEntries: initialCashEntries,
  adjustments: [],
  closeShifts: [],
  auditLogs: [],
  taxSettings: {
    vatEnabled: false,
    vatRate: 7,
    priceIncludesVat: true,
  },
};
