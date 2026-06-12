import type { LocalState, PaymentMethod } from "../types";
import { dateOffsetBangkok, makeId, nowIso, todayBangkok } from "../utils/ids";

export const paymentMethods: PaymentMethod[] = ["QR1", "QR2", "GRAB", "CASH", "THAI_HELP_THAI", "OTHER"];

export function createSeedState(): LocalState {
  const now = nowIso();
  const today = todayBangkok();
  const yesterday = dateOffsetBangkok(today, -1);
  const nextWeek = dateOffsetBangkok(today, 7);
  return {
    users: [
      {
        id: "USR-OWNER",
        user_id: "owner",
        password: "owner1234",
        display_name: "เจ้าของ Grand's House",
        role: "owner",
        branch_id: "ALL",
        active: true,
        approval_pin: "246810",
        failed_attempts: 0,
        pin_failed_attempts: 0,
        pin_locked_until: ""
      },
      {
        id: "USR-OFFICE",
        user_id: "office01",
        password: "office1234",
        display_name: "ออฟฟิศกลาง",
        role: "office",
        branch_id: "ALL",
        active: true,
        failed_attempts: 0,
        pin_failed_attempts: 0,
        pin_locked_until: ""
      },
      {
        id: "USR-KASET",
        user_id: "kaset01",
        password: "staff1234",
        display_name: "หน้าร้านเกษตรใหม่",
        role: "staff",
        branch_id: "BR-KASET",
        active: true,
        failed_attempts: 0,
        pin_failed_attempts: 0,
        pin_locked_until: ""
      },
      {
        id: "USR-THARUA",
        user_id: "tharua01",
        password: "staff1234",
        display_name: "หน้าร้านท่ารั้ว",
        role: "staff",
        branch_id: "BR-THARUA",
        active: true,
        failed_attempts: 0,
        pin_failed_attempts: 0,
        pin_locked_until: ""
      },
      {
        id: "USR-BANJO",
        user_id: "banjo01",
        password: "staff1234",
        display_name: "หน้าร้านบ้านโจ้",
        role: "staff",
        branch_id: "BR-BANJO",
        active: true,
        failed_attempts: 0,
        pin_failed_attempts: 0,
        pin_locked_until: ""
      }
    ],
    branches: [
      { branch_id: "BR-KASET", branch_name: "เกษตรใหม่", active: true },
      { branch_id: "BR-THARUA", branch_name: "ท่ารั้ว", active: true },
      { branch_id: "BR-BANJO", branch_name: "บ้านโจ้", active: true }
    ],
    products: [
      {
        id: "PRD-KAPRAO",
        item_code: "PTG-001",
        name_th: "ข้าวผัดกะเพรา",
        name_my: "ထမင်းကြော် ကပေါ်",
        image_url: "/products/PTG-001.svg",
        image_data: "",
        category: "rice_box",
        source_type: "parent",
        sell_price: 4500,
        staff_price: 2500,
        shelf_life_days: 1,
        is_perishable: true,
        active: true
      },
      {
        id: "PRD-PORKSTICKY",
        item_code: "PTG-002",
        name_th: "ข้าวเหนียวหมูปิ้ง",
        name_my: "ဝက်သားကင် ကောက်ညှင်း",
        image_url: "/products/PTG-002.svg",
        image_data: "",
        category: "rice_box",
        source_type: "parent",
        sell_price: 3500,
        staff_price: 2000,
        shelf_life_days: 1,
        is_perishable: true,
        active: true
      },
      {
        id: "PRD-STRAWBERRY-MILK",
        item_code: "PGH-001",
        name_th: "นมสตรอว์เบอร์รี",
        name_my: "စတော်ဘယ်ရီ နို့",
        image_url: "/products/PGH-001.svg",
        image_data: "",
        category: "drink",
        source_type: "self_produced",
        sell_price: 3000,
        staff_price: 1800,
        shelf_life_days: 7,
        is_perishable: true,
        active: true
      },
      {
        id: "PRD-SNACK",
        item_code: "PTG-003",
        name_th: "ขนมคบเคี้ยว",
        name_my: "မုန့်",
        image_url: "/products/PTG-003.svg",
        image_data: "",
        category: "snack",
        source_type: "parent",
        sell_price: 2000,
        staff_price: 1200,
        shelf_life_days: 30,
        is_perishable: false,
        active: true
      }
    ],
    finishedLots: [
      {
        lot_id: "FLOT-KASET-KAPRAO-1",
        branch_id: "BR-KASET",
        product_id: "PRD-KAPRAO",
        qty_in: 40,
        qty_remaining: 32,
        unit_cost: 1800,
        received_date: today,
        expiry_date: today,
        source: "parent_receive",
        source_ref: "GRC-SEED-1",
        extend_count: 0
      },
      {
        lot_id: "FLOT-KASET-MILK-1",
        branch_id: "BR-KASET",
        product_id: "PRD-STRAWBERRY-MILK",
        qty_in: 30,
        qty_remaining: 22,
        unit_cost: 1200,
        received_date: yesterday,
        expiry_date: nextWeek,
        source: "production",
        source_ref: "PRO-SEED-1",
        extend_count: 0
      },
      {
        lot_id: "FLOT-THARUA-PORK-1",
        branch_id: "BR-THARUA",
        product_id: "PRD-PORKSTICKY",
        qty_in: 35,
        qty_remaining: 27,
        unit_cost: 1500,
        received_date: today,
        expiry_date: today,
        source: "parent_receive",
        source_ref: "GRC-SEED-2",
        extend_count: 0
      },
      {
        lot_id: "FLOT-BANJO-SNACK-1",
        branch_id: "BR-BANJO",
        product_id: "PRD-SNACK",
        qty_in: 80,
        qty_remaining: 73,
        unit_cost: 900,
        received_date: yesterday,
        expiry_date: nextWeek,
        source: "parent_receive",
        source_ref: "GRC-SEED-3",
        extend_count: 0
      }
    ],
    rawMaterials: [
      {
        id: "RAW-PORK",
        item_code: "RM-001",
        name_th: "หมู",
        name_my: "ဝက်သား",
        warehouse: "raw_fresh",
        base_unit: "g",
        display_unit: "kg",
        display_factor: 1000,
        is_packaging: false,
        active: true
      },
      {
        id: "RAW-RICE",
        item_code: "RM-002",
        name_th: "ข้าวสาร",
        name_my: "ဆန်",
        warehouse: "dry_supply",
        base_unit: "g",
        display_unit: "kg",
        display_factor: 1000,
        is_packaging: false,
        active: true
      },
      {
        id: "RAW-MILK",
        item_code: "RM-003",
        name_th: "นมสด",
        name_my: "နို့",
        warehouse: "raw_fresh",
        base_unit: "ml",
        display_unit: "L",
        display_factor: 1000,
        is_packaging: false,
        active: true
      },
      {
        id: "RAW-BOTTLE",
        item_code: "PK-001",
        name_th: "ขวดนม",
        name_my: "ဘူး",
        warehouse: "dry_supply",
        base_unit: "piece",
        display_unit: "ชิ้น",
        display_factor: 1,
        is_packaging: true,
        active: true
      },
      {
        id: "RAW-BOX",
        item_code: "PK-002",
        name_th: "กล่องอาหาร",
        name_my: "ထမင်းဘူး",
        warehouse: "dry_supply",
        base_unit: "piece",
        display_unit: "ชิ้น",
        display_factor: 1,
        is_packaging: true,
        active: true
      }
    ],
    supplyItems: [
      {
        id: "SUP-DISHSOAP",
        item_code: "SUP-001",
        name_th: "น้ำยาล้างจาน",
        name_my: "ပန်းကန်ဆေးရည်",
        category: "cleaning",
        unit: "ขวด",
        active: true
      }
    ],
    rawLots: [
      {
        lot_id: "RLOT-PORK-1",
        material_id: "RAW-PORK",
        branch_id: "BR-KASET",
        qty_in: 5000,
        qty_remaining: 2000,
        unit_cost: 10,
        purchase_date: yesterday,
        supplier_note: "ตลาดเช้า"
      },
      {
        lot_id: "RLOT-PORK-2",
        material_id: "RAW-PORK",
        branch_id: "BR-KASET",
        qty_in: 5000,
        qty_remaining: 5000,
        unit_cost: 12,
        purchase_date: today,
        supplier_note: "ตลาดเช้า"
      },
      {
        lot_id: "RLOT-MILK-1",
        material_id: "RAW-MILK",
        branch_id: "BR-KASET",
        qty_in: 20_000,
        qty_remaining: 15_000,
        unit_cost: 2,
        purchase_date: today,
        supplier_note: "ฟาร์มท้องถิ่น"
      },
      {
        lot_id: "RLOT-BOTTLE-1",
        material_id: "RAW-BOTTLE",
        branch_id: "BR-KASET",
        qty_in: 100,
        qty_remaining: 72,
        unit_cost: 250,
        purchase_date: yesterday,
        supplier_note: "ร้านบรรจุภัณฑ์"
      },
      {
        lot_id: "RLOT-BOX-1",
        material_id: "RAW-BOX",
        branch_id: "BR-KASET",
        qty_in: 200,
        qty_remaining: 160,
        unit_cost: 300,
        purchase_date: yesterday,
        supplier_note: "ร้านบรรจุภัณฑ์"
      }
    ],
    recipes: [
      {
        id: "RCP-MILK",
        product_id: "PRD-STRAWBERRY-MILK",
        name: "นมสตรอว์เบอร์รีมาตรฐาน",
        active: true
      }
    ],
    recipeItems: [
      { id: "RCI-MILK-RAW", recipe_id: "RCP-MILK", material_id: "RAW-MILK", qty_per_unit: 250 },
      { id: "RCI-MILK-BOTTLE", recipe_id: "RCP-MILK", material_id: "RAW-BOTTLE", qty_per_unit: 1 }
    ],
    sales: [],
    saleItems: [],
    wastage: [],
    goodsReceipts: [],
    productionOrders: [],
    stockAdjustments: [],
    reconciliations: [],
    expenses: [
      {
        id: "EXP-SEED-1",
        branch_id: "BR-KASET",
        user_id: "office01",
        expense_type: "utility_electric",
        amount: 320000,
        expense_month: today.slice(0, 7),
        note: "ค่าไฟตัวอย่างสำหรับ local",
        created_at: now
      }
    ],
    dailySummary: [],
    priceHistory: [],
    devices: [],
    errorLog: [],
    stockMovements: [],
    auditLog: [
      {
        id: makeId("AUD"),
        timestamp: now,
        user_id: "system",
        role: "system",
        branch_id: "ALL",
        action: "SEED_LOCAL_STATE",
        feature_group: "admin",
        ref_id: "LOCAL",
        detail: "Fresh local seed created from implementation plan",
        flag: "",
        device_id: "LOCAL",
        success: true,
        prev_hash: "GENESIS",
        row_hash: "LOCAL-SEED-HASH"
      }
    ],
    config: {
      void_window_minutes: 15,
      day_cutoff_hour: 0,
      suspicious_price_pct: 50,
      suspicious_staffsale_per_day: 5,
      suspicious_wastage_value: 50000,
      suspicious_adjust_per_week: 5,
      rate_limit_per_min: 60,
      global_rate_limit_per_min: 600,
      login_lockout_attempts: 5,
      lockout_minutes: 15,
      schema_version: 1,
      catalog_version: 1
    }
  };
}
