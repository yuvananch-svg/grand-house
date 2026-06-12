# 🏗️ Grand's House — Engineering Master Plan (แผนวิศวกรรมซอฟต์แวร์ฉบับสมบูรณ์)

> เอกสารฉบับนี้คือ "พิมพ์เขียวทางเทคนิค (Technical Blueprint)" สำหรับสร้างเว็บแอประบบบันทึกข้อมูลร้านอาหาร **Grand's House** ตามข้อกำหนดใน `plan.md` ทั้งหมด
> เขียนขึ้นเพื่อใช้ **สั่งงาน AI ตัวถัดไป (AI Coding Agent)** ได้โดยตรง — ทุกหัวข้อระบุว่า ต้องเขียนโค้ดอะไร, ไฟล์อะไร, ฟังก์ชันอะไร, ข้อมูลวิ่งจากไหนไปไหน, และเชื่อมกับ Google Sheets อย่างไร

---

## 0. ภาพรวมสถาปัตยกรรม (System Architecture Overview)

```
┌─────────────────────────────────────────────────────────────────┐
│                        ผู้ใช้งาน 3 ระดับ                          │
│  📱 พนักงานหน้าร้าน      💻 พนักงานออฟฟิศ      👑 ผู้ประกอบการ      │
│  (แท็บเล็ต/มือถือ)        (Laptop/PC)           (ทุกอุปกรณ์)        │
└──────────┬──────────────────┬──────────────────────┬─────────────┘
           │                  │                      │
           ▼                  ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              FRONTEND: Progressive Web App (PWA)                 │
│   React + Vite + TypeScript + Tailwind CSS                      │
│   - Service Worker (ทำงานออฟไลน์ได้ 100%)                        │
│   - IndexedDB ผ่านไลบรารี Dexie.js (กันข้อมูลหายแม้ปิดเครื่อง)     │
│   - Sync Queue Engine (คิวรอส่งข้อมูลเมื่อเน็ตกลับมา)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS (JSON API)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│         BACKEND: Google Apps Script Web App (API Layer)          │
│   - doPost(e) / doGet(e) ทำหน้าที่เป็น REST-like API             │
│   - ตรวจ Token + สิทธิ์ 3 ระดับ + แยกข้อมูลรายสาขา                │
│   - Business Logic: FIFO Costing, BOM, Reconciliation, Audit    │
│   - LockService กันข้อมูลชนกันเมื่อเขียนพร้อมกันหลายเครื่อง          │
└──────────────────────────┬──────────────────────────────────────┘
                           │ SpreadsheetApp API
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│            DATABASE: Google Sheets (1 Spreadsheet)               │
│   18 ชีต (ตาราง) — ออกแบบเหมือนฐานข้อมูลเชิงสัมพันธ์ (Relational)  │
└─────────────────────────────────────────────────────────────────┘
```

### 0.1 เหตุผลการเลือกเทคโนโลยี (Tech Stack Decision)

| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Frontend | **React 18 + Vite + TypeScript** | สร้าง PWA ได้ง่าย, ecosystem ใหญ่, AI agent ทุกตัวเขียนได้คล่อง |
| UI Framework | **Tailwind CSS** | ทำปุ่มใหญ่ + รูปภาพ (No-typing layout) ได้เร็ว ปรับ responsive ง่าย |
| Offline DB | **Dexie.js (IndexedDB wrapper)** | ข้อมูลไม่หายแม้ปิดเบราว์เซอร์/แบตหมด ต่างจาก LocalStorage ที่จำกัด 5MB |
| PWA | **vite-plugin-pwa (Workbox)** | Cache หน้าเว็บ+รูปสินค้าทั้งหมด เปิดใช้ได้แม้ไม่มีเน็ตตั้งแต่ต้น |
| Backend API | **Google Apps Script (GAS) Web App** | ฟรี, เชื่อม Google Sheets โดยตรง (เป็น native), ไม่ต้องเช่าเซิร์ฟเวอร์ |
| Database | **Google Sheets** | ตามที่เจ้าของกำหนด — เจ้าของเปิดดู/แก้ข้อมูลดิบเองได้ |
| PDF Export | **pdfmake (client-side)** | สร้าง PDF งบการเงิน A4 ในเบราว์เซอร์ได้เลย ไม่ต้องมีเซิร์ฟเวอร์ Python (ทดแทน Weasyprint เพราะ GAS รัน Python ไม่ได้ — ผลลัพธ์หน้าตาเอกสารทางการเหมือนกัน) |
| Charts | **Recharts** | กราฟ Dashboard สวย ใช้กับ React ตรงๆ |
| Hosting Frontend | **Firebase Hosting หรือ Vercel (ฟรี)** | HTTPS ฟรี (จำเป็นสำหรับ PWA/Service Worker) |

> ⚠️ **ข้อจำกัดที่ต้องรู้ของ Google Sheets:** รองรับ ~10 ล้านเซลล์/ไฟล์ และ GAS มี quota รัน 6 นาที/ครั้ง — เพียงพอสำหรับร้าน 3 สาขาไปได้หลายปี แต่แผนนี้ออกแบบ API Layer แยกชั้นไว้แล้ว วันหนึ่งถ้าโตเกิน ย้ายไป Supabase/PostgreSQL ได้โดย **ไม่ต้องแก้โค้ด Frontend เลย** (แก้แค่ URL กับ API layer)

### 0.2 โครงสร้างโฟลเดอร์โปรเจกต์ (Repository Structure)

