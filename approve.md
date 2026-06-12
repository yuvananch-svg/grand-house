# ✅ approve.md — รายงานตรวจสอบโค้ดเทียบแผนทั้ง 3 ฉบับ (Grand's House)

> **วันที่ตรวจ:** 2026-06-10
> **ขอบเขตการตรวจ:** โค้ดทั้งหมดใน `backend/` (Google Apps Script 12 ไฟล์), `frontend/` (React PWA), `docs/` เทียบกับ `plan.md` (ความต้องการธุรกิจ), `Grand's.md` (พิมพ์เขียวเทคนิค), `plan2.md` (ฉบับแก้บัค — ศักดิ์สูงสุด)
> **วิธีตรวจ:** อ่านโค้ดทุกไฟล์ทุกบรรทัด + รัน `npm run build` จริงเพื่อพิสูจน์สถานะ

---

## 🎯 สรุปสถานะภาพรวม (Executive Summary)

| หัวข้อ | สถานะ |
|---|---|
| สถานะโดยรวม | 🟡 **เป็น "Prototype/Demo ภายในเครื่องเดียว" ที่ครอบคลุมฟีเจอร์กว้าง แต่ยังไม่ใช่ระบบจริงที่ใช้งานได้ 3 สาขา** |
| ความครบของฟีเจอร์ตามแผน | ~60% ของ workflow หลักมีให้เห็น/กดได้, ~35% ของข้อกำหนด plan2 ทำจริงครบ |
| จุดวิกฤติที่สุด #1 | **Frontend ไม่เคยเชื่อม GAS Backend เลย** — ทุก request วิ่งเข้า `localAdapter.ts` (จำลองใน localStorage ของเบราว์เซอร์) ระบบ 3 สาขา/หลายเครื่อง/Google Sheets **ยังไม่เกิดขึ้นจริง** |
| จุดวิกฤติที่สุด #2 | **`npm run build` ไม่ผ่าน** — TypeScript error 36 จุด (ดูข้อ 3.1) แม้แต่ demo ก็ deploy ไม่ได้ |
| จุดวิกฤติที่สุด #3 | **ยังไม่มีการทดสอบใดๆ เลย** — เทสชุด A–H ของ plan2 ส่วนที่ 7 = 0 เคส, ไม่มี Vitest/Tests.gs/Playwright แม้แต่ไฟล์เดียว |
| พร้อม Go-Live หรือไม่ | ❌ ไม่พร้อม — ใช้เป็น demo ให้เจ้าของดู flow ได้ แต่ห้ามใช้กับเงินจริง/ข้อมูลจริง |

**ภาพสถาปัตยกรรมที่พบจริง (ต่างจากแผน):**

```
แผน:   PWA ──HTTPS──▶ GAS Web App ──▶ Google Sheets (23 ชีต)
จริง:  PWA ──▶ localAdapter.ts ──▶ localStorage (ในเครื่องเดียว)
       [backend/*.gs เขียนไว้แล้ว แต่ไม่มีใครเรียกใช้ — ยังไม่เคย deploy/ทดสอบ]
```

---

## 1. ✅ งานที่ทำสำเร็จแล้ว

### 1.1 Backend (GAS source — เขียนครบโครง แต่ยังไม่ถูกเชื่อม/ทดสอบ)

