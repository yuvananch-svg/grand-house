import { initialState } from "./data";
import type {
  Adjustment,
  AlertItem,
  AccountingDocument,
  AppState,
  Branch,
  CashEntry,
  CloseShift,
  InventoryLot,
  InventoryMovement,
  LotStatus,
  Payment,
  PaymentChannel,
  ProductionBatch,
  Product,
  ProductType,
  Recipe,
  Sale,
  SaleItem,
  StockSession,
  TaxSettings,
} from "./types";

const STORAGE_KEY = "grand-house-prototype-state-v3-seed";
export const today = "2026-06-03";
const paymentChannels: PaymentChannel[] = ["QR1", "QR2", "ไทยช่วยไทย", "เงินสด", "online(grab)", "อื่นๆ"];

export function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return initialState;
  try {
    return normalizeState(JSON.parse(raw) as Partial<AppState>);
  } catch {
    return initialState;
  }
}

function normalizeState(state: Partial<AppState>): AppState {
  const sales = (state.sales || []).map((sale) => ({ ...sale, channel: normalizePaymentChannel(sale.channel) }));
  const payments = (state.payments || []).map((payment) => ({ ...payment, channel: normalizePaymentChannel(payment.channel) }));
  const closeShifts = (state.closeShifts || []).map((shift) => ({
    ...shift,
    expectedByChannel: normalizePaymentRecord(shift.expectedByChannel),
    actualByChannel: normalizePaymentRecord(shift.actualByChannel),
  }));
  return {
    ...initialState,
    ...state,
    products: state.products || initialState.products,
    lots: state.lots || initialState.lots,
    recipes: state.recipes || initialState.recipes,
    batches: state.batches || [],
    sessions: state.sessions || [],
    sales,
    saleItems: state.saleItems || [],
    payments,
    movements: state.movements || [],
    documents: state.documents || [],
    cashEntries: state.cashEntries || [],
    adjustments: state.adjustments || [],
    closeShifts,
    auditLogs: state.auditLogs || [],
    taxSettings: state.taxSettings || initialState.taxSettings,
  };
}

function normalizePaymentChannel(channel: unknown): PaymentChannel {
  if (channel === "ออนไลน์") return "online(grab)";
  return paymentChannels.includes(channel as PaymentChannel) ? (channel as PaymentChannel) : "อื่นๆ";
}

function normalizePaymentRecord(record?: Partial<Record<PaymentChannel | "ออนไลน์", number>>): Record<PaymentChannel, number> {
  const normalized = paymentChannels.reduce((acc, channel) => ({ ...acc, [channel]: 0 }), {} as Record<PaymentChannel, number>);
  if (!record) return normalized;
  for (const [channel, amount] of Object.entries(record)) {
    normalized[normalizePaymentChannel(channel)] += Number(amount) || 0;
  }
  return normalized;
}