```
grands-house/
├── frontend/                      # React PWA
│   ├── src/
│   │   ├── api/
│   │   │   ├── client.ts          # ฟังก์ชันกลาง callApi() ยิงไป GAS
│   │   │   └── endpoints.ts       # รวมชื่อ action ทั้งหมด (type-safe)
│   │   ├── db/
│   │   │   ├── dexie.ts           # นิยามตาราง IndexedDB
│   │   │   └── syncEngine.ts      # คิว sync ออฟไลน์ → คลาวด์
│   │   ├── stores/                # Zustand state stores
│   │   │   ├── authStore.ts
│   │   │   ├── cartStore.ts       # ตะกร้าขายหน้าร้าน
│   │   │   └── productStore.ts    # แคชสินค้า+ราคา+รูป
│   │   ├── pages/
│   │   │   ├── Login.tsx
│   │   │   ├── pos/               # ระดับ 1: หน้าร้าน
│   │   │   │   ├── SaleTypeSelect.tsx
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── Checkout.tsx
│   │   │   │   └── Wastage.tsx
│   │   │   ├── office/            # ระดับ 2: ออฟฟิศ
│   │   │   │   ├── GoodsReceive.tsx
│   │   │   │   ├── Reconcile.tsx
│   │   │   │   ├── Expenses.tsx
│   │   │   │   ├── Inventory.tsx
│   │   │   │   ├── Production.tsx
│   │   │   │   └── StockAdjust.tsx
│   │   │   └── owner/             # ระดับ 3: ผู้ประกอบการ
│   │   │       ├── Dashboard.tsx
│   │   │       ├── RevenueAnalysis.tsx
│   │   │       ├── FinancialReport.tsx
│   │   │       ├── RecipeManager.tsx
│   │   │       └── AuditLog.tsx
│   │   ├── components/            # ปุ่มใหญ่, การ์ดสินค้า, Numpad ฯลฯ
│   │   ├── utils/money.ts         # คำนวณเงินด้วยสตางค์ (integer) กันทศนิยมเพี้ยน
│   │   └── App.tsx                # Router + Route Guard ตามสิทธิ์
│   └── vite.config.ts             # ตั้งค่า PWA
└── backend/                       # Google Apps Script (deploy ด้วย clasp)
    ├── Main.gs                    # doPost/doGet — router กลาง
    ├── Auth.gs                    # login, token, สิทธิ์ 3 ระดับ
    ├── Sales.gs                   # รับสลิปขาย + ตัดสต็อก
    ├── Wastage.gs                 # บันทึกของเสีย
    ├── Inventory.gs               # 4 คลัง + FIFO Lot Engine
    ├── Production.gs              # BOM + ผลิตสินค้า + ล็อกต้นทุน
    ├── Reconcile.gs               # ตรวจบัญชีรายวัน
    ├── Expenses.gs                # ค่าใช้จ่ายรายเดือน
    ├── Reports.gs                 # Dashboard + งบการเงิน 10-K/10-Q
    ├── Audit.gs                   # บันทึกทุกการกระทำ
    └── SheetDB.gs                 # ชั้นอ่าน/เขียนชีต (ORM อย่างง่าย)
```

---

## 1. การออกแบบฐานข้อมูล Google Sheets (Database Schema — 18 ชีต)

สร้าง Google Spreadsheet **1 ไฟล์** ชื่อ `GrandsHouse_DB` แต่ละชีตคือ 1 ตาราง แถวแรกเป็น header เสมอ ทุกตารางมี `id` (รูปแบบ `<prefix>-<timestamp>-<random4>` เช่น `SAL-1718000000-x7k2`) สร้างจากฝั่ง client เพื่อรองรับออฟไลน์ (กันซ้ำด้วย idempotency — ดูข้อ 3.4)

### ชีต 1: `Users` — ผู้ใช้งาน
| คอลัมน์ | ชนิด | คำอธิบาย |
|---|---|---|
| id | string | USR-xxx |
| user_id | string | รหัสล็อกอิน เช่น `kaset01` |
| password_hash | string | SHA-256(password + salt) — **ห้ามเก็บ plain text** |
| salt | string | สุ่มต่อคน |
| display_name | string | ชื่อแสดงผล |
| role | enum | `staff` / `office` / `owner` |
| branch_id | string | `BR-KASET` / `BR-THARUA` / `BR-BANJO` / `ALL` (เฉพาะ owner/office) |
| active | boolean | ปิดบัญชีได้โดยไม่ลบประวัติ |

### ชีต 2: `Branches` — สาขา
| คอลัมน์ | ค่า |
|---|---|
| branch_id | `BR-KASET`, `BR-THARUA`, `BR-BANJO` |
| branch_name | เกษตรใหม่, ท่ารั้ว, บ้านโจ้ |
| active | TRUE |

### ชีต 3: `Products` — สินค้าสำเร็จรูป (ที่ขายหน้าร้าน)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | PRD-xxx |
| name_th | ชื่อไทย เช่น "ข้าวผัดกะเพรา" |
| image_url | ลิงก์รูป (เก็บใน Google Drive โฟลเดอร์สาธารณะ หรือ Firebase Storage) |
| category | `rice_box` / `drink` / `snack` / `breakfast` |
| source_type | `parent` (รับจากบริษัทแม่) / `self_produced` (ผลิตเอง) |
| sell_price | ราคาขายปกติ (สตางค์ เช่น 4500 = 45.00 บาท) |
| staff_price | ราคาขายพนักงานตอนเย็น (สตางค์) |
| shelf_life_days | อายุสินค้า (วัน) — ข้าวกล่อง = 1, นม = 7 ฯลฯ |
| is_perishable | TRUE = ต้องเช็กหมดอายุตอนเย็น |
| active | TRUE/FALSE |

### ชีต 4: `FinishedStock` — สต็อกสินค้าสำเร็จรูปรายสาขา **แยกเป็นล็อต**
หัวใจของระบบต้นทุน: สต็อกสำเร็จรูปเก็บเป็นล็อตเสมอ เพื่อล็อกต้นทุนติดตัวสินค้า (Cost Locking ตาม plan ข้อ 5.1)
| คอลัมน์ | คำอธิบาย |
|---|---|
| lot_id | FLOT-xxx |
| branch_id | สาขาเจ้าของสต็อก |
| product_id | อ้างถึง Products |
| qty_in | จำนวนรับเข้า |
| qty_remaining | จำนวนคงเหลือ (ลดลงเมื่อขาย/ทิ้ง) |
| unit_cost | **ต้นทุนต่อชิ้นของล็อตนี้ (สตางค์) — ล็อกตายตัว ห้ามแก้** |
| received_date | วันที่รับเข้า/ผลิต |
| expiry_date | received_date + shelf_life_days (แก้ได้ตอนเย็นถ้าพนักงานยืดอายุ) |
| source | `parent_receive` / `production` |
| source_ref | id ของรายการรับเข้า/ใบผลิต |

### ชีต 5: `Sales` — หัวสลิปขาย (1 แถว = 1 บิล)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | SAL-xxx (สร้างจาก client — กุญแจ idempotency) |
| branch_id, user_id | ใครขาย ที่สาขาไหน |
| sale_type | `normal` / `discount` / `freebie` / `staff` |
| payment_method | `QR1` / `QR2` / `GRAB` / `CASH` / `THAI_HELP_THAI` / `OTHER` |
| total_amount | ยอดรวมที่เก็บเงินจริง (สตางค์) |
| cash_received | เงินสดรับจริง (เฉพาะ CASH) |
| change_given | เงินทอน (เฉพาะ CASH) |
| total_cogs | ต้นทุนรวมของบิล (back-end คำนวณ FIFO ตอน sync) |
| created_at | เวลากดจบการขาย **ที่เครื่องลูกค้า** (สำคัญ! ไม่ใช่เวลา sync — รายงานรายวันจะตรง) |
| synced_at | เวลาข้อมูลถึงคลาวด์ |
| reconcile_status | `pending` / `reconciled` |