| งาน | ไฟล์ | ตรงแผนข้อ |
|---|---|---|
| Router กลาง + ROLE_ACTIONS 3 ระดับ + บังคับ branch ของ staff ทับค่า client + LockService ครอบงานเขียน | `backend/Main.gs` | Grand's 2.2 |
| ตอบ HTTP 200 เสมอ, error อยู่ใน body `{ok:false, code}` | `backend/Main.gs` | GAP-01 (ฝั่งตอบ) |
| Schema 23 ชีตครบ รวมคอลัมน์ Δ ของ plan2 ทั้งหมด (status/void, token_hash, approval_pin_hash, wastage_type, base_unit, hash chain, DailySummary, PriceHistory, ErrorLog, Devices, Config) | `backend/SheetDB.gs` | plan2 2.1–2.2 |
| sanitize กัน Formula Injection (เติม `'` นำหน้า `=+-@` + ตัดความยาว 1,000) | `SheetDB.gs:78` | GAP-12 |
| รหัสผ่าน iterated SHA-256 ×10,000 + salt + PEPPER จาก Script Properties | `backend/Auth.gs:65` | GAP-10 |
| Session เก็บ token_hash (ไม่เก็บ token ดิบ) + expires 30 วัน + revoked | `Auth.gs:13-26` | GAP-09 |
| Device Registry + ตรวจ blocked ตอน verify token + owner block/unblock ได้ | `Auth.gs:36-57` | GAP-08 (บางส่วน) |
| AuditLog hash chain (prev_hash→row_hash) + `verifyAuditChain()` + log ขาล้มเหลว (LOGIN_FAILED, FORBIDDEN_ATTEMPT, INVALID_TOKEN, PIN_FAILED) | `backend/Audit.gs` | GAP-13, GAP-14 |
| ขาย: idempotency ราย id (ตอบ duplicate), ตัดสต็อก FIFO, flag OVERSOLD ไม่ reject บิล, ตรวจ INVALID_CASH | `backend/Sales.gs` | Grand's 3.4–3.5, GAP-18 |
| Void บิล: คืนสต็อกตาม lot_breakdown, จำกัด 15 นาที (อ่านจาก Config), ห้าม void บิล reconciled, ห้ามลบแถว | `Sales.gs:54-71` | GAP-02 |
| DailySummary อัปเดต incremental ตอนขาย/void | `Sales.gs:73-106` | GAP-06 (บางส่วน) |
| consumeFIFO ใช้ร่วม ขาย/ทิ้ง/ผลิต — ข้ามล็อตได้ (Lot Overlapping) | `backend/Inventory.gs:55-68` | Grand's 5.2, plan 5.1 |
| Wastage สำเร็จรูป (ตัดล็อตหมดอายุก่อน) + Wastage วัตถุดิบ (rawWastage) | `backend/Wastage.gs` | Grand's 4, GAP-19 |
| Production preview→run + แยกต้นทุนวัตถุดิบ/บรรจุภัณฑ์ + `unit_cost_locked` + consumption_detail JSON + reject เมื่อของขาด | `backend/Production.gs` | Grand's 5.3, plan 5.1-5.2 |
| ปรับสต็อกด้วย **PIN owner 6 หลัก** (ตรวจฝั่งเซิร์ฟเวอร์, ไม่ใช่รหัสผ่านหลัก) + บันทึก approved_by | `Inventory.gs:132-157` | GAP-11 |
| Reconcile getDaily/confirm + diff + status mismatch + mark sales reconciled | `backend/Reconcile.gs` | Grand's 6.2 |
| Expenses create (กัน amount ≤ 0) / list | `backend/Expenses.gs` | Grand's 6.3 |
| report.summary + financialStatement (โครงงบ + มูลค่าสต็อกคงเหลือทุกล็อต) | `backend/Reports.gs` | Grand's 7.1, 7.3 |
| Bootstrap `setupSheets()` idempotent + seed Config + seed 3 สาขา | `backend/Bootstrap.gs` | plan2 เฟส 0 ข้อ 5 |
| Timezone `Asia/Bangkok` ใน appsscript.json | `backend/appsscript.json` | GAP-04 (บางส่วน) |

### 1.2 Frontend (ครบทุกหน้าจอหลัก — รวมหน้าใหม่ที่ plan2 เพิ่ม)

| งาน | ตรงแผนข้อ |
|---|---|
| หน้าจอครบ 16 หน้า: Login, POS, **SaleHistory+Void (S5)**, Wastage, **DayClose (S7)**, GoodsReceive, RawPurchase, Inventory, Production, StockAdjust, Reconcile, Expenses, Dashboard, RevenueAnalysis, FinancialReport+PDF, AuditLog, Admin | plan2 3.3 S1–S18 (โครง) |
| Route Guard ตาม role — เมนูต่างกัน 3 ระดับ | Grand's 2.1 |
| ประเภทขาย 4 โหมด + ปุ่ม toggle ตัวซื้อ/ตัวแถม + pro-rate ราคาแถมจาก max(sell_price)×จำนวนตัวซื้อ | plan 3.1, GAP-17 (ตรรกะหลัก) |
| CASH: ช่องรับเงิน + เงินทอน + ปุ่มจบ disabled จนกว่า `รับเงิน ≥ ยอด` | plan 3.2, GAP-18 (ฝั่ง UI) |
| Offline-first: Dexie outbox → flush ตอน online event + ทุก 15 วิ; wastage และ extendExpiry เข้า outbox ด้วย | Grand's 3.3, GAP-15 |
| Void บิลที่ยังไม่ sync = ลบจาก outbox เลย / บิลที่ sync แล้ว = เรียก API | plan2 S5 |
| เงินเก็บเป็นสตางค์ integer ทุกจุด (`utils/money.ts` ที่เดียว) | Grand's `money.ts`, plan2 3.1 |
| ปริมาณวัตถุดิบเป็น integer หน่วยฐาน (g/ml/piece) + display_factor แปลงตอนแสดงเท่านั้น | GAP-05 |
| Device ID (UUID ใน localStorage) แนบทุก request | plan2 ชีต 22 |
| global error handler → `log.clientError` | GAP-21 (บางส่วน) |
| i18n ไทย/พม่า (โครง) + ชื่อสินค้า 2 ภาษา + ตัวบอกสถานะเน็ต/จำนวนรอส่ง | plan2 3.1 |
| PWA (vite-plugin-pwa + Workbox precache) + pdfmake export + Recharts pie | Grand's 0.1 |
| สัดส่วนลูกค้าจริง vs พนักงาน (pie + ตาราง + %) | plan 7.2 |
| DayClose แสดง "เงินสดที่ควรมีในเก๊ะ" + ยอดแยกช่องทาง | plan 3.2, plan2 S7 |