export function saveState(state: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function money(value: number) {
  return value.toLocaleString("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 });
}

export function number(value: number, digits = 0) {
  return value.toLocaleString("th-TH", { maximumFractionDigits: digits });
}

export function daysBetween(date: string, base = today) {
  const one = new Date(`${base}T00:00:00`).getTime();
  const two = new Date(`${date}T00:00:00`).getTime();
  return Math.round((two - one) / 86_400_000);
}

export function lotStatus(lot: InventoryLot, base = today): LotStatus {
  if (lot.statusOverride === "ตัดเสีย") return "ตัดเสีย";
  if (lot.remaining <= 0) return "หมดแล้ว";
  const daysLeft = daysBetween(lot.expiryDate, base);
  if (daysLeft < 0) return "หมดอายุ";
  if (daysLeft <= 1) return "ใกล้หมดอายุ";
  return "ปกติ";
}

export function isExpired(lot: InventoryLot) {
  return lotStatus(lot) === "หมดอายุ";
}

export function productById(products: Product[], id: string) {
  return products.find((product) => product.id === id);
}

export function activeLots(state: AppState, predicate?: (lot: InventoryLot) => boolean) {
  return state.lots.filter((lot) => {
    const status = lotStatus(lot);
    return lot.remaining > 0 && status !== "หมดแล้ว" && status !== "ตัดเสีย" && (!predicate || predicate(lot));
  });
}

export function activeSales(state: AppState) {
  return state.sales.filter((sale) => sale.status !== "ยกเลิก");
}

export function expiryAlerts(state: AppState): AlertItem[] {
  return state.lots
    .map((lot) => {
      const product = productById(state.products, lot.productId);
      if (!product) return null;
      const status = lotStatus(lot);
      if (status !== "ใกล้หมดอายุ" && status !== "หมดอายุ") return null;
      return { lot, product, status, daysLeft: daysBetween(lot.expiryDate) };
    })
    .filter(Boolean)
    .sort((a, b) => (a!.daysLeft === b!.daysLeft ? a!.product.name.localeCompare(b!.product.name, "th") : a!.daysLeft - b!.daysLeft)) as AlertItem[];
}

export function inventoryValue(state: AppState) {
  return activeLots(state).reduce((sum, lot) => sum + lot.remaining * lot.unitCost, 0);
}

export function stockRevenue(state: AppState) {
  return state.sessions.reduce((sum, session) => sum + session.revenue, 0) + activeSales(state).reduce((sum, sale) => sum + sale.total, 0);
}

export function cogs(state: AppState) {
  return state.sessions.reduce((sum, session) => sum + session.costOfGoods, 0) + activeSales(state).reduce((sum, sale) => sum + sale.costOfGoods, 0);
}

export function cashIn(state: AppState) {
  return state.cashEntries.filter((entry) => entry.type === "รับเงิน").reduce((sum, entry) => sum + entry.amount, 0) + state.payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export function cashOut(state: AppState) {
  return state.cashEntries.filter((entry) => entry.type === "จ่ายเงิน").reduce((sum, entry) => sum + entry.amount, 0);
}

export function recipeCost(state: AppState, recipe: Recipe, branch?: Branch) {
  let total = 0;
  let missing: string[] = [];
  for (const ingredient of recipe.ingredients) {
    const lots = activeLots(state, (lot) => lot.productId === ingredient.productId && !isExpired(lot) && (!branch || lot.branch === branch)).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    let need = ingredient.quantity;
    for (const lot of lots) {
      if (need <= 0) break;
      const take = Math.min(need, lot.remaining);
      total += take * lot.unitCost;
      need -= take;
    }
    if (need > 0.0001) {
      const product = productById(state.products, ingredient.productId);
      missing = [...missing, product ? product.name : ingredient.productId];
    }
  }
  return { total, perUnit: total / recipe.outputQty, missing };
}

function nextId(prefix: string, rows: { id: string }[]) {
  const next =
    rows
      .map((row) => Number(row.id.replace(`${prefix}-`, "")))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

function withAudit(
  state: AppState,
  input: { date: string; branch?: Branch; action: string; targetType: string; targetId: string; detail: string },
): AppState {
  return {
    ...state,
    auditLogs: [
      ...state.auditLogs,
      {
        id: nextId("AUD", state.auditLogs),
        date: input.date,
        branch: input.branch,
        actor: "system",
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        detail: input.detail,
      },
    ],
  };
}

export function receiveLot(
  state: AppState,
  input: {
    productId: string;
    branch: Branch;
    quantity: number;
    unitCost: number;
    receivedDate: string;
    expiryDate: string;
    supplier: string;
    note: string;
    recordCash?: boolean;
  },
): AppState {
  const lot: InventoryLot = {
    id: nextId("LOT", state.lots),
    productId: input.productId,
    branch: input.branch,
    quantityIn: input.quantity,
    remaining: input.quantity,
    unitCost: input.unitCost,
    receivedDate: input.receivedDate,
    expiryDate: input.expiryDate,
    source: "ซื้อเข้า",
    supplier: input.supplier,
    note: input.note,
  };
  const cash: CashEntry | null = input.recordCash === false
    ? null
    : {
        id: nextId("CASH", state.cashEntries),
        date: input.receivedDate,
        branch: input.branch,
        type: "จ่ายเงิน",
        category: "ซื้อเข้า",
        amount: input.quantity * input.unitCost,
        note: input.note || `รับสินค้าเข้า ${lot.id}`,
        linkedId: lot.id,
      };
  return withAudit(
    { ...state, lots: [...state.lots, lot], cashEntries: cash ? [...state.cashEntries, cash] : state.cashEntries },
    {
      date: input.receivedDate,
      branch: input.branch,
      action: "รับสินค้าเข้า",
      targetType: "LOT",
      targetId: lot.id,
      detail: `รับเข้า ${input.quantity} หน่วย ต้นทุน ${input.unitCost} บาท/หน่วย`,
    },
  );
}

export function produceBatch(
  state: AppState,
  input: { recipeId: string; branch: Branch; producedQty: number; productionDate: string; expiryDate: string },
): { state: AppState; error?: string } {
  const recipe = state.recipes.find((item) => item.id === input.recipeId);
  if (!recipe) return { state, error: "ไม่พบสูตรอาหาร" };
  const multiplier = input.producedQty / recipe.outputQty;
  const batchId = nextId("BATCH", state.batches);
  const lots = state.lots.map((lot) => ({ ...lot }));
  let totalCost = 0;
  const movements: InventoryMovement[] = [];

  for (const ingredient of recipe.ingredients) {
    let need = ingredient.quantity * multiplier;
    const candidates = lots
      .filter((lot) => lot.productId === ingredient.productId && lot.branch === input.branch && lot.remaining > 0 && lotStatus(lot) !== "หมดอายุ" && lotStatus(lot) !== "ตัดเสีย")
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    for (const lot of candidates) {
      if (need <= 0) break;
      const take = Math.min(need, lot.remaining);
      lot.remaining -= take;
      const value = take * lot.unitCost;
      totalCost += value;
      need -= take;
      movements.push({
        id: nextId("MOVE", [...state.movements, ...movements]),
        date: input.productionDate,
        branch: input.branch,
        lotId: lot.id,
        productId: ingredient.productId,
        type: "ผลิต",
        quantityChange: -take,
        valueChange: -value,
        linkedId: batchId,
        note: `ใช้วัตถุดิบผลิต ${recipe.name}`,
      });
    }
    if (need > 0.0001) {
      const product = productById(state.products, ingredient.productId);
      return { state, error: `วัตถุดิบไม่พอหรือหมดอายุ: ${product?.name || ingredient.productId}` };
    }
  }

  const outputLot: InventoryLot = {
    id: nextId("LOT", state.lots),
    productId: recipe.outputProductId,
    branch: input.branch,
    quantityIn: input.producedQty,
    remaining: input.producedQty,
    unitCost: totalCost / input.producedQty,
    receivedDate: input.productionDate,
    expiryDate: input.expiryDate,
    source: "ผลิตเอง",
    note: recipe.name,
  };
  const batch: ProductionBatch = {
    id: batchId,
    recipeId: recipe.id,
    branch: input.branch,
    producedQty: input.producedQty,
    productionDate: input.productionDate,
    expiryDate: input.expiryDate,
    totalCost,
    outputLotId: outputLot.id,
  };
  const transfer: CashEntry = {
    id: nextId("CASH", state.cashEntries),
    date: input.productionDate,
    branch: input.branch,
    type: "ย้ายต้นทุน",
    category: "ผลิตอาหาร",
    amount: totalCost,
    note: `ผลิต ${recipe.name} เป็น ${outputLot.id}`,
    linkedId: batch.id,
  };
  const outputMovement: InventoryMovement = {
    id: nextId("MOVE", [...state.movements, ...movements]),
    date: input.productionDate,
    branch: input.branch,
    lotId: outputLot.id,
    productId: outputLot.productId,
    type: "ผลิต",
    quantityChange: input.producedQty,
    valueChange: totalCost,
    linkedId: batch.id,
    note: `รับสินค้าผลิตเสร็จ ${recipe.name}`,
  };
  return {
    state: withAudit(
      { ...state, lots: [...lots, outputLot], batches: [...state.batches, batch], cashEntries: [...state.cashEntries, transfer], movements: [...state.movements, ...movements, outputMovement] },
      {
        date: input.productionDate,
        branch: input.branch,
        action: "ผลิต batch",
        targetType: "BATCH",
        targetId: batch.id,
        detail: `ผลิต ${recipe.name} ${input.producedQty} ${recipe.outputUnit} ต้นทุนรวม ${totalCost}`,
      },
    ),
  };
}

export function countStock(
  state: AppState,
  input: { lotId: string; date: string; countedRemaining: number; giveawayQty: number; wasteQty: number; promoSold: number; promoPrice: number; note: string },
): { state: AppState; error?: string } {
  const lot = state.lots.find((item) => item.id === input.lotId);
  if (!lot) return { state, error: "ไม่พบ LOT" };
  if (lotStatus(lot) === "หมดอายุ") return { state, error: "LOT นี้หมดอายุแล้ว ต้องตัดเสียหรือปรับสต็อกเท่านั้น" };
  if (input.countedRemaining > lot.remaining) return { state, error: "จำนวนเหลือมากกว่าที่มีอยู่" };
  const moved = lot.remaining - input.countedRemaining;
  const soldTotal = moved - input.giveawayQty - input.wasteQty;
  if (soldTotal < 0) return { state, error: "แถมหรือเสียมากกว่าจำนวนที่หายไปจากสต็อก" };
  if (input.promoSold > soldTotal) return { state, error: "จำนวนขายราคาพิเศษมากกว่ายอดขายรวม" };
  const product = productById(state.products, lot.productId);
  const normalSold = soldTotal - input.promoSold;
  const normalPrice = product?.salePrice || 0;
  const revenue = normalSold * normalPrice + input.promoSold * input.promoPrice;
  const costOfGoods = moved * lot.unitCost;
  const session: StockSession = {
    id: nextId("SES", state.sessions),
    lotId: lot.id,
    date: input.date,
    branch: lot.branch,
    productId: lot.productId,
    previousRemaining: lot.remaining,
    countedRemaining: input.countedRemaining,
    normalSold,
    promoSold: input.promoSold,
    promoPrice: input.promoPrice,
    giveawayQty: input.giveawayQty,
    wasteQty: input.wasteQty,
    revenue,
    costOfGoods,
    note: input.note,
  };
  const lots = state.lots.map((item) => (item.id === lot.id ? { ...item, remaining: input.countedRemaining } : item));
  return {
    state: withAudit(
      { ...state, lots, sessions: [...state.sessions, session] },
      {
        date: input.date,
        branch: lot.branch,
        action: "นับสต็อก",
        targetType: "SES",
        targetId: session.id,
        detail: `LOT ${lot.id} เหลือเดิม ${lot.remaining} เหลือจริง ${input.countedRemaining}`,
      },
    ),
  };
}

export function adjustLot(
  state: AppState,
  input: { lotId: string; date: string; quantityChange: number; reason: string; markWaste: boolean },
): { state: AppState; error?: string } {
  const lot = state.lots.find((item) => item.id === input.lotId);
  if (!lot) return { state, error: "ไม่พบ LOT" };
  const nextRemaining = lot.remaining + input.quantityChange;
  if (nextRemaining < 0) return { state, error: "จำนวนคงเหลือจะติดลบ" };
  const adjustment: Adjustment = {
    id: nextId("ADJ", state.adjustments),
    date: input.date,
    lotId: lot.id,
    productId: lot.productId,
    branch: lot.branch,
    quantityChange: input.quantityChange,
    reason: input.reason,
  };
  const lots = state.lots.map((item) =>
    item.id === lot.id
      ? {
          ...item,
          remaining: nextRemaining,
          statusOverride: input.markWaste && nextRemaining === 0 ? "ตัดเสีย" : item.statusOverride,
        }
      : item,
  );
  const movement: InventoryMovement = {
    id: nextId("MOVE", state.movements),
    date: input.date,
    branch: lot.branch,
    lotId: lot.id,
    productId: lot.productId,
    type: input.markWaste ? "ของเสีย" : "ปรับสต็อก",
    quantityChange: input.quantityChange,
    valueChange: input.quantityChange * lot.unitCost,
    linkedId: adjustment.id,
    note: input.reason,
  };
  return {
    state: withAudit(
      { ...state, lots, adjustments: [...state.adjustments, adjustment], movements: [...state.movements, movement] },
      {
        date: input.date,
        branch: lot.branch,
        action: input.markWaste ? "ตัดเสีย" : "ปรับสต็อก",
        targetType: "LOT",
        targetId: lot.id,
        detail: `${input.quantityChange > 0 ? "เพิ่ม" : "ลด"} ${Math.abs(input.quantityChange)} หน่วย: ${input.reason}`,
      },
    ),
  };
}

export function createRecipe(
  state: AppState,
  input: {
    name: string;
    outputProductId: string;
    outputQty: number;
    ingredients: { productId: string; quantity: number; unit: string }[];
  },
): { state: AppState; error?: string } {
  if (!input.name.trim()) return { state, error: "กรุณากรอกชื่อสูตร" };
  if (input.outputQty <= 0) return { state, error: "จำนวนที่ผลิตได้ต้องมากกว่า 0" };
  const ingredients = input.ingredients.filter((item) => item.productId && item.quantity > 0);
  if (ingredients.length === 0) return { state, error: "กรุณาเลือกวัตถุดิบอย่างน้อย 1 รายการ" };
  const output = productById(state.products, input.outputProductId);
  if (!output) return { state, error: "ไม่พบเมนูผลลัพธ์" };
  const recipe = {
    id: nextId("REC", state.recipes),
    name: input.name.trim(),
    outputProductId: input.outputProductId,
    outputQty: input.outputQty,
    outputUnit: output.unit,
    ingredients,
  };
  return {
    state: withAudit(
      { ...state, recipes: [...state.recipes, recipe] },
      {
        date: today,
        action: "สร้างสูตรอาหาร",
        targetType: "REC",
        targetId: recipe.id,
        detail: `${recipe.name} ใช้วัตถุดิบ ${ingredients.length} รายการ`,
      },
    ),
  };
}

export function createProduct(
  state: AppState,
  input: {
    name: string;
    type: ProductType;
    category: string;
    unit: string;
    salePrice: number;
    standardCost?: number;
    costStartDate?: string;
    supplier?: string;
  },
): { state: AppState; error?: string } {
  if (!input.name.trim()) return { state, error: "กรุณากรอกชื่อสินค้า" };
  if (!input.category.trim()) return { state, error: "กรุณากรอกหมวดสินค้า" };
  if (!input.unit.trim()) return { state, error: "กรุณากรอกหน่วยนับ" };
  if ((input.type === "purchased_finished_good" || input.type === "produced_finished_good") && input.salePrice <= 0) {
    return { state, error: "เมนูขายต้องมีราคาขายมากกว่า 0" };
  }
  if (input.standardCost !== undefined && input.standardCost < 0) return { state, error: "ต้นทุนต้องไม่ติดลบ" };
  const normalizedName = input.name.trim();
  const costStartDate = input.costStartDate?.trim() || today;
  const exactDuplicate = state.products.some(
    (product) =>
      product.name.trim() === normalizedName &&
      product.type === input.type &&
      (product.standardCost || 0) === (input.standardCost || 0) &&
      (product.costStartDate || today) === costStartDate,
  );
  if (exactDuplicate) return { state, error: "มีรายการชื่อนี้ ต้นทุนนี้ และวันที่นี้อยู่แล้ว" };
  const product: Product = {
    id: nextProductId(input.type, input.supplier, state.products),
    name: normalizedName,
    type: input.type,
    category: input.category.trim(),
    unit: input.unit.trim(),
    salePrice: input.type === "raw_material" || input.type === "packaging" ? undefined : input.salePrice,
    standardCost: input.standardCost,
    costStartDate,
    supplier: input.supplier?.trim() || undefined,
    active: true,
  };
  const products = state.products.map((item) => (item.name.trim() === normalizedName && item.type === input.type ? { ...item, active: false } : item));
  return {
    state: withAudit(
      { ...state, products: [...products, product] },
      {
        date: today,
        action: "เพิ่มสินค้า",
        targetType: "PRODUCT",
        targetId: product.id,
        detail: `${product.name} ประเภท ${product.type} ต้นทุน ${input.standardCost || 0} เริ่ม ${costStartDate}`,
      },
    ),
  };
}

export function setProductActive(state: AppState, productId: string, active: boolean): AppState {
  const product = productById(state.products, productId);
  return withAudit(
    {
      ...state,
      products: state.products.map((item) => (item.id === productId ? { ...item, active } : item)),
    },
    {
      date: today,
      action: active ? "เปิดใช้งานสินค้า" : "ปิดใช้งานสินค้า",
      targetType: "PRODUCT",
      targetId: productId,
      detail: product?.name || productId,
    },
  );
}

export function deleteProduct(state: AppState, productId: string): AppState {
  const product = productById(state.products, productId);
  return withAudit(
    {
      ...state,
      products: state.products.filter((item) => item.id !== productId),
    },
    {
      date: today,
      action: "ลบสินค้า",
      targetType: "PRODUCT",
      targetId: productId,
      detail: product?.name || productId,
    },
  );
}

function nextProductId(type: ProductType, supplier: string | undefined, products: Product[]) {
  const prefixByType: Record<ProductType, string> = {
    raw_material: "RM",
    packaging: "PK",
    purchased_finished_good: "PTG",
    produced_finished_good: "PGH",
  };
  const source = supplier?.trim();
  const prefix = source === "The Grand's" ? "PTG" : source === "Grand House" ? "PGH" : prefixByType[type];
  const next =
    products
      .map((product) => Number(product.id.replace(`${prefix}-`, "")))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${prefix}-${String(next).padStart(3, "0")}`;
}

export function addCashEntry(
  state: AppState,
  input: { date: string; branch: Branch; type: "รับเงิน" | "จ่ายเงิน"; category: string; purchaseQty?: number; paymentChannel?: PaymentChannel; expenseProductId?: string; amount: number; note: string },
) {
  const entry: CashEntry = { id: nextId("CASH", state.cashEntries), ...input };
  return withAudit(
    { ...state, cashEntries: [...state.cashEntries, entry] },
    {
      date: input.date,
      branch: input.branch,
      action: "บันทึกเงิน",
      targetType: "CASH",
      targetId: entry.id,
      detail: `${input.type} ${input.category} จำนวน ${input.amount}`,
    },
  );
}

export interface PosCartInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineType?: "ขาย" | "แถมโปร" | "แถมเอง";
  promoLabel?: string;
}

export type PosPaymentInput = Partial<Record<PaymentChannel, number>>;

export function createPosSale(
  state: AppState,
  input: { date: string; branch: Branch; channel?: PaymentChannel; payments?: PosPaymentInput; items: PosCartInput[]; note: string },
): { state: AppState; error?: string } {
  const cart = input.items.filter((item) => item.quantity > 0);
  if (cart.length === 0) return { state, error: "กรุณาเลือกสินค้าอย่างน้อย 1 รายการ" };
  const lots = state.lots.map((lot) => ({ ...lot }));
  const saleId = nextId("SALE", state.sales);
  const documentNo = nextDocumentNo("RC", input.date, state.sales.map((sale) => sale.documentNo));
  const saleItems: SaleItem[] = [];
  const movements: InventoryMovement[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let total = 0;
  let totalCost = 0;

  for (const cartItem of cart) {
    const product = productById(state.products, cartItem.productId);
    if (!product) return { state, error: `ไม่พบสินค้า ${cartItem.productId}` };
    let need = cartItem.quantity;
    const candidates = lots
      .filter((lot) => lot.productId === cartItem.productId && lot.branch === input.branch && lot.remaining > 0 && lotStatus(lot) !== "หมดอายุ" && lotStatus(lot) !== "ตัดเสีย")
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    for (const lot of candidates) {
      if (need <= 0) break;
      const take = Math.min(need, lot.remaining);
      const discountRatio = cartItem.quantity > 0 ? cartItem.discount / cartItem.quantity : 0;
      const lineDiscount = discountRatio * take;
      const lineRevenue = take * cartItem.unitPrice - lineDiscount;
      const lineCost = take * lot.unitCost;
      lot.remaining -= take;
      need -= take;
      subtotal += take * cartItem.unitPrice;
      totalDiscount += lineDiscount;
      total += lineRevenue;
      totalCost += lineCost;
      const itemId = nextId("ITEM", [...state.saleItems, ...saleItems]);
      saleItems.push({
        id: itemId,
        saleId,
        productId: cartItem.productId,
        lotId: lot.id,
        quantity: take,
        unitPrice: cartItem.unitPrice,
        discount: lineDiscount,
        revenue: lineRevenue,
        costOfGoods: lineCost,
        lineType: cartItem.lineType || (lineRevenue <= 0 ? "แถมโปร" : "ขาย"),
        promoLabel: cartItem.promoLabel,
      });
      movements.push({
        id: nextId("MOVE", [...state.movements, ...movements]),
        date: input.date,
        branch: input.branch,
        lotId: lot.id,
        productId: cartItem.productId,
        type: "POS",
        quantityChange: -take,
        valueChange: -lineCost,
        linkedId: saleId,
        note: `ขายผ่าน POS ${documentNo}`,
      });
    }
    if (need > 0.0001) return { state, error: `${product.name} มีสต็อกไม่พอหรือ LOT หมดอายุ` };
  }

  const vatAmount = state.taxSettings.vatEnabled ? calculateVat(total, state.taxSettings.vatRate, state.taxSettings.priceIncludesVat) : 0;
  const paymentRows = buildPosPayments(state, {
    saleId,
    date: input.date,
    branch: input.branch,
    channel: input.channel,
    payments: input.payments,
    total,
  });
  if (paymentRows.error) return { state, error: paymentRows.error };
  const sale: Sale = {
    id: saleId,
    documentNo,
    date: input.date,
    branch: input.branch,
    channel: paymentRows.primaryChannel,
    subtotal,
    discount: totalDiscount,
    total,
    costOfGoods: totalCost,
    grossProfit: total - totalCost,
    vatAmount,
    taxInvoiceNo: state.taxSettings.vatEnabled ? nextDocumentNo("TAX", input.date, state.documents.map((doc) => doc.documentNo)) : undefined,
    note: input.note,
  };
  const document: AccountingDocument = {
    id: nextId("DOC", state.documents),
    documentNo,
    type: state.taxSettings.vatEnabled ? "ใบกำกับภาษี" : "ใบเสร็จ",
    date: input.date,
    branch: input.branch,
    party: "ลูกค้าหน้าร้าน",
    category: "ยอดขาย",
    amountBeforeVat: total - vatAmount,
    vatAmount,
    totalAmount: total,
    linkedId: saleId,
    note: input.note,
  };

  return {
    state: withAudit(
      {
        ...state,
        lots,
        sales: [...state.sales, sale],
        saleItems: [...state.saleItems, ...saleItems],
        payments: [...state.payments, ...paymentRows.payments],
        movements: [...state.movements, ...movements],
        documents: [...state.documents, document],
      },
      {
        date: input.date,
        branch: input.branch,
        action: "ขายหน้าร้าน",
        targetType: "SALE",
        targetId: sale.id,
        detail: `${documentNo} รับเงิน ${paymentRows.paymentSummary} ยอด ${total}`,
      },
    ),
  };
}

function buildPosPayments(
  state: AppState,
  input: { saleId: string; date: string; branch: Branch; channel?: PaymentChannel; payments?: PosPaymentInput; total: number },
): { payments: Payment[]; primaryChannel: PaymentChannel; paymentSummary: string; error?: string } {
  const rawPayments = input.payments || (input.channel ? { [input.channel]: input.total } : {});
  const paidRows = paymentChannels
    .map((channel) => ({ channel, amount: Number(rawPayments[channel]) || 0 }))
    .filter((row) => row.amount > 0);
  if (paidRows.length === 0) return { payments: [], primaryChannel: "อื่นๆ", paymentSummary: "-", error: "กรุณากรอกยอดรับเงินอย่างน้อย 1 ช่องทาง" };
  const paidTotal = paidRows.reduce((sum, row) => sum + row.amount, 0);
  if (Math.abs(paidTotal - input.total) > 0.01) return { payments: [], primaryChannel: "อื่นๆ", paymentSummary: "-", error: `ยอดรับเงินต้องเท่ากับยอดรวมบิล ${money(input.total)}` };
  const primaryChannel = paidRows.length === 1 ? paidRows[0].channel : "อื่นๆ";
  const payments: Payment[] = [];
  for (const row of paidRows) {
    payments.push({
      id: nextId("PAY", [...state.payments, ...payments]),
      saleId: input.saleId,
      date: input.date,
      branch: input.branch,
      channel: row.channel,
      amount: row.amount,
    });
  }
  return {
    payments,
    primaryChannel,
    paymentSummary: paidRows.map((row) => `${row.channel} ${row.amount}`).join(", "),
  };
}

export function closeShift(
  state: AppState,
  input: { date: string; branch: Branch; actualByChannel: Record<PaymentChannel, number>; note: string },
): AppState {
  const expectedByChannel = paymentChannels.reduce(
    (acc, channel) => ({
      ...acc,
      [channel]: state.payments
        .filter((payment) => payment.date === input.date && payment.branch === input.branch && payment.channel === channel)
        .reduce((sum, payment) => sum + payment.amount, 0),
    }),
    {} as Record<PaymentChannel, number>,
  );
  const sales = activeSales(state).filter((sale) => sale.date === input.date && sale.branch === input.branch);
  const expectedTotal = paymentChannels.reduce((sum, channel) => sum + expectedByChannel[channel], 0);
  const actualTotal = paymentChannels.reduce((sum, channel) => sum + input.actualByChannel[channel], 0);
  const salesTotal = sales.reduce((sum, sale) => sum + sale.total, 0);
  const costOfGoods = sales.reduce((sum, sale) => sum + sale.costOfGoods, 0);
  const shift: CloseShift = {
    id: nextId("SHIFT", state.closeShifts),
    documentNo: nextDocumentNo("SHIFT", input.date, state.closeShifts.map((item) => item.documentNo)),
    date: input.date,
    branch: input.branch,
    expectedByChannel,
    actualByChannel: input.actualByChannel,
    expectedTotal,
    actualTotal,
    difference: actualTotal - expectedTotal,
    salesTotal,
    costOfGoods,
    grossProfit: salesTotal - costOfGoods,
    note: input.note,
  };
  return withAudit(
    { ...state, closeShifts: [...state.closeShifts, shift] },
    {
      date: input.date,
      branch: input.branch,
      action: "ปิดกะ",
      targetType: "SHIFT",
      targetId: shift.id,
      detail: `${shift.documentNo} ยอดระบบ ${expectedTotal} ยอดจริง ${actualTotal} ส่วนต่าง ${shift.difference}`,
    },
  );
}

export function voidSale(
  state: AppState,
  input: { saleId: string; date: string; reason: string },
): { state: AppState; error?: string } {
  const sale = state.sales.find((item) => item.id === input.saleId);
  if (!sale) return { state, error: "ไม่พบบิลขาย" };
  if (sale.status === "ยกเลิก") return { state, error: "บิลนี้ถูกยกเลิกแล้ว" };
  if (!input.reason.trim()) return { state, error: "กรุณากรอกเหตุผลยกเลิกบิล" };

  const saleItems = state.saleItems.filter((item) => item.saleId === sale.id);
  const lots = state.lots.map((lot) => ({ ...lot }));
  const movements: InventoryMovement[] = [];

  for (const item of saleItems) {
    const lot = lots.find((candidate) => candidate.id === item.lotId);
    if (lot) {
      lot.remaining += item.quantity;
    }
    movements.push({
      id: nextId("MOVE", [...state.movements, ...movements]),
      date: input.date,
      branch: sale.branch,
      lotId: item.lotId,
      productId: item.productId,
      type: "ยกเลิกบิล",
      quantityChange: item.quantity,
      valueChange: item.costOfGoods,
      linkedId: sale.id,
      note: `ยกเลิก ${sale.documentNo}: ${input.reason}`,
    });
  }

  const salePayments = state.payments.filter((payment) => payment.saleId === sale.id && payment.amount > 0);
  const reversalPayments: Payment[] = [];
  for (const payment of salePayments) {
    reversalPayments.push({
      id: nextId("PAY", [...state.payments, ...reversalPayments]),
      saleId: sale.id,
      date: input.date,
      branch: sale.branch,
      channel: payment.channel,
      amount: -payment.amount,
    });
  }

  const creditNote: AccountingDocument = {
    id: nextId("DOC", state.documents),
    documentNo: nextDocumentNo("CN", input.date, state.documents.map((doc) => doc.documentNo)),
    type: "ใบลดหนี้",
    date: input.date,
    branch: sale.branch,
    party: "ลูกค้าหน้าร้าน",
    category: "ยกเลิกบิลขาย",
    amountBeforeVat: -(sale.total - sale.vatAmount),
    vatAmount: -sale.vatAmount,
    totalAmount: -sale.total,
    linkedId: sale.id,
    note: input.reason,
  };

  return {
    state: withAudit(
      {
        ...state,
        lots,
        sales: state.sales.map((item) =>
          item.id === sale.id
            ? {
                ...item,
                status: "ยกเลิก",
                voidedDate: input.date,
                voidReason: input.reason,
              }
            : item,
        ),
        payments: [...state.payments, ...reversalPayments],
        movements: [...state.movements, ...movements],
        documents: [...state.documents, creditNote],
      },
      {
        date: input.date,
        branch: sale.branch,
        action: "ยกเลิกบิล",
        targetType: "SALE",
        targetId: sale.id,
        detail: `${sale.documentNo} คืนสต็อก ${saleItems.length} รายการ เหตุผล: ${input.reason}`,
      },
    ),
  };
}

export function updateTaxSettings(state: AppState, input: TaxSettings): AppState {
  return withAudit(
    { ...state, taxSettings: input },
    {
      date: today,
      action: "ตั้งค่าภาษี",
      targetType: "TAX",
      targetId: "VAT",
      detail: `VAT ${input.vatEnabled ? "เปิด" : "ปิด"} อัตรา ${input.vatRate}% ราคา${input.priceIncludesVat ? "รวม VAT" : "ยังไม่รวม VAT"}`,
    },
  );
}

function nextDocumentNo(prefix: string, date: string, existing: string[]) {
  const ym = date.slice(0, 7).replace("-", "");
  const docPrefix = `${prefix}-${ym}-`;
  const next =
    existing
      .filter((doc) => doc.startsWith(docPrefix))
      .map((doc) => Number(doc.replace(docPrefix, "")))
      .filter(Number.isFinite)
      .reduce((max, value) => Math.max(max, value), 0) + 1;
  return `${docPrefix}${String(next).padStart(4, "0")}`;
}

function calculateVat(total: number, vatRate: number, priceIncludesVat: boolean) {
  if (vatRate <= 0) return 0;
  if (priceIncludesVat) return total - total / (1 + vatRate / 100);
  return total * (vatRate / 100);
}