### ชีต 6: `SaleItems` — รายการสินค้าในบิล (1 แถว = 1 สินค้า)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | SIT-xxx |
| sale_id | อ้างถึง Sales |
| product_id, qty | สินค้า + จำนวน |
| unit_price | ราคาขายจริงต่อชิ้น (0 = ของแถม / แก้ราคาได้กรณีลดราคา) |
| is_freebie | TRUE = ตัวแถม (ราคา 0 แต่ตัดสต็อก+คิดต้นทุนปกติ) |
| unit_cost | ต้นทุนจริงต่อชิ้น (back-end เติมจาก FIFO lot ตอนตัดสต็อก) |
| lot_breakdown | JSON เช่น `[{"lot":"FLOT-1","qty":2,"cost":2500}]` — ร่องรอยว่าตัดล็อตไหนบ้าง |

### ชีต 7: `Wastage` — ของเสีย/หมดอายุ
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | WST-xxx |
| branch_id, user_id, product_id, qty | ใคร ที่ไหน ทิ้งอะไร กี่ชิ้น |
| total_cost_value | มูลค่าของเสีย = Σ(qty × unit_cost ของล็อตที่ถูกตัด) — back-end คำนวณ |
| lot_breakdown | JSON ร่องรอยล็อต |
| created_at | เวลาบันทึก |

### ชีต 8: `RawMaterials` — ทะเบียนวัตถุดิบ/ของแห้ง/บรรจุภัณฑ์
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | RAW-xxx |
| name_th | เช่น "เนื้อหมู", "กล่องอาหาร", "น้ำมันพืช" |
| warehouse | `raw_fresh` (คลัง 3: ของสด) / `dry_supply` (คลัง 4: ของแห้ง+บรรจุภัณฑ์) |
| unit | `kg` / `L` / `piece` / `box` / `pack` |
| is_packaging | TRUE = บรรจุภัณฑ์คงที่ (กล่อง ถุง ช้อน หลอด ขวด) |

### ชีต 9: `RawLots` — ล็อตวัตถุดิบ (หัวใจ FIFO)
| คอลัมน์ | คำอธิบาย |
|---|---|
| lot_id | RLOT-xxx |
| material_id | อ้างถึง RawMaterials |
| branch_id | คลังของสาขาไหน (หรือ `CENTRAL` คลังกลาง) |
| qty_in, qty_remaining | รับเข้า / คงเหลือ |
| unit_cost | ต้นทุนต่อหน่วยของล็อตนี้ (สตางค์) |
| purchase_date | วันที่ซื้อ — ใช้เรียง FIFO |
| supplier_note | ซื้อจากไหน (จดอิสระ) |

### ชีต 10: `Recipes` — หัวสูตรอาหาร (BOM)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | RCP-xxx |
| product_id | สูตรนี้ผลิตสินค้าตัวไหน |
| name | ชื่อสูตร |
| active | ใช้งานอยู่ไหม (แก้สูตร = ปิดตัวเก่า เปิดตัวใหม่ → ประวัติไม่เพี้ยน) |

### ชีต 11: `RecipeItems` — ส่วนประกอบสูตร (กี่ชนิดก็ได้ รองรับ 10+)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | RCI-xxx |
| recipe_id | อ้างถึง Recipes |
| material_id | วัตถุดิบ/บรรจุภัณฑ์ |
| qty_per_unit | ปริมาณต่อการผลิต 1 ชิ้น เช่น หมู 0.15 kg, กล่อง 1 piece |

### ชีต 12: `ProductionOrders` — ใบสั่งผลิต
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | PRO-xxx |
| branch_id, user_id, recipe_id | ใครผลิต สูตรไหน ที่ไหน |
| qty_produced | จำนวนชุดที่ผลิต |
| total_material_cost | ต้นทุนวัตถุดิบรวม (FIFO ข้ามล็อตได้ — Lot Overlapping) |
| total_packaging_cost | ต้นทุนบรรจุภัณฑ์รวม |
| unit_cost_locked | (วัตถุดิบ+บรรจุภัณฑ์) ÷ จำนวน = **ต้นทุนต่อชิ้นที่ล็อกตลอดไป** |
| consumption_detail | JSON: ใช้ล็อตไหน กี่หน่วย ราคาเท่าไร ต่อวัตถุดิบทุกตัว |
| created_at | วันเวลาผลิต |

### ชีต 13: `GoodsReceipts` — รับข้าวกล่องจากบริษัทแม่
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | GRC-xxx |
| branch_id, user_id | ออฟฟิศคีย์ให้สาขาไหน |
| product_id, qty | รับอะไร กี่ชิ้น |
| unit_cost | ราคาส่งจากบริษัทแม่ต่อชิ้น (สตางค์) |
| received_date | วันรับ |

### ชีต 14: `StockAdjustments` — ปรับจูนสต็อก (ต้องมีรหัสเจ้าของอนุมัติ)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | ADJ-xxx |
| user_id | ออฟฟิศคนที่ขอปรับ |
| approved_by | **user_id ของ owner ที่ใส่รหัสยืนยัน** (บังคับ) |
| target_type | `raw_lot` / `finished_lot` |
| lot_id | ล็อตที่ปรับ |
| qty_before, qty_after | ก่อน/หลัง |
| reason | เหตุผล (บังคับกรอก) |
| created_at | เวลา |

### ชีต 15: `Reconciliations` — ตรวจบัญชีรายวัน
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | RCN-xxx |
| branch_id, business_date | สาขา + วันที่ของยอด |
| system_qr1, system_qr2, system_grab, system_cash, system_thai, system_other | ยอดตามระบบ (ดึงจาก Sales อัตโนมัติ) |
| actual_qr1, actual_qr2, ... actual_other | ยอดจริงที่ออฟฟิศตรวจกับ statement/นับเงินสด |
| diff_total | ผลต่างรวม |
| status | `pending` / `reconciled` / `mismatch` |
| reconciled_by, reconciled_at | ใครยืนยัน เมื่อไร |
| note | หมายเหตุกรณียอดไม่ตรง |

### ชีต 16: `Expenses` — ค่าใช้จ่าย
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | EXP-xxx |
| branch_id, user_id | สาขา + คนคีย์ |
| expense_type | `salary` (ค่าแรง) / `utility_water` / `utility_electric` / `maintenance` / `supply_purchase` (ซื้อซัพพลายระหว่างเดือน) / `other` |
| amount | จำนวนเงิน (สตางค์) |
| expense_month | เดือนที่เป็นค่าใช้จ่าย เช่น `2026-06` |
| note, created_at | รายละเอียด + เวลา |