### 1.3 เอกสาร
- `docs/API_CONTRACT.md` — สัญญา API + บัญชีทดสอบ local
- `docs/SCHEMA.md` — สรุป 23 ชีต + กฎ integer/lot_breakdown/hash chain
- `docs/LOCAL_RUNBOOK.md` — บอกตรงๆ ว่ายังไม่ run เทส/บิลด์ (ซื่อสัตย์ดี ✅)
- `docs/RESTORE_RUNBOOK.md` — โครงแผนกู้คืน (ยังเป็น draft)

---

## 2. ❌ แผนที่ยังทำไม่เสร็จ (เรียงตามความรุนแรง)

### 🔴 ระดับวิกฤติ — ระบบยังไม่ใช่ของจริง

| # | รายการ | อ้างอิงแผน |
|---|---|---|
| C1 | **เชื่อม Frontend ↔ GAS จริง**: `client.ts` hardcode เรียก `callLocalApi` เท่านั้น ไม่มี fetch ไป GAS, ไม่มีการส่ง `text/plain;charset=utf-8` (ฝั่ง client ของ GAP-01 ยังไม่ได้เขียน), ไม่มี env var `VITE_GAS_URL`, ไม่มีสวิตช์ local/staging/prod | GAP-01, plan2 เฟส 0 |
| C2 | **แก้ build ให้ผ่าน**: TS error 36 จุด — ดูข้อ 3.1 | plan2 7.0 (CI: build ผ่านก่อน deploy) |
| C3 | **เทสทั้งหมด 0%**: ไม่มี Vitest (money/cartStore/syncEngine), ไม่มี `Tests.gs`, ไม่มี Playwright, ไม่มีเทสชุด A–H แม้แต่เคสเดียว | plan2 ส่วนที่ 7 ทั้งส่วน |
| C4 | **Login lockout + rate limit ไม่มีจริง**: คอลัมน์ `failed_attempts`/`locked_until` มีในชีต และค่า Config มี แต่ `Auth_login` ไม่เคยนับ/ตรวจ, ไม่มี CacheService rate limit 60 req/นาที (middleware ขั้น 2 ของแผนภาพ plan2 2.3 หายไปทั้งขั้น) | GAP-08, เทส A3, A9 |
| C5 | **GAP-04 (business_date) ไม่ได้ทำ**: `Sales.gs:41` ใช้ `businessDate()` = เวลา server เสมอ → บิลขายออฟไลน์คืนนี้ที่ sync เช้าพรุ่งนี้จะตกวันผิด, ไม่มี flag `CLOCK_DRIFT`, ไม่เทียบ client_created_at | GAP-04, เทส C9 |
| C6 | **GAP-03 (Late-Arriving Sale) ไม่ได้ทำ**: รับบิลช้าหลังปิดบัญชีแล้ว ไม่ตั้ง `late_after_reconcile` (hardcode `false`), ไม่เปลี่ยน Reconciliation เป็น `reopened`, ไม่มี badge แจ้งเตือน → บัญชีเพี้ยนเงียบๆ ตามที่ plan2 เตือนไว้เป๊ะ | GAP-03, เทส C8 |
| C7 | **Trigger กลางคืนทั้ง 5 ตัวไม่มีเลย**: ไม่มี DailySummary rebuild, ไม่มี Backup รายคืน (GAP-22), ไม่มี verifyAuditChain ตามเวลา+อีเมลแจ้ง, ไม่มีลบ Sessions หมดอายุ, ไม่มี Health Report 07:00 | plan2 8.1, GAP-13, GAP-22 |