> หมายเหตุ: การ "ซื้อวัตถุดิบเข้าล็อต" บันทึกที่ `RawLots` (เป็นสินทรัพย์คงคลัง → กลายเป็น COGS เมื่อถูกใช้) ส่วน `supply_purchase` ใน Expenses ใช้กับซัพพลายจิปาถะที่ไม่ติดตามสต็อก

### ชีต 17: `AuditLog` — ประวัติทุกการกระทำ (ฟีเจอร์ 7.5)
**Append-only ห้ามแก้ห้ามลบ** — back-end เขียนอัตโนมัติทุกครั้งที่มี API call ที่เปลี่ยนข้อมูล
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | AUD-xxx |
| timestamp | เวลาเซิร์ฟเวอร์ |
| user_id, role, branch_id | ใครทำ |
| action | `LOGIN` / `SALE_CREATE` / `SALE_SYNC_OFFLINE` / `WASTAGE_CREATE` / `GOODS_RECEIVE` / `PRODUCTION_RUN` / `STOCK_ADJUST` / `RECONCILE_CONFIRM` / `EXPENSE_CREATE` / `RECIPE_EDIT` / `PRICE_OVERRIDE` ฯลฯ |
| feature_group | `pos` / `wastage` / `inventory` / `production` / `reconcile` / `expense` / `admin` — **ใช้จัดเรียงเป็นสัดส่วนตามฟีเจอร์** |
| ref_id | id เอกสารที่เกี่ยวข้อง |
| detail | JSON สรุปสิ่งที่เปลี่ยน (ค่าเดิม→ค่าใหม่) |
| flag | ว่าง / `SUSPICIOUS` (back-end ตั้งให้อัตโนมัติ เช่น แก้ราคาต่ำผิดปกติ, ขายพนักงานถี่ผิดปกติ, ปรับสต็อกบ่อย) |

### ชีต 18: `Sessions` — โทเค็นล็อกอิน
| คอลัมน์ | คำอธิบาย |
|---|---|
| token | สุ่ม 64 ตัวอักษร |
| user_id, role, branch_id | สิทธิ์ที่ผูกกับ token |
| expires_at | หมดอายุ 30 วัน (หน้าร้านจะได้ไม่ต้องล็อกอินบ่อย) |

### 🔗 แผนผังความสัมพันธ์ข้อมูล (Entity Relationship)

```
Users ──┬── Sales ──── SaleItems ──→ Products
        │                │
        │                └──(lot_breakdown)──→ FinishedStock (ล็อต)
        ├── Wastage ─────────────────────────→ FinishedStock (ล็อต)
        ├── GoodsReceipts ──(สร้างล็อตใหม่)──→ FinishedStock
        ├── ProductionOrders ──(สร้างล็อต)──→ FinishedStock
        │        └──(ตัดวัตถุดิบ FIFO)──→ RawLots ──→ RawMaterials
        │        └── ใช้สูตรจาก Recipes ── RecipeItems
        ├── Reconciliations ──(สรุปจาก)──→ Sales
        ├── Expenses
        └── ทุกการกระทำ ──→ AuditLog
```

---

## 2. ระบบล็อกอินและสิทธิ์ 3 ระดับ (Authentication & Authorization)

### 2.1 Flow การล็อกอิน
1. ผู้ใช้เปิดเว็บ → หน้า `Login.tsx` (ช่อง User ID + Password ปุ่มใหญ่)
2. Frontend เรียก `POST {action: "login", user_id, password}`
3. `Auth.gs` หาแถวใน `Users` → เทียบ `SHA256(password + salt)` กับ `password_hash`
4. ถูกต้อง → สร้าง token ใส่ชีต `Sessions` → ตอบ `{token, role, branch_id, display_name}`
5. Frontend เก็บ token + role + branch ลง IndexedDB (ไม่ใช่แค่ memory — รีเฟรชแล้วไม่หลุด)
6. `App.tsx` Route Guard:
   - `role === 'staff'` → เห็นเฉพาะ `/pos/*` และ `/wastage` ของสาขาตัวเอง
   - `role === 'office'` → เห็น `/office/*` (ทุกสาขา แต่ไม่เห็นหน้า owner)
   - `role === 'owner'` → เห็นทุกหน้า

### 2.2 การบังคับสิทธิ์ฝั่ง Backend (สำคัญที่สุด — ห้ามเชื่อ Frontend)
ทุก request ต้องแนบ `token` — `Main.gs` ทำงานดังนี้ก่อน route ไปทุกฟังก์ชัน:

```javascript
// Main.gs — โครง router กลาง
function doPost(e) {
  const req = JSON.parse(e.postData.contents);
  const session = Auth.verifyToken(req.token);   // ไม่ผ่าน → ตอบ 401
  const ROLE_ACTIONS = {
    staff:  ['sale.create','sale.syncBatch','wastage.create','product.list','stock.myBranch'],
    office: ['goods.receive','reconcile.*','expense.*','production.run','inventory.*','stockAdjust.request'],
    owner:  ['*']
  };
  if (!isAllowed(session.role, req.action)) return jsonError(403, 'FORBIDDEN');
  // staff ถูกบังคับ branch เสมอ — เขียนทับค่าที่ client ส่งมา กันปลอมสาขา
  if (session.role === 'staff') req.payload.branch_id = session.branch_id;
  const result = route(req.action, req.payload, session);
  Audit.log(session, req.action, result);        // เขียน AuditLog อัตโนมัติทุก action
  return jsonOk(result);
}
```

### 2.3 กรณีปรับสต็อก (ต้องมีรหัสเจ้าของ — plan ข้อ 5.2)
- ออฟฟิศกดปรับสต็อก → Frontend เด้ง modal "ใส่รหัสผ่านผู้ประกอบการ"
- Frontend ส่ง `{action:"stockAdjust.request", payload:{..., owner_user_id, owner_password}}`
- Backend ตรวจรหัส owner อีกครั้ง **ฝั่งเซิร์ฟเวอร์** → ผ่านจึงเขียน `StockAdjustments` + บันทึก `approved_by`

---

## 3. ระบบขายหน้าร้าน Flexi-Visual POS (ฟีเจอร์หลัก)

### 3.1 ขั้นตอนใช้งาน (User Flow) → ไฟล์ที่เกี่ยวข้อง

```
[SaleTypeSelect.tsx]          [ProductGrid.tsx]            [Checkout.tsx]
 เลือกประเภทขาย 4 ปุ่มยักษ์  →  จิ้มรูปสินค้า (ไม่ต้องพิมพ์)  →  เลือกช่องทางจ่าย + จบการขาย
 ขายปกติ/ลดราคา/แถม/พนักงาน    แตะ = +1, แตะตะกร้า = แก้จำนวน    QR1/QR2/Grab/Cash/ไทยช่วยไทย/อื่นๆ
```

### 3.2 ตรรกะแต่ละประเภทการขาย (เขียนใน `cartStore.ts`)

| ประเภท | ราคาที่ใช้ | แก้ราคาได้? | กฎพิเศษ |
|---|---|---|---|
| `normal` ขายปกติ | `sell_price` | ❌ | — |
| `discount` ลดราคา | `sell_price` เป็นค่าตั้งต้น | ✅ ทุกชิ้น (Numpad ตัวใหญ่) | บันทึก `PRICE_OVERRIDE` ลง AuditLog |
| `freebie` สินค้าแถม | ดูกฎด้านล่าง | ✅ | คละสินค้าได้หมด |
| `staff` ขายพนักงาน | `staff_price` | ✅ | แยกยอดรายงานให้ owner |

**กฎ `freebie` (ตาม plan 3.1 ข้อ 3) — โค้ดใน `cartStore.ts`:**
```typescript
// สินค้าในตะกร้ามี 2 กลุ่ม: ตัวซื้อ (จิ้มปกติ) และตัวแถม (จิ้มผ่านปุ่ม "เพิ่มของแถม")
// 1) ตัวแถม: unit_price = 0, is_freebie = true ทันที
// 2) ราคาขายของ "ตัวซื้อ": ตั้งต้น = ราคาของสินค้าที่แพงที่สุดในกลุ่มตัวซื้อ
//    (ระบบดึงราคาแพงสุดมาคิดเงิน ตาม spec) — พนักงานยังแก้ตัวเลขเองได้
// 3) Back-end ไม่สนใจราคาขายตอนคิดต้นทุน:
//    ทุกชิ้นรวมตัวแถม ถูกตัดสต็อก FIFO และคิด unit_cost จริงเสมอ
//    → กำไรของบิลแถม = ยอดเก็บจริง - ต้นทุนจริงทุกชิ้น (สะท้อนความจริง)
```

**กฎ `CASH` (Cash Management):**
```typescript
// Checkout.tsx: ถ้าเลือก CASH → แสดง Numpad "รับเงินมา"
change = cash_received - total_amount   // โชว์ตัวเลขเงินทอนใหญ่เต็มจอ
// ยอดเงินสดสะสมในเก๊ะ = Σ(total_amount ของบิล CASH วันนี้) — เก็บใน IndexedDB
// แสดงมุมจอ + ส่งเข้าระบบให้ออฟฟิศใช้ตรวจ Reconcile
```

### 3.3 สถาปัตยกรรมออฟไลน์ 100% (Offline-First — plan 3.3)

**หลักการ: เขียนลง IndexedDB ก่อนเสมอ (Local-First) แล้วค่อย sync — ไม่ใช่ลองยิงเน็ตก่อน**

```typescript
// db/dexie.ts — ตาราง IndexedDB ฝั่งเครื่อง
db.version(1).stores({
  outbox:    'id, type, created_at, status',   // คิวรอส่ง: sale | wastage
  products:  'id, category',                   // แคชสินค้า+รูป+ราคา (ดาวน์โหลดตอนล็อกอิน)
  stockCache:'product_id',                     // สต็อกคงเหลือฉบับ local (ตัดทันทีที่ขาย)
  session:   'key'                             // token, role, branch
});

// db/syncEngine.ts — เครื่องยนต์ sync
// 1) ทุกครั้งที่กด "จบการขาย": เขียนบิลลง outbox (status='pending') → จบ ลูกค้าคนถัดไปได้เลย
// 2) Background loop: ทุก 15 วินาที + ทุกครั้งที่ window 'online' event ดัง
//    → อ่าน outbox ที่ pending เรียงตามเวลา → ส่งเป็นชุด action='sale.syncBatch'
// 3) Backend ตอบรายตัว {id, status:'ok'|'duplicate'} → ลบออกจาก outbox เฉพาะตัวที่สำเร็จ
// 4) ส่งไม่สำเร็จ (เน็ตล่ม/timeout) → คงไว้ใน outbox ลองใหม่รอบหน้า — ไม่มีทางหาย
//    เพราะ IndexedDB อยู่บนดิสก์ ปิดเครื่อง/แบตหมด/ปัดแอปทิ้ง ข้อมูลยังอยู่ครบ
```

**สิ่งที่ Service Worker ต้อง cache (vite-plugin-pwa):** ตัวแอปทั้งหมด (HTML/JS/CSS) + รูปสินค้าทุกรูป → เปิดแอปใหม่ตอนไม่มีเน็ตก็ใช้งานได้เต็มรูปแบบ

### 3.4 กันบิลซ้ำ (Idempotency — สำคัญมากสำหรับ offline sync)
- `id` ของบิลสร้างที่ client ตั้งแต่ตอนกดจบการขาย
- `Sales.gs` ก่อน insert ตรวจว่า `id` นี้มีในชีต `Sales` แล้วหรือยัง → มีแล้วตอบ `duplicate` เฉยๆ ไม่เขียนซ้ำ
- ครอบทุกการเขียนด้วย `LockService.getScriptLock()` กัน 3 สาขา sync พร้อมกันแล้วข้อมูลชนกัน

### 3.5 การตัดสต็อกเมื่อขาย (ฝั่ง Backend — `Sales.gs`)
```
รับบิล → ต่อ 1 SaleItem:
  1. ดึงล็อตใน FinishedStock ที่ branch+product ตรงกัน, qty_remaining > 0
  2. เรียงตาม received_date เก่าสุดก่อน (FIFO)
  3. ตัด qty ไล่ทีละล็อตจนครบ → จด lot_breakdown + คำนวณ unit_cost ถ่วงน้ำหนัก
  4. กรณีสต็อกระบบไม่พอ (ขายออฟไลน์ค้างไว้): ตัดเท่าที่มี + ตั้ง flag ใน AuditLog
     ว่า 'OVERSOLD' ให้ออฟฟิศตามเช็ก — ห้าม reject บิล เพราะเงินรับมาแล้วจริง
  5. รวม total_cogs เขียนกลับลงหัวบิล
```

---

## 4. ระบบบันทึกของเสียสิ้นวัน (Wastage — `Wastage.tsx` + `Wastage.gs`)