### 🟠 ระดับสูง — ฟีเจอร์ตามแผนที่ขาดหาย

| # | รายการ | อ้างอิงแผน |
|---|---|---|
| H1 | **แก้ราคาในโหมด "ลดราคา" ทำไม่ได้จริง**: UI ไม่มีช่อง/Numpad แก้ราคาต่อชิ้นหรือยอดรวมเลย → โหมดลดราคา = ขายราคาเต็ม และ `PRICE_OVERRIDE` ไม่เคยถูกบันทึก | plan 3.1 ข้อ 2, Grand's 3.2, เทส B2 |
| H2 | **ช่องแก้ "ยอดรวมบิลแถม" (1 ช่องตาม GAP-17) ไม่มีใน UI** — ตรรกะ pro-rate มีแต่ผู้ใช้แก้ยอดไม่ได้ | GAP-17, เทส B4 |
| H3 | **PriceHistory ไม่มีทางเกิด**: ชีตมีแล้ว แต่ไม่มี action แก้ราคาสินค้า/จัดการสินค้าเลยทั้งระบบ (Admin ทำได้แค่ block device) | GAP-16, เทส G5 |
| H4 | **User Management ไม่มี**: เพิ่ม/ปิดบัญชี/รีเซ็ตรหัส/ตั้ง PIN/force-logout ทำไม่ได้ — `user.manage` รองรับแค่ block/unblock device | Grand's ข้อ 8, plan2 S18, เทส A5 |
| H5 | **RecipeManager ไม่มีหน้า UI**: `recipe.save`/`recipe.list` มีใน adapter/GAS แต่ไม่มีหน้าจอให้ owner คีย์สูตร BOM | Grand's 7 (RecipeManager.tsx), plan 5.2 |
| H6 | **กฎ flag SUSPICIOUS อัตโนมัติทั้ง 4 ข้อไม่ได้ทำ**: ราคาต่ำกว่า 50% / ขายพนักงานถี่ / ปรับสต็อกถี่ / ทิ้งของแพง — ค่าใน Config มีแต่ไม่มีโค้ดใช้ | Grand's 7.4, เทส G4 |
| H7 | **Dashboard ไม่มีตัวกรอง**: ไม่มีเลือกสาขา/ช่วงเวลา 5 แบบ (รายวัน→Inception), ไม่มีกราฟเส้น daily_trend (คำนวณไว้แล้วแต่ไม่ render), ไม่อ่านจาก DailySummary | plan 7.1, GAP-06, plan2 S15 |
| H8 | **PDF ไม่มีฟอนต์ไทย**: ใช้ Roboto — ข้อความไทยในงบการเงินจะพัง, ไม่มีโครง 10-K 3 Part, ไม่มีหัวกระดาษ/เลขหน้า | Grand's 7.3 (embed Sarabun), เทส F5 |
| H9 | **AuditLog viewer ตัวกรองไม่ครบ**: มีแค่ feature_group — ขาด สาขา/พนักงาน/ช่วงเวลา/device/เฉพาะ SUSPICIOUS, ไม่มีแถบสรุป, ไม่มี drill-down ค่าเดิม→ใหม่, ไม่มี export CSV, ไม่มีแถบสถานะ hash chain | Grand's 7.4, plan2 S17 |
| H10 | **Inventory ไม่ใช่ 4 แท็บ**: แสดง 2 ตาราง (สำเร็จรูปรวม + วัตถุดิบรวม) ไม่แยก 4 คลังตามแผน, ไม่มีแถบเตือนใกล้หมดอายุ 3 วัน/ของต่ำกว่าขั้นต่ำ | plan 5, Grand's 5.1, plan2 S10 |
| H11 | **GAS ไม่ตรวจ device blocked ตอน login** — เครื่องที่ถูกบล็อกยัง login ได้ (verify token เท่านั้นที่ตรวจ) ขณะที่ localAdapter ตรวจ → พฤติกรรมสองระบบไม่ตรงกัน | GAP-08, เทส A12 |
| H12 | **Archive รายปี + Idempotency แบบเร็ว (TextFinder/CacheService) ยังไม่ทำ**: `Sales_processOne` สแกนทั้งชีตหา id ซ้ำ, `Audit_log` อ่าน **ทั้งชีต AuditLog ทุกครั้งที่เขียน** เพื่อหา prev_hash — ช้าลงเรื่อยๆ จนชน quota แน่นอนตามที่ GAP-06 เตือน | GAP-06 |