### Flow หน้าจอ (พนักงานหน้าร้าน ตอนเย็น)
1. เข้าเมนู "🗑️ บันทึกสินค้าเสีย" → ระบบแสดง **เฉพาะสินค้า perishable ที่ยังมีสต็อกเหลือ** ในสาขา พร้อมรูป + จำนวนคงเหลือ + ป้ายสี: 🔴 หมดอายุวันนี้ / 🟡 ใกล้หมด / 🟢 ปกติ
2. ต่อสินค้า พนักงานเลือก 1 ใน 2 ปุ่มใหญ่:
   - **"ทิ้ง"** → จิ้มจำนวนชิ้นที่ทิ้ง → เพิ่มเข้ารายการ
   - **"เก็บขายต่อพรุ่งนี้"** → ระบบเรียก `action: "stock.extendExpiry"` เลื่อน `expiry_date` ของล็อต +1 วัน (ความยืดหยุ่นตาม plan ข้อ 4) — บันทึก AuditLog ว่าใครเป็นคนยืดอายุ
3. กดยืนยัน → เขียนลง outbox (ออฟไลน์ได้เหมือนบิลขาย) → sync ขึ้น `Wastage.gs`

### ตรรกะ Backend (`Wastage.gs`)
- ตัด `FinishedStock` แบบ FIFO **โดยตัดล็อตที่หมดอายุก่อน** (เรียง expiry_date)
- `total_cost_value = Σ(qty × unit_cost ของล็อตที่ตัด)` → นี่คือ "มูลค่าของเสีย" ที่ขึ้น Dashboard owner
- เขียน AuditLog `feature_group: 'wastage'`

---

## 5. คลังสินค้า 4 คลัง + เครื่องยนต์ต้นทุน FIFO (`Inventory.gs`, `Production.gs`)

### 5.1 การแมป 4 คลังลงฐานข้อมูล
| คลังตาม plan | เก็บที่ชีต | เงื่อนไข |
|---|---|---|
| 1. ข้าวกล่องบริษัทแม่ | `FinishedStock` | `source='parent_receive'` |
| 2. สินค้าผลิตเอง | `FinishedStock` | `source='production'` |
| 3. วัตถุดิบของสด | `RawLots` | material.warehouse=`raw_fresh` |
| 4. ของแห้ง+บรรจุภัณฑ์ | `RawLots` | material.warehouse=`dry_supply` |

หน้า `Inventory.tsx` (ออฟฟิศ) แสดง 4 แท็บตามนี้ — สะอาดตาตาม spec

### 5.2 ฟังก์ชันแกนกลาง: `consumeFIFO()` — ใช้ร่วมกันทั้งขาย/ทิ้ง/ผลิต

```javascript
// Inventory.gs — ฟังก์ชันเดียว ใช้ทุกที่ ห้ามเขียนซ้ำหลายเวอร์ชัน
/**
 * ตัดสต็อกแบบ FIFO ข้ามล็อตได้ (Lot Overlapping ตาม plan 5.1)
 * @return {breakdown: [{lot_id, qty, unit_cost}], totalCost, shortBy}
 * ตัวอย่าง: ต้องการหมู 5kg → ตัดล็อต1 (เหลือ 2kg @100) + ล็อต2 (3kg @120)
 *          → breakdown 2 แถว, totalCost = 200+360 = 560 บาท ✅ ตรง spec เป๊ะ
 */
function consumeFIFO(sheetName, filterFn, qtyNeeded) {
  const lots = SheetDB.query(sheetName, filterFn)
                      .filter(l => l.qty_remaining > 0)
                      .sort((a,b) => a.purchase_date - b.purchase_date); // เก่าก่อน
  let remaining = qtyNeeded, breakdown = [], totalCost = 0;
  for (const lot of lots) {
    if (remaining <= 0) break;
    const take = Math.min(lot.qty_remaining, remaining);
    breakdown.push({lot_id: lot.lot_id, qty: take, unit_cost: lot.unit_cost});
    totalCost += take * lot.unit_cost;
    SheetDB.update(sheetName, lot.lot_id, {qty_remaining: lot.qty_remaining - take});
    remaining -= take;
  }
  return {breakdown, totalCost, shortBy: remaining}; // shortBy>0 = ของไม่พอ
}
```

### 5.3 ระบบผลิต + ล็อกต้นทุน (`Production.gs` — ฟีเจอร์ 5.2)

```
Flow "ผลิตเมนู X จำนวน N ชุด" (หน้า Production.tsx):
1. Frontend เรียก action: "production.preview" ก่อน
   → Backend ไล่ RecipeItems × N เช็กทุกวัตถุดิบว่าพอไหม
   → ตอบกลับรายการ: วัตถุดิบไหนพอ (✅) ไม่พอ (❌ ขาดเท่าไร)
   → ไม่พอ = ปุ่มผลิตเป็นสีเทา กดไม่ได้ + บอกชัดว่าขาดอะไร
2. พอแล้วกด "ผลิต" → action: "production.run":
   a. ครอบ LockService
   b. ต่อ RecipeItem: consumeFIFO(RawLots, material+branch, qty_per_unit × N)
      → ได้ totalCost ราย材料 (ข้ามล็อตอัตโนมัติ = Lot Overlapping)
   c. แยกยอด: is_packaging=true → total_packaging_cost, อื่นๆ → total_material_cost
   d. unit_cost_locked = (material + packaging) ÷ N   ← ล็อกตลอดไป
   e. INSERT FinishedStock ล็อตใหม่: qty_in=N, unit_cost=unit_cost_locked,
      expiry_date = วันนี้ + shelf_life_days, source='production'
   f. INSERT ProductionOrders พร้อม consumption_detail (JSON ร่องรอยทุกล็อต)
   g. AuditLog feature_group:'production'
ผล: สินค้าที่ผลิตวันก่อนต้นทุน 10 บาทจะโชว์ 10 บาทตลอดไปในรายงานย้อนหลัง
     ของใหม่วันนี้วัตถุดิบแพงขึ้นเป็น 11 บาท → ล็อตใหม่ 11 บาท ไม่กระทบอดีต ✅
```

### 5.4 หน่วยสินค้า
หน่วยผูกที่ `RawMaterials.unit` (kg/L/piece/box/pack) — Frontend แสดงหน่วยตามนั้น, `qty_per_unit` ในสูตรเป็นทศนิยมได้ (เช่น 0.15 kg)

---

## 6. งานฝั่งออฟฟิศ (Back-Office Hub)

### 6.1 รับสินค้าจากบริษัทแม่ (`GoodsReceive.tsx` + `Inventory.gs`)
- ฟอร์ม: เลือกสาขา → เลือกสินค้า (dropdown มีรูป) → จำนวน → ต้นทุนต่อชิ้น → วันที่
- Submit → `action:"goods.receive"` → INSERT `GoodsReceipts` + INSERT `FinishedStock` ล็อตใหม่ (`source='parent_receive'`)
- **สต็อกขึ้นหน้า POS สาขาอัตโนมัติ:** POS ฝั่ง staff ดึง `action:"stock.myBranch"` ทุกครั้งที่ออนไลน์+ตอนเปิดแอป → อัปเดต `stockCache` ใน IndexedDB

### 6.2 ตรวจบัญชีรายวัน (`Reconcile.tsx` + `Reconcile.gs`)
```
1. ออฟฟิศเลือก สาขา + วันที่ → action:"reconcile.getDaily"
2. Backend SUM ยอดจากชีต Sales (เฉพาะ created_at ตรงวันนั้น) แยก 6 ช่องทาง → ตารางเทียบ:
   ┌──────────┬────────────┬────────────┬────────┐
   │ ช่องทาง   │ ยอดในระบบ  │ ยอดจริง(คีย์) │ ผลต่าง │
   │ QR1      │ 4,500      │ [____]     │ auto   │ ... ครบ 6 แถว
3. ออฟฟิศคีย์ยอดจริงจาก bank statement + เงินสดที่นับได้
4. ตรงทุกช่อง → ปุ่ม "✅ ยืนยัน Reconciled" / ไม่ตรง → บังคับกรอก note → status='mismatch'
   (mismatch จะเด้งแจ้งเตือนบน Dashboard ของ owner)
5. ยืนยันแล้ว → UPDATE Sales ของวันนั้นเป็น reconcile_status='reconciled' + เขียน Reconciliations
```

### 6.3 ค่าใช้จ่ายรายเดือน (`Expenses.tsx` + `Expenses.gs`)
ฟอร์มเดียวใช้ทั้ง 2 แบบ: ค่าใช้จ่ายคงที่สิ้นเดือน (เงินเดือน/น้ำ/ไฟ/ซ่อม) และซัพพลายระหว่างเดือน (`supply_purchase` คีย์ได้ตลอดทั้งเดือนหลายครั้ง) → INSERT `Expenses` → ไหลเข้างบกำไรขาดทุนของเดือนนั้นอัตโนมัติ

---

## 7. Dashboard ผู้ประกอบการ + งบการเงิน (`Reports.gs`)

### 7.1 API กลางตัวเดียว: `report.summary`
```
Request:  {action:"report.summary", payload:{
            branch: "ALL" | "BR-KASET" | ...,
            period: "daily"|"monthly"|"quarterly"|"annually"|"inception",
            date_from, date_to   // Backend คำนวณช่วงให้จาก period ที่เลือก
          }}
Response: {
  gross_revenue,        // Σ Sales.total_amount ในช่วง
  revenue_by_type:    {normal, discount, freebie, staff},     // → กราฟ 7.2
  revenue_by_payment: {QR1, QR2, GRAB, CASH, THAI, OTHER},
  cogs,                 // Σ Sales.total_cogs (ต้นทุนล็อตจริง+บรรจุภัณฑ์ ตาม spec)
  gross_profit,         // revenue - cogs
  wastage_value,        // Σ Wastage.total_cost_value
  total_expenses,       // Σ Expenses (เดือนที่คาบเกี่ยวช่วง)
  expense_breakdown:  {salary, utility, maintenance, supply, other},
  net_profit,           // gross_profit - wastage - expenses
  daily_trend: [{date, revenue, profit}, ...]   // เส้นกราฟ
}
```
Frontend `Dashboard.tsx`: ตัวกรองด้านบน (สาขา + ช่วงเวลา 5 แบบ) → การ์ดตัวเลขใหญ่ + กราฟ Recharts ทุกอย่าง re-fetch เมื่อเปลี่ยนตัวกรอง

### 7.2 รายงานสัดส่วนลูกค้าจริง vs พนักงาน (`RevenueAnalysis.tsx`)
- Pie chart + ตาราง: **ลูกค้าทั่วไป** = sale_type ∈ {normal, discount, freebie} vs **พนักงาน** = {staff}
- แสดงทั้งมูลค่าบาทและ % — ตอบโจทย์ "ธุรกิจอยู่ได้ด้วยลูกค้าจริงหรือระบายของให้คนใน"

### 7.3 งบการเงิน 10-K/10-Q + Export PDF (`FinancialReport.tsx`)
- `action:"report.financialStatement"` คืนโครงสร้าง:
  - **งบกำไรขาดทุน (Income Statement):** Revenue → COGS → Gross Profit → Operating Expenses (แยกหมวด) → Wastage → Net Income
  - **งบดุล (Balance Sheet):** สินทรัพย์ = เงินสด/ธนาคารจาก reconcile + มูลค่าสต็อกคงเหลือ (Σ qty_remaining × unit_cost ทุกล็อตทั้ง Raw+Finished) | ส่วนของเจ้าของ = กำไรสะสม
  - แบ่ง section สไตล์ 10-K: Part I ภาพรวมธุรกิจ / Part II ผลประกอบการรายสาขา / Part III งบการเงิน
- ปุ่ม **"Export to PDF"** → ใช้ `pdfmake` ฝั่ง client สร้าง A4: หัวกระดาษโลโก้ Grand's House, ตารางเส้นบาง, เลขหน้า, ฟอนต์ไทย (embed font Sarabun) → ดาวน์โหลดทันที

### 7.4 เมนูตรวจสอบประวัติ (`AuditLog.tsx` — ฟีเจอร์ 7.5)
- เห็นเฉพาะ owner — ดึง `action:"audit.query"` พร้อมตัวกรอง: **feature_group (จัดเรียงเป็นสัดส่วนตามฟีเจอร์)** / สาขา / พนักงาน / ช่วงเวลา / เฉพาะ `flag='SUSPICIOUS'`
- แถบสรุปด้านบน: จำนวนการแก้ราคา, จำนวนปรับสต็อก, จำนวนยอดขายพนักงาน, รายการ mismatch — กดเจาะลงรายตัวเห็น detail JSON ค่าเดิม→ค่าใหม่ ตรวจย้อนกลับได้ 100%
- กฎตั้ง flag อัตโนมัติใน `Audit.gs`: แก้ราคาต่ำกว่า 50% ของราคาปกติ / ขายพนักงาน >X ครั้ง/วัน/คน / ปรับสต็อก >Y ครั้ง/สัปดาห์ / ทิ้งของมูลค่าสูงผิดปกติ