### 🟡 ระดับกลาง — UX/รายละเอียดตามแผนที่ยังขาด

| # | รายการ | อ้างอิงแผน |
|---|---|---|
| M1 | ไม่มีคอมโพเนนต์ Numpad ปุ่มใหญ่ — ทุกอย่างเป็น input พิมพ์ (ขัด No-typing layout สำหรับแรงงานต่างด้าว) | plan 2.1, plan2 3.1 |
| M2 | ไม่มี dialog ยืนยันก่อน action ย้อนยาก — กด "ทิ้ง 1 ชิ้น" ในหน้า Wastage = ตัดสต็อกทันที ไม่มีถามซ้ำ, ทิ้งได้ทีละ 1 ชิ้นเท่านั้น, ไม่มีป้ายสี 🔴🟡🟢 | plan2 3.1 + S6 |
| M3 | เหตุผล void ตายตัว "จิ้มผิด" — ไม่มีปุ่มไอคอนเลือกเหตุผล 4 แบบ, ปุ่ม Void โชว์ทุกบิลแม้เกิน 15 นาที (กดแล้วค่อย error) | GAP-02, plan2 S5 |
| M4 | DayClose ไม่บังคับ outbox = 0 ก่อนปิดร้าน + ไม่มีปุ่ม "ลองส่งอีกครั้ง" | plan2 S7 |
| M5 | Toast error หายเองใน 2.6 วิเหมือน success (แผนให้ error ค้างจนกดปิด), ไม่มี React Error Boundary, ไม่มี handle AUTH_EXPIRED → เด้ง login | plan2 3.1, เทส A4 |
| M6 | GoodsReceive: ไม่กันวันที่อนาคต, ไม่มีตาราง "รับเข้าล่าสุด 20 รายการ" / RawPurchase: ไม่โชว์ "= 1,500 g" ใต้ช่อง | plan2 S8, S9 |
| M7 | Production preview แสดงเป็น JSON ดิบใน `<pre>` — ไม่ใช่ UI ✅/❌ บอกว่าขาดอะไรเท่าไรตามแผน | Grand's 5.3, plan2 S11 |
| M8 | Reconcile: mismatch ไม่บังคับกรอก note, ไม่แสดงรายการบิล void/OVERSOLD แยกบรรทัด, กดยืนยันซ้ำวันเดิมได้ | Grand's 6.2, plan2 S13 |
| M9 | i18n ครอบคลุม ~18 คำ — ข้อความส่วนใหญ่ hardcode ไทย (พม่าเห็นไทยปน), ไม่มีไอคอนธงชาติ | plan2 3.1 |
| M10 | `catalog_version` มีแค่ฝั่ง localAdapter — GAS ไม่ส่ง, frontend ไม่มี logic ดึง product.list ใหม่เมื่อเวอร์ชันเปลี่ยน | plan2 3.2 ข้อ 5 |
| M11 | PWA manifest `icons: []` — ติดตั้งบนแท็บเล็ตจะไม่สมบูรณ์, ไม่มีรูปสินค้า webp ใน `public/products/` | GAP-20 |
| M12 | Dexie ตาราง `products` และ `stockCache` เป็น dead code — ไม่เคยถูกเขียน/อ่าน (POS อ่านจาก localStorage state แทน), snapshot สต็อกที่ sale.syncBatch ตอบกลับถูกทิ้ง ไม่ได้เอามาอัปเดต | GAP-07 |
| M13 | ไม่มี Staging/Prod แยก, ไม่มี clasp config, ไม่มี CI | plan2 เฟส 0 |

---

## 3. ⚠️ ความไม่สอดคล้องของข้อมูล (Inconsistencies — Backend ↔ Frontend ↔ แผน)

### 3.1 Build พัง (พิสูจน์แล้วด้วย `npm run build`)
- **35 error**: ประกาศ type ไอคอนเป็น `ComponentType<{size?: number}>` ใน `App.tsx:84` ไม่เข้ากับ `LucideIcon` ของ lucide-react → ทุกจุดที่ส่งไอคอน error หมด (แก้ได้จุดเดียว: ใช้ type `LucideIcon`)
- **1 error**: `App.tsx:617` render ตัวแปร `preview` ชนิด `unknown` เป็น ReactNode ตรงๆ