---

## 8. สัญญา API ทั้งหมด (API Contract — ให้ AI ตัวถัดไปใช้อ้างอิง)

ทุก request: `POST <GAS_WEB_APP_URL>` body `{token, action, payload}` | ทุก response: `{ok: true, data} | {ok: false, code, message}`

| action | role | หน้าที่ |
|---|---|---|
| `login` | ทุกคน | ล็อกอิน รับ token |
| `product.list` | ทุกคน | รายการสินค้า+ราคา+รูป (POS แคชลงเครื่อง) |
| `stock.myBranch` | staff | สต็อกคงเหลือสาขาตัวเอง |
| `sale.syncBatch` | staff | ส่งบิลขายเป็นชุด (idempotent) |
| `wastage.create` | staff | บันทึกของเสีย |
| `stock.extendExpiry` | staff | ยืดอายุล็อต +1 วัน |
| `goods.receive` | office | รับข้าวกล่องจากบริษัทแม่ |
| `rawlot.purchase` | office | ซื้อวัตถุดิบเข้าล็อตใหม่ |
| `inventory.list` | office, owner | ดู 4 คลัง (แยกแท็บ) |
| `production.preview` / `production.run` | office, owner | เช็กวัตถุดิบ / สั่งผลิต |
| `stockAdjust.request` | office (+รหัส owner) | ปรับจูนสต็อก |
| `reconcile.getDaily` / `reconcile.confirm` | office | ตรวจ/ยืนยันบัญชีรายวัน |
| `expense.create` / `expense.list` | office, owner | ค่าใช้จ่าย |
| `recipe.save` / `recipe.list` | owner | จัดการสูตร BOM |
| `report.summary` / `report.financialStatement` | owner | Dashboard / งบการเงิน |
| `audit.query` | owner | ประวัติทุกการกระทำ |
| `user.manage` | owner | เพิ่ม/ปิดบัญชีพนักงาน |

---

## 9. ลำดับการลงมือสร้าง (Implementation Roadmap — สั่ง AI ทีละเฟส)

| เฟส | งาน | ส่งมอบ |
|---|---|---|
| **1. Foundation** (วัน 1-2) | สร้าง Google Sheet 18 ชีตตาม schema ข้อ 1 → เขียน `SheetDB.gs` (query/insert/update + LockService) → `Auth.gs` + ชีต Users ตัวอย่าง 7 คน (staff×3, office×2, owner×1, สำรอง×1) → React scaffold + Login + Route Guard | ล็อกอินได้ 3 ระดับ เห็นเมนูต่างกัน |
| **2. POS Core** (วัน 3-5) | `product.list` + ProductGrid + cartStore (4 sale types + กฎ freebie + cash) + Checkout + Dexie outbox + syncEngine + `Sales.gs` (idempotent + ตัดสต็อก FIFO) | ขายได้จริงทั้งออนไลน์/ออฟไลน์ ปิดเครื่องข้อมูลไม่หาย |
| **3. Inventory Engine** (วัน 6-8) | `consumeFIFO()` + RawLots + GoodsReceive + Recipes/BOM + Production (preview→run→cost locking) + StockAdjust พร้อมรหัส owner | ผลิตแล้วต้นทุนล็อกถูกต้อง ตัดสต็อกข้ามล็อตตรงตามตัวอย่าง 560 บาท |
| **4. Wastage + Office** (วัน 9-10) | หน้า Wastage (ทิ้ง/ยืดอายุ) + Reconcile + Expenses | ปิดวงจรงานรายวันครบ |
| **5. Owner Suite** (วัน 11-13) | report.summary + Dashboard + RevenueAnalysis + FinancialReport + pdfmake export + AuditLog viewer + flag rules | เจ้าของเห็นทุกตัวเลข + export PDF ได้ |
| **6. Hardening** (วัน 14) | ทดสอบ: ขายออฟไลน์ 50 บิลแล้ว sync, 3 เครื่องขายพร้อมกัน, สต็อกติดลบ, PWA install บนแท็บเล็ตจริง, ทดสอบกับพนักงานจริง 1 วัน | Go-Live |

### ✅ เกณฑ์ตรวจรับ (Acceptance Tests สำคัญ)
1. ปิด WiFi → ขาย 10 บิล (ครบ 4 ประเภท) → ปิดเบราว์เซอร์ → เปิดใหม่ → เปิดเน็ต → บิลขึ้นชีต Sales ครบ 10 ไม่ซ้ำ
2. ผลิตเมนูที่ใช้หมูคาบ 2 ล็อต (2kg@100 + 3kg@120) → `total_material_cost` = 560 บาทพอดี และล็อตเก่าเหลือ 0
3. ดูรายงานเดือนก่อน → ต้นทุนสินค้าเดือนก่อนไม่เปลี่ยนแม้วันนี้ราคาวัตถุดิบขึ้น
4. staff สาขาเกษตรใหม่ยิง API ขอข้อมูลสาขาท่ารั้ว → ได้ 403
5. ปรับสต็อกโดยไม่ใส่รหัส owner → ถูกปฏิเสธ และความพยายามนั้นโผล่ใน AuditLog
6. ทุกการกระทำใน 1 วันทดสอบ ปรากฏใน AuditLog ครบ จัดกลุ่มตาม feature_group ถูกต้อง

---

## 10. สิ่งที่เจ้าของต้องเตรียม (Owner Checklist)
- [ ] บัญชี Google (ใช้สร้าง Sheet + Apps Script + Drive เก็บรูปสินค้า)
- [ ] รายชื่อสินค้าทั้งหมด + ราคาขาย + ราคาพนักงาน + อายุสินค้า + **รูปถ่ายสินค้า** (สี่เหลี่ยมจัตุรัส พื้นหลังเรียบ — สำคัญมากสำหรับ UI แบบไม่ต้องพิมพ์)
- [ ] รายชื่อวัตถุดิบ + หน่วย + สูตรอาหารแต่ละเมนู (ปริมาณต่อ 1 กล่อง)
- [ ] รายชื่อพนักงาน + สาขา + กำหนด User ID/Password
- [ ] แท็บเล็ต/มือถือประจำ 3 สาขา (Chrome/Safari ติดตั้ง PWA ได้)

> **เอกสารนี้ + `plan.md` คือทั้งหมดที่ AI Coding Agent ต้องใช้** — สั่งงานทีละเฟสตามข้อ 9 และตรวจรับด้วย Acceptance Tests ทุกครั้งก่อนขึ้นเฟสถัดไป