### 3.2 บัคตรรกะเงิน: `repriceFreebie` ปัดเศษแล้วยอดไม่ลงตัว (App.tsx:930-950)
- ปัดเศษ 2 ชั้น (lineTotal แล้วค่อย unit_price ต่อหน่วย) และชดเชย `diff` โดยบวกเข้า **unit_price ต่อหน่วย** ของรายการแรก → ถ้ารายการแรก qty > 1 ยอดรวมจะคลาด diff × qty
- ตัวอย่างจริง: ซื้อ A 45.- ×3 + B 25.- ×1 → target 180.00 แต่ Σ รายการ = 179.99 บาท
- **ขัด GAP-17 โดยตรง** ("กันยอดบิลกับยอดรายการไม่เท่ากัน") — เทส B4 ตก

### 3.3 สองระบบ (GAS vs localAdapter) ทำงานไม่เหมือนกัน
| เรื่อง | GAS | localAdapter | ผล |
|---|---|---|---|
| Wastage → DailySummary | ❌ ไม่อัปเดต `wastage_value` เลย | ✅ อัปเดต (เฉพาะ finished, raw ไม่อัปเดต) | F4 (rebuild vs incremental) ตกแน่ ตัวเลข Dashboard จะต่างกันตามว่าเชื่อมระบบไหน |
| Login บน device ที่ถูก block | ✅ login ได้ (ไม่ตรวจ) | ❌ login ไม่ได้ (ตรวจ) | A12 ตกฝั่ง GAS |
| recipe.save | insert สูตรใหม่ทับ id เดิมโดย **ไม่ปิดสูตรเก่า** (active ซ้ำซ้อน) | ปิดสูตรเก่า active=false แล้วเปิดใหม่ | ฝั่ง GAS ขัดหลัก "แก้สูตร = ปิดเก่าเปิดใหม่" (Grand's ชีต 10, เทส D8) |
| catalog_version | ไม่ส่ง | ส่งทุก response | สลับไป GAS แล้ว logic (ที่ยังไม่เขียน) จะพังเงียบ |
| daily_trend ใน report.summary | คืน `[]` เสมอ | คำนวณจริง | กราฟเส้นบน Dashboard จะหายเมื่อขึ้น GAS |

### 3.4 ค่าใช้จ่ายไม่ถูกกรองตามช่วงเวลา (ทั้งสองระบบ)
`Reports.gs:12-14` และ `localAdapter.ts:291` กรอง Expenses ตาม **สาขาเท่านั้น** ไม่สน `expense_month`/ช่วงวันที่ → ดูรายงาน "รายวัน" จะถูกหักค่าใช้จ่าย **ทั้งประวัติศาสตร์** → `net_profit` ผิดความจริงทุกช่วงเวลาที่ไม่ใช่ inception (ขัด Grand's 7.1 "เดือนที่คาบเกี่ยวช่วง")

### 3.5 สิทธิ์ office ไม่ตรง plan2
- **office ไม่มี `sale.void`** ใน ROLE_ACTIONS (ทั้ง GAS และ local) — GAP-02 ระบุชัดว่า "Office/Owner void ได้ทุกบิลที่ยังไม่ reconcile"
- **office ไม่มี `recipe.list`** แต่หน้า Production ของ office ต้องเลือกสูตร — ตอนนี้ไม่พังเพราะ UI อ่านสูตรจาก localStorage ตรงๆ (ข้าม ACL) แต่เมื่อต่อ GAS จริงหน้า Production ของ office จะใช้ไม่ได้
- **office ไม่มี `report.*`** — สอดคล้องแผน ✅ แต่ Expenses_list ของ GAS ให้ office เห็นทุกสาขาผ่านเงื่อนไข `session.branch_id === "ALL"` ซึ่งกว้างกว่าที่ระบุ

### 3.6 ข้อมูลทุก role อยู่ในเครื่องเดียวกัน (Local Mode)
`loadState()` อ่าน state ทั้งก้อนจาก localStorage — **เครื่อง staff มีข้อมูล: รหัสผ่านทุกคนแบบ plain text, PIN เจ้าของ (246810), AuditLog ทั้งหมด, ยอดขายทุกสาขา** การแยกสิทธิ์เป็นแค่การซ่อนเมนู ไม่ใช่การแยกข้อมูลจริง — ยอมรับได้เฉพาะ demo, **ห้ามนำโหมดนี้ไปใช้จริงเด็ดขาด**

### 3.7 จุดเปราะใน GAS ที่จะกลายเป็นบัคข้อมูล
- `Sales_syncBatch`: ถ้าบิลใดในชุด throw (เช่น INVALID_CASH) → ทั้ง batch ตอบ fail แต่บิลก่อนหน้าเขียนไปแล้ว (ไม่มี rollback) และบิลเสียจะค้างใน outbox **retry ตลอดไป บล็อกคิวทั้งเครื่อง** (poison message) — ไม่มีกลไก dead-letter
- `SheetDB_update` ใช้ TextFinder **ค้นทั้งชีตทุกคอลัมน์** หา key — เปราะต่อค่าซ้ำข้ามคอลัมน์ และช้า
- `Inventory_extendExpiry` ไม่ตรวจว่า lot เป็นของสาขาตัวเอง — staff รู้ lot_id สาขาอื่นก็ยืดอายุได้
- `isWriteAction` จัด `reconcile.getDaily`, `expense.list`, `production.preview` (งานอ่าน) เข้า LockService → คอขวดโดยไม่จำเป็น
- `Reports_*` อ่านจากชีต `Sales` ตรงทุกครั้ง ไม่ใช้ DailySummary — สิ่งที่ GAP-06 ห้ามไว้ตรงๆ

### 3.8 UI/UX เล็กน้อยที่ไม่ตรงข้อมูล
- หน้า Login **prefill `owner/owner1234`** — สะดวก dev แต่หลุดไป prod = หายนะ
- Owner เข้า POS ได้แต่ branch ถูก hardcode เป็น BR-KASET (`App.tsx:301`)
- `seed.ts` คำนวณ `today/yesterday` ตอน import module — เปิดแอปค้างข้ามเที่ยงคืนค่าจะค้างวันเก่า
- SaleHistory ของ staff โชว์บิลทั้งสาขา (แผนให้โชว์ของเครื่องนี้/วันนี้)

---

## 4. 💡 สิ่งที่ควรปรับปรุง/เพิ่มเพื่อให้เว็บสมบูรณ์ (เรียงลำดับที่แนะนำ)

### เฟส A — ทำให้ "รันได้จริง" (ต้องทำก่อนทุกอย่าง)
1. แก้ TS error 36 จุด (เปลี่ยน type ไอคอนเป็น `LucideIcon`, แก้ `preview` ให้มี type) → build ผ่าน
2. สร้าง API switch: `VITE_API_MODE=local|gas` + `VITE_GAS_URL` → เขียน fetch จริงใน `client.ts` ด้วย `Content-Type: text/plain;charset=utf-8` (ปิด GAP-01 ฝั่ง client) — เก็บ localAdapter ไว้เป็นโหมด demo/dev ได้
3. Deploy GAS staging + รัน `setupSheets()` + ทดสอบ end-to-end ครั้งแรก
4. แก้ poison-message ใน syncBatch: ตอบผลรายบิล (`{id, status:'ok'|'duplicate'|'rejected', code}`) แทนการ throw ทั้งชุด + outbox แยกบิลเสียออกจากคิว

### เฟส B — ปิดช่องโหว่บัญชี/ความปลอดภัยที่ plan2 ชี้ไว้แล้ว
5. GAP-04: คำนวณ `business_date` จาก client_created_at สำหรับบิล offline + flag CLOCK_DRIFT
6. GAP-03: late_after_reconcile + สถานะ reopened + badge แจ้งเตือน
7. Login lockout (ใช้คอลัมน์ที่มีอยู่แล้ว) + rate limit ผ่าน CacheService + ตรวจ device blocked ตอน login
8. กฎ flag SUSPICIOUS อัตโนมัติ 4 ข้อ (ค่า Config พร้อมแล้ว เหลือโค้ด)
9. แก้ Audit_log ไม่ให้อ่านทั้งชีตทุกครั้ง — เก็บ last hash ใน Script Properties/CacheService
10. Trigger กลางคืน 5 ตัว: rebuild DailySummary / verifyAuditChain + อีเมล / Backup 30 วัน + 12 สัปดาห์ / ลบ session หมดอายุ / Health Report

### เฟส C — ฟีเจอร์ธุรกิจที่ขาด
11. Numpad component + ช่องแก้ราคาโหมดลดราคา (audit PRICE_OVERRIDE) + ช่องแก้ยอดรวมบิลแถม + แก้บัคปัดเศษ repriceFreebie (จัดสรรเศษที่ "ยอดรวมรายการ" ไม่ใช่ต่อหน่วย)
12. หน้า Admin เต็มรูป: จัดการผู้ใช้ (เพิ่ม/ปิด/รีเซ็ตรหัส/ตั้ง PIN/force-logout), จัดการสินค้า+ราคา (เขียน PriceHistory), แก้ Config, ตั้งชื่ออุปกรณ์
13. หน้า RecipeManager สำหรับ owner + แก้ recipe.save ฝั่ง GAS ให้ปิดสูตรเก่า
14. Dashboard: ตัวกรองสาขา + ช่วงเวลา 5 แบบ + กราฟเส้น daily_trend + อ่านจาก DailySummary + กรอง Expenses ตามช่วงเวลา (แก้ 3.4)
15. PDF: embed ฟอนต์ Sarabun + โครง 10-K 3 Part + หัวกระดาษ/เลขหน้า
16. Inventory 4 แท็บ + เตือนใกล้หมดอายุ/ของต่ำ, Production preview เป็น UI ✅/❌, Wastage เลือกจำนวน + ป้ายสี + dialog ยืนยัน, Reconcile บังคับ note เมื่อ mismatch + แสดงบิล void/OVERSOLD

### เฟส D — คุณภาพและความทนทาน
17. เขียนเทสตาม plan2 ส่วนที่ 7: เริ่มจาก Vitest (money, repriceFreebie, syncEngine) → Tests.gs (FIFO 560 บาท D1, cost locking D3, ทศนิยม D7) → Playwright offline chaos (C1–C2 สำคัญสุด)
18. i18n ครบทุกข้อความ + Error Boundary + toast error ค้างจนกดปิด + AUTH_EXPIRED เด้ง login โดยไม่ล้าง outbox
19. PWA icons + รูปสินค้า webp + ทดสอบ install บนแท็บเล็ต Android/iOS จริง (Safari IndexedDB eviction — เทส C2 บน iOS)
20. เอา prefill รหัสผ่านออกจากหน้า Login + ทำ stockCache จาก snapshot ที่ sync ตอบกลับ (GAP-07)

---

## 5. 📋 บทสรุปเพื่อการอนุมัติ (Approval Verdict)

| คำถาม | คำตอบ |
|---|---|
| โครงสร้างตรงแผนไหม? | ✅ ตรง — โครง 23 ชีต, แยกชั้น API, satang integer, หน่วยฐาน integer, FIFO+Cost Locking, hash chain ถูกวางตามแผนครบ |
| เป็นระบบ 3 สาขาที่ใช้งานจริงได้แล้วไหม? | ❌ ยัง — เป็น demo เครื่องเดียว (localStorage) backend GAS ยังไม่เคยถูกเรียก/deploy/ทดสอบ |
| Build/Test ผ่านไหม? | ❌ build แตก 36 error, เทส 0 เคสจากแผนเทส ~58 เคส (A–H) |
| ตัวเลขเงินเชื่อถือได้ไหม? | ⚠️ ยังไม่ได้ — มีบัคปัดเศษบิลแถม, ค่าใช้จ่ายไม่กรองช่วงเวลา (net_profit ผิด), business_date ตกวันผิดสำหรับบิล offline, wastage ไม่เข้า DailySummary ฝั่ง GAS |
| ความปลอดภัยตาม plan2 ครบไหม? | ⚠️ ~50% — hash รหัสผ่าน/token/PIN/audit chain ทำแล้วดี แต่ lockout, rate limit, block-at-login, flag rules, backup, chain verify schedule ยังไม่มี |

**สรุป:** งานรอบนี้สร้าง "โครงกระดูกครบทั้งตัว" ได้เร็วและทิศทางถูกต้องตามแผนมาก — schema, ตรรกะ FIFO/ต้นทุน, offline outbox และหน้าจอครบทุกหน้า แต่ยังอยู่สถานะ **Prototype** ไม่ใช่ Production: หัวใจที่ทำให้เป็น "ระบบ 3 สาขา" (การเชื่อม GAS + Google Sheets จริง) ยังไม่เกิดขึ้น, build ยังแตก, และเทสที่ plan2 บังคับเป็น exit criteria ยังเป็นศูนย์ แนะนำให้เดินตามเฟส A→B→C→D ในข้อ 4 โดย**ห้ามนำ Local Mode ไปใช้กับข้อมูล/เงินจริง**ระหว่างนี้

*จัดทำโดยการตรวจโค้ดทุกไฟล์เทียบ plan.md / Grand's.md / plan2.md — 2026-06-10*
