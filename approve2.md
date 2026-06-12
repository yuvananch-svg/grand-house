# ✅ approve2.md — รายงานตรวจรอบ 2 + สเปกงานใหม่ (ส่งต่อให้ Codex)

> **วันที่ตรวจ:** 2026-06-11
> **ขอบเขต:** (1) ตรวจโค้ด `backend/` + `frontend/` รอบใหม่ทั้งหมดเทียบ `plan.md` / `Grand's.md` / `plan2.md` และเทียบกับรายงานรอบแรก `approve.md` (2026-06-10) — โค้ดถูกแก้ไปมากหลังรอบแรก รายงานนี้คือสถานะจริงล่าสุด
> (2) รีวิวระบบอ้างอิง `ไม่มีชื่อโฟลเดอร์ 2` เฉพาะเมนู **สินค้า / คลัง / ค่าใช้จ่าย** เพื่อเลียนแบบ-ปรับปรุง
> (3) สเปกความต้องการใหม่ของเจ้าของ 3 เรื่อง: Master Item Catalog + รหัสจำแนกแหล่ง, หน้าบันทึกสูตรอาหาร, POS โหมด "ตัดของเสีย" + แก้ราคาโหมดขายพนักงาน
> **วิธีตรวจ:** อ่านโค้ดทุกไฟล์ + รัน `npm run build` (ผ่าน ✅) + `npm test` (7/7 ผ่าน ✅) จริง

---

## 🎯 0. สรุปผู้บริหาร (Executive Summary)

| หัวข้อ | รอบแรก (approve.md) | **รอบนี้ (จริง ณ 2026-06-11)** |
|---|---|---|
| `npm run build` | ❌ 36 errors | ✅ **ผ่าน** (เหลือ warning chunk ใหญ่) |
| Vitest | ❌ 0 เคส | ✅ 3 ไฟล์ / 7 เคสผ่าน (money, cartPricing, syncEngine) |
| เชื่อม GAS | ❌ ไม่มี fetch เลย | 🟡 **ครึ่งทาง** — `client.ts` มีสวิตช์ `VITE_API_MODE=local|gas` + fetch แบบ `text/plain` แล้ว แต่ **UI ทุกหน้ายังอ่านข้อมูลจาก localStorage ตรงๆ** (ดูข้อ 3.1) → โหมด gas เขียนขึ้นชีตได้แต่หน้าจอจะโชว์ข้อมูล local เดิม = ยังใช้จริง 3 สาขาไม่ได้ |
| ช่องโหว่ plan2 (GAP) | ขาดเป็นสิบข้อ | ✅ ปิดแล้วเกือบหมดฝั่ง backend: GAP-01,02,03,04,08(lockout+rate limit+block-at-login),09,10,11,12,13,14,15,18,19; Triggers กลางคืน 5 ตัวมีครบ |
| จุดวิกฤติคงเหลือ | — | **(1)** UI ไม่อ่านผ่าน API **(2)** ยังไม่เคย deploy GAS จริง/ไม่มี clasp/CI **(3)** Tests.gs + Playwright = 0 **(4)** ความต้องการใหม่ 3 เรื่องยังไม่มีในระบบ |
| พร้อม Go-Live? | ❌ | ❌ ยัง — แต่ระยะห่างสั้นลงมาก งานเหลือชัดเจนตามข้อ 6 |

---

## 1. ✅ งานที่ทำสำเร็จแล้ว (อัปเดตจาก approve.md)

### 1.1 ปิดได้ตั้งแต่รอบแรก → รอบนี้ (รายการที่เคยติด ❌)

| รหัสเดิม | รายการ | หลักฐานในโค้ด |
|---|---|---|
| C2 | Build ผ่าน — แก้ type ไอคอน/preview แล้ว | `npm run build` ✅ |
| C1 (client) | สวิตช์ `VITE_API_MODE=local\|gas` + `VITE_GAS_URL` + fetch `Content-Type: text/plain;charset=utf-8` + ตัดสินจาก `body.ok` + ยิง event `AUTH_EXPIRED` | `api/client.ts`, `.env.example` |
| Poison message | `sale.syncBatch` ตอบผลรายบิล `{id,status:ok\|duplicate\|rejected}`; ฝั่ง client ย้ายบิล rejected ไปสถานะ `dead` ไม่บล็อกคิว | `Sales.gs:1-13`, `db/syncEngine.ts` |
| C4 | Login lockout (failed_attempts/locked_until ใช้จริง) + rate limit CacheService 60 req/นาที + ตรวจ device blocked ตอน login | `Auth.gs` |
| C5 (GAP-04) | `business_date` คำนวณจาก client_created_at สำหรับบิล offline + flag `CLOCK_DRIFT` (>48 ชม.) + timezone Bangkok | `SheetDB.gs:118-131`, `Sales.gs:22-26` |
| C6 (GAP-03) | `late_after_reconcile` + เปลี่ยน Reconciliation เป็น `reopened` อัตโนมัติ + แสดงสถานะใน UI | `Sales.gs:89-98`, `App.tsx` (ReconcilePage) |
| C7 | Trigger กลางคืนครบ 5: rebuild DailySummary / verifyAuditChain+อีเมล / backup Drive / ลบ session หมดอายุ / Health Report 07:00 | `Triggers.gs` |
| 3.2 | บัคปัดเศษ `repriceFreebie` แก้แล้วด้วย largest-remainder ราย "หน่วย" — Σ รายการ = ยอดรวมเป๊ะ + มีเทส | `utils/cartPricing.ts` + test |
| H1 (บางส่วน) | โหมดลดราคามีช่องแก้ราคาต่อชิ้นแล้ว + backend ตั้ง flag `PRICE_OVERRIDE` และ `SUSPICIOUS` เมื่อ < 50% ของราคาป้าย | `App.tsx` POSPage, `Sales.gs:71-82` |
| H2 | ช่องแก้ "ยอดรวมบิลแถม" 1 ช่อง + pro-rate ตาม GAP-17 | `App.tsx` POSPage |
| H7 (ส่วนใหญ่) | Dashboard มีตัวกรองสาขา + ช่วงเวลา (วัน/7วัน/เดือน/ปี/inception) + กราฟเส้น daily_trend + Alert board (mismatch/reopened/SUSPICIOUS/ErrorLog) | `App.tsx` DashboardPage |
| 3.4 | ค่าใช้จ่ายกรองตามช่วงเดือนแล้วทั้ง 2 ฝั่ง (GAS + local) → net_profit รายช่วงถูกต้องขึ้น | `Reports.gs:64-70`, `App.tsx:1076` |
| 3.5 | office มี `sale.void` + `recipe.list` แล้ว | `Main.gs ROLE_ACTIONS` |
| 3.3 (recipe) | `recipe.save` ฝั่ง GAS ปิดสูตรเก่า active=false ก่อนเปิดใหม่ (ตรง local แล้ว) | `Production.gs:5-18` |
| 3.7 | `extendExpiry` ตรวจ branch ของ staff แล้ว; งานอ่านถูกถอดออกจาก LockService แล้ว | `Inventory.gs:129-137`, `Main.gs:134-145` |
| GAP-14 | log ขาล้มเหลวครบ: LOGIN_FAILED / LOGIN_LOCKED / FORBIDDEN_ATTEMPT / INVALID_TOKEN / PIN_FAILED / SALE_REJECTED | `Auth.gs`, `Main.gs`, `Sales.gs` |
| Audit เร็วขึ้น | last hash เก็บใน Script Properties — ไม่อ่านทั้งชีตทุกครั้งที่เขียน | `Audit.gs:1-7` |
| M4 | DayClose บังคับ outbox = 0 + ปุ่ม "ลองส่งอีกครั้ง" | `App.tsx` DayClosePage |
| M5 | Error Boundary + toast error ค้างจนกดปิด + AUTH_EXPIRED เด้ง login โดยไม่แตะ outbox | `App.tsx` |
| M6 (บางส่วน) | GoodsReceive/RawPurchase กันวันที่อนาคตฝั่ง backend แล้ว | `Inventory.gs:78-79,111-112` |
| M8 (บางส่วน) | Reconcile mismatch บังคับ note (`NOTE_REQUIRED`) + กันยืนยันซ้ำ (`ALREADY_RECONCILED` ยกเว้น reopened) | `Reconcile.gs:20-28` |
| M11 (บางส่วน) | PWA icons มีแล้ว (icon.svg / maskable.svg) | `public/icons/` |
| Prefill | เอา prefill รหัสผ่านออกจากช่อง login แล้ว (เหลือ hint ข้อความ — ดู 3.9) | `App.tsx` LoginScreen |

### 1.2 ของเดิมที่ยังดีอยู่ (ยืนยันซ้ำ)
- สถาปัตยกรรม 23 ชีตตรง plan2, เงินสตางค์ integer, ปริมาณหน่วยฐาน integer + display_factor, FIFO + Cost Locking (`unit_cost_locked`), lot_breakdown/consumption_detail JSON, hash chain + `verifyAuditChain()`, idempotency รายบิล, OVERSOLD ไม่ reject บิล, Wastage ตัดล็อตหมดอายุก่อน, rawWastage, PIN owner ฝั่งเซิร์ฟเวอร์, sanitize formula injection, offline outbox ผ่าน Dexie ครบทุก action ของ staff

---

## 2. ❌ แผนที่ยังทำไม่เสร็จ (เรียงความรุนแรง)

### 🔴 วิกฤติ — กั้นไม่ให้เป็น "ระบบจริง 3 สาขา"

| # | รายการ | อ้างอิง |
|---|---|---|
| C1' | **ชั้นอ่านข้อมูลของ UI ยังเป็น local-only:** ทุกหน้าเรียก `loadState()` จาก `localAdapter` ตรงๆ (`App.tsx:142`) → เมื่อสลับ `VITE_API_MODE=gas` การเขียนจะไปชีตจริง แต่ **หน้าจอยังแสดงข้อมูล seed ใน localStorage** ต้องสร้าง data layer ที่อ่านผ่าน API (`product.list`, `stock.myBranch`, `inventory.list`, `recipe.list`, `expense.list`, `reconcile.getDaily`, `report.summary`, `audit.query`) → cache ลง Dexie (`products`, `stockCache` ที่ตอนนี้เป็น dead code) → render แบบ stale-while-revalidate ตาม plan2 3.2 | plan2 3.2, GAP-07, M12 เดิม |
| C2' | **ยังไม่เคย deploy GAS จริง:** ไม่มี clasp config, ไม่มี staging/prod แยก, ไม่มี CI (build+test ก่อน deploy), end-to-end ครั้งแรกยังไม่เกิด | plan2 เฟส 0 |
| C3' | **เทสฝั่ง backend/E2E = 0:** ไม่มี `Tests.gs` (D1 ต้นทุน 560 บาท, D3 cost locking, D7 เศษทศนิยม), ไม่มี Playwright offline chaos (C1-C10) — เทสชุด A-H ทำได้จริง ~3/58 เคส | plan2 ส่วนที่ 7 |
| C4' | **ความต้องการใหม่ของเจ้าของ 3 เรื่อง (ข้อ 4) ยังไม่มีในระบบเลย** — Master Item Catalog + รหัส, หน้าสูตรอาหาร, POS "ตัดของเสีย" | คำสั่งเจ้าของ 2026-06-11 |

### 🟠 สูง — ฟีเจอร์ตามแผนที่ยังขาด

| # | รายการ | อ้างอิง |
|---|---|---|
| H1' | **Admin ยังจัดการได้แค่ block/unblock device:** ไม่มีจัดการผู้ใช้ (เพิ่ม/ปิด/รีเซ็ตรหัส/ตั้ง PIN/force-logout), ไม่มีจัดการสินค้า+ราคา → **PriceHistory ไม่มีทางถูกเขียน** (ชีตมี แต่ไม่มี action `product.save`/`price.change` ทั้งสองฝั่ง) | Grand's 8, plan2 S18, GAP-16 |
| H2' | **RecipeManager ไม่มีหน้า UI** — `recipe.save` มีครบทั้ง GAS/local แต่ไม่มีหน้าจอเรียก (ผูกกับความต้องการใหม่ข้อ 4.2) | Grand's RecipeManager.tsx, plan 5.2 |
| H3' | กฎ flag SUSPICIOUS อัตโนมัติทำแล้ว 1/4: ✅ ราคาต่ำกว่า 50% / ❌ ขายพนักงานถี่เกิน config / ❌ ปรับสต็อกถี่ / ❌ ทิ้งของมูลค่าสูงผิดปกติ | Grand's 7.4, เทส G4 |
| H4' | **PDF ยังใช้ฟอนต์ Roboto** — ตัวไทยในงบการเงินพัง, ไม่มีโครง 10-K 3 Part ใน PDF (มีแค่ตารางเดียว), ไม่มีหัวกระดาษ/เลขหน้า | Grand's 7.3, เทส F5 |
| H5' | **Inventory ยังเป็น 2 ตารางรวม** ไม่ใช่ 4 แท็บ (ข้าวกล่องแม่/ผลิตเอง/ของสด/ของแห้ง+บรรจุภัณฑ์), ไม่มีแถบเตือนใกล้หมดอายุ/ของต่ำกว่าขั้นต่ำ (ดูแบบ reference ข้อ 5.3) | plan 5, Grand's 5.1, plan2 S10 |
| H6' | AuditLog viewer กรองได้แค่ feature_group ฝั่ง UI (backend รองรับ branch/flag แล้วแต่ UI ไม่ส่ง) — ขาดกรอง พนักงาน/ช่วงเวลา/device/เฉพาะ SUSPICIOUS, แถบสรุป, drill-down detail, export CSV, แถบสถานะ hash chain | Grand's 7.4, plan2 S17 |
| H7' | **Dashboard/Reports ไม่อ่านจาก DailySummary** — `Reports_summary` ไล่อ่านชีต Sales ทุกครั้ง (สิ่งที่ GAP-06 ห้าม) และ `SheetDB_findById` (ใช้เช็กบิลซ้ำ) โหลดทั้งชีต — ช้าลงเรื่อยๆ แน่นอน; ไม่มี TextFinder/CacheService cache id; ไม่มี Archive รายปี | GAP-06 |
| H8' | ตัวกรองช่วงเวลา Dashboard ขาด "รายไตรมาส" (plan กำหนด 5 แบบ: วัน/เดือน/ไตรมาส/ปี/inception — ตอนนี้มี 7 วันแทนไตรมาส) | plan 7.1 |
| H9' | `catalog_version` ส่งกลับทุก response แล้ว (ทั้ง GAS/local) แต่ **frontend ไม่มี logic เทียบเวอร์ชันแล้วดึง product.list ใหม่** | plan2 3.2 ข้อ 5, M10 เดิม |

### 🟡 กลาง — UX/รายละเอียด

| # | รายการ |
|---|---|
| M1' | ไม่มีคอมโพเนนต์ Numpad ปุ่มใหญ่ — ช่องเงิน/จำนวนยังเป็น input พิมพ์ (ขัด No-typing layout) |
| M2' | Wastage: ทิ้งได้ทีละ 1 ชิ้นต่อการกด (backend รับ qty ได้แล้ว), ไม่มีป้ายสี 🔴🟡🟢 ตามวันหมดอายุ, ไม่มี dialog ยืนยันก่อนตัดสต็อก |
| M3' | Void: เหตุผล hardcode "จิ้มผิด", ไม่มีปุ่มเลือกเหตุผล 4 แบบด้วยไอคอน, ปุ่ม Void โชว์ทุกบิลแม้พ้น 15 นาที |
| M4' | Production preview ยังโชว์ JSON ดิบใน `<pre>` — ต้องเป็น UI ✅/❌ + ต้นทุนต่อชิ้นโดยประมาณ (backend คืน `estimated_unit_cost`, `canRun` ให้แล้ว เหลือ render) |
| M5' | GoodsReceive ไม่มีตาราง "รับเข้าล่าสุด 20 รายการ"; RawPurchase ไม่โชว์ "= 1,500 g" ใต้ช่อง (มีการคูณ display_factor แล้วแต่ไม่แสดง preview) |
| M6' | Reconcile UI ไม่แสดงบิล void/OVERSOLD แยกบรรทัด (backend คืน `sales` มาแล้ว) |
| M7' | i18n ครอบคลุม ~20 คำ — เนื้อหาหน้าจอส่วนใหญ่ hardcode ไทย |
| M8' | ไม่มีรูปสินค้า webp ใน `public/products/` (GAP-20), การ์ดสินค้าใช้ตัวอักษรย่อแทน |
| M9' | SaleHistory ของ staff โชว์ทั้งสาขา (plan2 S5 ให้โชว์ของเครื่องนี้/วันนี้) ; Owner เข้า POS แล้ว branch ถูก hardcode เป็น BR-KASET |
| M10' | Triggers: `nightlyRebuildDailySummary` rebuild **ทุกวันทั้งประวัติศาสตร์** (ควร rebuild เฉพาะเมื่อวาน — ข้อมูลโตแล้วจะชน quota 6 นาที), backup ไม่มีลบของเก่า (30 วัน/12 สัปดาห์ตาม GAP-22), Health Report ไม่มียอดขายเมื่อวาน/รายการ reconcile ค้าง |
| M11' | เอกสาร `docs/` (API_CONTRACT, SCHEMA, RUNBOOK) ยังไม่อัปเดตตามโค้ดรอบใหม่ และต้องเพิ่มสเปกข้อ 4 |

---

## 3. ⚠️ ความไม่สอดคล้องของข้อมูล (Backend ↔ Frontend ↔ UI/UX)

1. **(วิกฤติ) สองโลกข้อมูล:** UI render จาก `LocalState` (localStorage) เสมอ แม้ตั้งค่าโหมด gas — การเขียนผ่าน `callApi` จะไปชีตจริง แต่ `refresh()` เรียก `loadState()` ที่อ่าน localStorage → ข้อมูลบนจอไม่ตรงกับชีต = รายงาน/สต็อก/ประวัติทั้งหมดเชื่อถือไม่ได้ในโหมด gas (รายละเอียดวิธีแก้อยู่ข้อ 6 เฟส A)
2. **Dexie ตาราง `products` + `stockCache` เป็น dead code** — ประกาศไว้แต่ไม่เคยเขียน/อ่าน; snapshot สต็อกที่ตอบกลับจาก sync ไม่ถูกใช้ (GAP-07 ยังเปิดอยู่ครึ่งหนึ่ง: "คงเหลือประมาณ" บน POS อ่านจาก local lots ไม่ใช่ snapshot ล่าสุดจากเซิร์ฟเวอร์)
3. **คอลัมน์ flag เป็นค่าเดียวแบบ priority** (`Sales_chooseFlag`): ถ้าบิลเดียวกันทั้งแก้ราคาและ OVERSOLD จะเหลือ flag เดียว — `PRICE_OVERRIDE` หาย ทำให้สถิติการแก้ราคาใน audit ต่ำกว่าจริง → ควรเก็บหลาย flag (คั่น `,`) หรือ audit แยก action `PRICE_OVERRIDE` ต่อ item
4. **`Sales_processOne` เขียน SaleItems + ตัดสต็อกก่อนเขียนหัวบิล** — ถ้า throw กลางลูป (เช่นข้อมูล item เสีย) จะมี SaleItems ค้าง + สต็อกถูกตัด แต่ไม่มีแถว Sales (ไม่มี rollback) → บิลถูกตอบ rejected แล้วถูกแขวนใน dead queue แต่สต็อกหายไปแล้ว ควร validate ทุก item ให้จบก่อนแล้วค่อยเริ่มเขียน
5. **`Audit_log` ถูกเรียกนอก LockService ในบาง path** (login, INVALID_TOKEN ฯลฯ) — `AUDIT_LAST_HASH` ใน Script Properties อาจ race เมื่อ 2 เครื่องยิงพร้อมกัน → โซ่ hash ขาดปลอม (false positive ตอน verify) ควรครอบ lock เฉพาะจุดเขียน audit หรือใช้ LockService ใน Audit_log เอง
6. **seed `today/yesterday` คำนวณตอน import module** (`seed.ts:4-6`) — เปิดแอปค้างข้ามเที่ยงคืนแล้ว reset seed จะได้วันที่เก่า (เป็นปัญหาเฉพาะโหมด demo)
7. **Login hint โชว์รหัสตัวอย่าง** (`owner/owner1234...`) บนหน้า login — ต้องแสดงเฉพาะโหมด local (`import.meta.env`) ห้ามหลุดไป prod
8. **หน่วยเงินใน UI office บางช่องสับสน:** ฟอร์ม GoodsReceive/RawPurchase/Expenses กรอกเป็น "บาท" แล้วแปลงสตางค์ถูกต้อง ✅ แต่ไม่มีตัวอย่าง/preview ยืนยันค่าให้ผู้ใช้เห็นก่อนบันทึก (ความเสี่ยงคีย์ผิด ×100)
9. **`Expenses_list` ฝั่ง GAS:** office ที่ branch_id="ALL" เห็นทุกสาขา — กว้างกว่า payload ที่ส่ง (ยอมรับได้ตามสิทธิ์ office ปัจจุบัน แต่ควรระบุใน API contract)
10. **`Production_preview` ไม่กรองสูตร active และไม่ตรวจว่า recipe มีอยู่จริง** — ส่ง recipe_id มั่วจะได้ lines ว่าง + canRun=true → กด run แล้วค่อย error ที่ NOT_FOUND (UI ควรเลือกได้เฉพาะ active ซึ่งตอนนี้ RecipeSelect กรองแล้ว แต่ API ตรงไม่กัน)

---

## 4. 🆕 ความต้องการใหม่ของเจ้าของ (สเปกสำหรับ Codex — ยึดตามนี้)

### 4.1 Master Item Catalog — ฐานข้อมูลรายการของกลาง + รหัสจำแนกแหล่ง

**โจทย์:** ฐานข้อมูลเดียวเก็บ "ทุกรายการที่ร้านจะซื้อ/ขาย/ใช้" — ข้าวกล่องจากบริษัทแม่, เมนูผลิตเอง, วัตถุดิบ, บรรจุภัณฑ์, ของใช้/ซัพพลายจิปาถะ — เพื่อให้ทุกฟีเจอร์ (รับของ, ซื้อวัตถุดิบ, ค่าใช้จ่าย, สูตรอาหาร, POS, คลัง) ใช้เป็น **dropdown อ้างอิงชุดเดียวกัน** และเมื่อสินค้าชื่อซ้ำกันระหว่างบริษัทแม่กับผลิตเอง (เช่น "ข้าวกะเพราไก่" มีทั้งสองแหล่ง) ต้อง **จำแนกด้วยรหัส**

**รูปแบบรหัส (เลียนแบบ reference ที่พิสูจน์แล้วว่าใช้งานจริงได้):**

| Prefix | ความหมาย | ตัวอย่าง | แมปเข้าระบบเดิม |
|---|---|---|---|
| `PTG-xxx` | สินค้าสำเร็จรูปซื้อจากบริษัทแม่ (The Grand's) | PTG-001 ข้าวกะเพราไก่ | `Products.source_type='parent'` |
| `PGH-xxx` | เมนูสำเร็จรูปผลิตเอง (Grand's House) | PGH-001 ข้าวกะเพราไก่ | `Products.source_type='self_produced'` |
| `RM-xxx` | วัตถุดิบ (ของสด/ของแห้ง) | RM-001 เนื้อไก่สด | `RawMaterials.warehouse='raw_fresh'/'dry_supply'` |
| `PK-xxx` | บรรจุภัณฑ์ | PK-001 กล่องข้าว | `RawMaterials.is_packaging=true` |
| `SUP-xxx` | ซัพพลาย/ของใช้ที่ไม่ติดตามสต็อกเป็นล็อต (น้ำยาล้างจาน ถุงขยะ ฯลฯ) | SUP-001 น้ำยาล้างจาน | **ใหม่** — ใช้อ้างอิงใน Expenses (`supply_purchase`) |

**งานที่ต้องทำ:**
1. เพิ่มคอลัมน์ `item_code` (unique, รูปแบบ `<PREFIX>-<เลขรัน 3 หลัก>`) ในชีต `Products` และ `RawMaterials` + สร้างชีตใหม่ `SupplyItems` (`id, item_code, name_th, name_my, category, unit, active`) — backend สร้างเลขรันต่อ prefix อัตโนมัติ (อ่าน max ที่มีอยู่ +1, ครอบ LockService กันชนกัน)
2. action ใหม่: `item.list` (รวมทุกประเภท คืน `{item_code, name, type, unit, active}` สำหรับทำ dropdown เดียว), `item.save` (เพิ่ม/แก้/ปิดใช้งาน — owner เท่านั้น; แก้ราคา `sell_price/staff_price` ต้องเขียน `PriceHistory` + audit `PRICE_CHANGE` → ปิด GAP-16 ในงานเดียวกัน)
3. **หน้า "สินค้า" ใหม่** (owner; เมนูเดียวรวม master data ตามภาพ reference): แท็บบน `สินค้า | สูตรอาหาร` → ในแท็บสินค้าแยกตามแหล่ง: The Grand's (PTG) / Grand House (PGH+เลือกสาขาดูคงเหลือ) / วัตถุดิบ+บรรจุภัณฑ์ (RM/PK) / ซัพพลาย (SUP) พร้อม: ช่องค้นหา + datalist, ตารางคอลัมน์ `รหัส, ชื่อ, หมวด, ราคาขาย/หน่วย, ต้นทุน, คงเหลือ, สถานะ(toggle เปิด/ปิดใช้งาน)` — **ห้ามมีปุ่มลบถาวร** (ต่างจาก reference ที่ลบแถวทิ้ง — ของเราปิด active เท่านั้น เพื่อรักษาประวัติ)
4. การแสดงต้นทุนในตาราง 3 โหมดตาม reference: PTG = ต้นทุนรับเข้าล่าสุด, PGH = ต้นทุนตามสูตร (คำนวณจาก recipe × FIFO ราคาล็อตปัจจุบันของสาขาที่เลือก), RM/PK = ต้นทุนเฉลี่ยถ่วงน้ำหนักของล็อตคงเหลือ
5. เปลี่ยน dropdown ทุกหน้า (GoodsReceive, RawPurchase, Production, Expenses, Recipe) ให้แสดง `"ชื่อ [รหัส]"` และค้นหาได้ (search + datalist แบบ reference `App.tsx:1510-1527`) — โดย GoodsReceive เลือกได้เฉพาะ PTG, Production/Recipe output เฉพาะ PGH, RawPurchase เฉพาะ RM/PK, Expense ประเภท supply_purchase เลือก SUP
6. Migration: เติม `item_code` ให้ข้อมูล seed เดิม + อัปเดต `Bootstrap.gs setupSheets()` + `docs/SCHEMA.md`

### 4.2 หน้าบันทึกสูตรอาหาร (RecipeManager) — เพื่อคิดต้นทุน + ตัดสต็อก

backend มีครบแล้ว (`recipe.save` ปิดสูตรเก่า-เปิดใหม่, `production.preview/run` ตัด FIFO + lock ต้นทุน) — **เหลือ UI อย่างเดียว**:
1. อยู่ใต้เมนู "สินค้า" แท็บ "สูตรอาหาร" (ตาม reference): ฟอร์มสร้างสูตร — เลือกเมนูผลลัพธ์ (PGH เท่านั้น), จำนวนที่ได้ต่อ 1 รอบสูตร, แถวส่วนผสมเพิ่ม/ลดได้ไม่จำกัด (รองรับ 10+ ชนิด) เลือกจาก RM/PK พร้อมจำนวน **ในหน่วยแสดงผล** (UI แปลงเป็นหน่วยฐาน integer ด้วย display_factor ก่อนส่ง — กฎ GAP-05 ห้ามทศนิยมในชีต)
2. รายการสูตรที่มี: กดขยายเห็นส่วนผสม + **ต้นทุนต่อหน่วยโดยประมาณรายสาขา** (เรียก logic เดียวกับ `production.preview` หรือคำนวณจาก FIFO lots ฝั่ง client เมื่อ local) + ป้ายบอก "วัตถุดิบขาด: X" ถ้าผลิตไม่ได้
3. แก้สูตร = ส่ง `recipe.save` ใหม่ (ระบบปิดตัวเก่าให้อยู่แล้ว → ประวัติใบผลิตเก่าไม่เพี้ยน ตรง D8)
4. สิทธิ์: owner จัดการสูตร; office เห็นอ่านอย่างเดียว (มี `recipe.list` แล้ว)

### 4.3 POS: เพิ่มโหมดที่ 5 "ตัดของเสีย" + แก้ราคาได้ในโหมดขายพนักงาน

1. **ปุ่มประเภทรายการหน้า POS เป็น 5 ปุ่ม:** ขายปกติ / ลดราคา / สินค้าแถม / ขายพนักงาน / **ตัดของเสีย** (สีแดง ไอคอนถังขยะ)
2. โหมด "ตัดของเสีย": จิ้มสินค้าเหมือนขาย (แตะ = +1, แก้จำนวนได้) แต่ไม่มีช่องทางจ่ายเงิน/ราคา — กดยืนยันแล้วเข้า **outbox เป็น `wastage.create` รายตัว (qty ตามตะกร้า)** → backend เดิมตัด FIFO ล็อตหมดอายุก่อน + บันทึก `total_cost_value` เข้า Wastage/DailySummary ตามเดิม — **ไม่สร้าง sale_type ใหม่ ไม่แตะตาราง Sales** (ของเสียไม่ใช่รายได้ ตัวเลขรายงานจะไม่ปน) + dialog ยืนยันสรุป "ทิ้ง N รายการ มูลค่าจะถูกบันทึกเป็นของเสีย"
3. หน้านี้ทำให้พนักงาน "นับยอดของที่ต้องทิ้งวันนั้น" จบในที่เดียว — หน้า Wastage เดิม (ดูตามล็อต+ยืดอายุ) ยังคงอยู่สำหรับงานเย็นตามแผนเดิม และต้องอัปเกรดตาม M2' (เลือกจำนวน, ป้ายสี, dialog)
4. **โหมดขายพนักงาน:** เพิ่มช่องแก้ราคาต่อชิ้นแบบเดียวกับโหมดลดราคา (ตั้งต้น = `staff_price`) — backend ขยาย `Sales_priceFlag` ให้ครอบ `sale_type='staff'` ด้วย (เทียบกับ staff_price, ตั้ง `PRICE_OVERRIDE` + `SUSPICIOUS` ถ้าต่ำผิดปกติ)

---

## 5. 🔍 ผลรีวิว "ไม่มีชื่อโฟลเดอร์ 2" (เฉพาะ ค่าใช้จ่าย / สินค้า / คลัง) + สิ่งที่นำมาใช้

### 5.1 โลจิกการทำงานที่พบ (สรุปการเชื่อมโยงข้อมูล)

```
Product (master เดียว: PTG/PGH/RM/PK + supplier + standardCost + costStartDate + active)
   │ เป็น dropdown ให้ทุกฟีเจอร์
   ├─ คลัง: InventoryLot (branch, remaining, unitCost, expiryDate, source)
   │     ├─ "เบิกสินค้า The Grand's" → receiveLot(unitCost = standardCost ของสินค้า)
   │     ├─ "ผลิตสินค้า Grand House" → produceBatch: ตัดวัตถุดิบ FIFO (เรียง expiry)
   │     │      → lot ใหม่ unitCost = ต้นทุนรวม/จำนวน + CashEntry "ย้ายต้นทุน" + Movement
   │     └─ "รับเข้าวัตถุดิบ" → CashEntry "จ่ายเงิน" + receiveLot (unitCost = เงินรวม÷จำนวน)
   ├─ ค่าใช้จ่าย (CashPage): 2 แท็บ
   │     ├─ "ค่าใช้จ่ายทั่วไป" → CashEntry (วันที่/สาขา/หมวด/จำนวนที่ซื้อ/ช่องทางจ่าย/เงิน/โน้ต)
   │     └─ "ซื้อเข้าคลัง" → เลือก RM/PK จาก dropdown → CashEntry + InventoryLot ในคลิกเดียว
   │            (CashEntry.expenseProductId → Product, linkedId → LOT = ตรวจย้อนกลับได้)
   └─ InventoryMovement: ledger ทุกการขยับสต็อก (POS/ผลิต/รับเข้า/ปรับ/ของเสีย/ยกเลิกบิล)
        + ExpiryCenter: ลิสต์ใกล้หมดอายุ/หมดอายุ + ปุ่ม "ตัดเสีย" (adjustLot markWaste)
```

### 5.2 สิ่งที่ **นำมาใช้/ปรับปรุงให้ดีกว่า** ใน claude plan

| ไอเดียจาก reference | นำมาใช้อย่างไร (ปรับให้เข้าสถาปัตยกรรมเรา) |
|---|---|
| รหัสสินค้าตามแหล่ง PTG/PGH/RM/PK | ใช้เป็นแกนของข้อ 4.1 + เพิ่ม SUP |
| Master Product เดียวเป็น dropdown ทุกที่ | ข้อ 4.1 (`item.list` + dropdown "ชื่อ [รหัส]" ค้นหาได้) |
| ซื้อเข้าคลังจากหน้าค่าใช้จ่าย (expense + lot ในคลิกเดียว) | เพิ่มแท็บ "ซื้อเข้าคลัง" ในหน้า Expenses: เลือก RM/PK → เรียก `rawlot.purchase` ซึ่ง **เพิ่มการเขียน Expense (`supply_purchase` หรือหมวดวัตถุดิบใหม่ `raw_purchase`) ผูก `ref_id` = lot_id ในธุรกรรมเดียว** → เงินจ่ายซื้อของเข้าคลังโผล่ทั้งฝั่งค่าใช้จ่าย (กระแสเงิน) และฝั่งคลัง (สินทรัพย์) ตรวจย้อนกลับเจอกัน — ดีกว่า reference เพราะของเรามี audit + idempotency |
| ตารางค่าใช้จ่ายมี ช่องทางจ่าย + จำนวนที่ซื้อ + รายการที่ผูก | เพิ่มคอลัมน์ `payment_channel`, `purchase_qty`, `item_code` (optional) ในชีต `Expenses` + ตารางประวัติล่าสุดกรองตามสาขาแบบ chips |
| InventoryMovement ledger | เพิ่มชีต `StockMovements` (id, date, branch, lot_id, item_code, type: sale/production/receive/adjust/wastage/void, qty_change, value_change, ref_id) — backend เขียนทุกครั้งที่สต็อกขยับ → ปิดโจทย์ Traceability T1/T4 ของ plan2 ส่วนที่ 5 ได้สมบูรณ์ขึ้น (ตอนนี้พึ่ง lot_breakdown อย่างเดียว) |
| Inventory UI: chips กรองสาขา / แท็บสินค้า-วัตถุดิบ / กรอง supplier / กรองหมวด + ฟอร์มรับเข้า-ผลิตฝังในหน้าเดียว | ใช้เป็นแบบหน้า Inventory 4 แท็บ (ปิด H5'): แท็บ = 4 คลังตามแผน, แต่ละแถวเจาะลงเห็นรายล็อต, แถบเตือนใกล้หมดอายุ 3 วัน + ของต่ำกว่าขั้นต่ำบนสุด |
| ExpiryCenter + ปุ่มตัดเสีย | รวมเข้ากับแถบเตือนใน Inventory + โหมด "ตัดของเสีย" ของ POS (ข้อ 4.3) |
| โชว์ต้นทุน 3 โหมด (standard/recipe/lot-average) | ใช้ในหน้า "สินค้า" ใหม่ (ข้อ 4.1 ข้อย่อย 4) |
| เปลี่ยนราคา/ต้นทุน = สร้างรายการใหม่+ปิดตัวเก่า (costStartDate) | ของเราใช้ `PriceHistory` แทน (ดีกว่า — ไม่ปั๊มแถว Product ซ้ำ) แต่เก็บแนวคิด "วันที่เริ่มใช้ราคา" ไว้ในฟอร์มแก้ราคา |

### 5.3 จุดอ่อนของ reference ที่ **ห้ามลอกมา**
- เงิน/ปริมาณเป็น float (`unitCost: 31.5`, หาร `amount/quantity` ตรงๆ) → ของเรายึดสตางค์ integer + หน่วยฐาน integer เท่านั้น
- `deleteProduct` ลบแถวถาวร → ของเราใช้ active=false เท่านั้น
- `today` hardcode `"2026-06-03"` ทั้งระบบ, id แบบเลขรันต่อเครื่อง (ชนกันแน่เมื่อหลายเครื่อง), ไม่มี auth/branch enforcement ฝั่งเขียน, ไม่มี idempotency/offline queue, audit แก้ย้อนหลังได้ — ทั้งหมดนี้ระบบเรามีของที่ดีกว่าอยู่แล้ว ให้คงไว้

---

## 6. 📋 ลำดับงานสั่ง Codex (ทำตามลำดับ — แต่ละเฟสมี DoD)

### เฟส A — ปิดวงจร "ระบบจริง" (ทำก่อนทุกอย่าง)
1. **Data layer อ่านผ่าน API** (แก้ข้อ 3.1): สร้าง `stores/dataStore.ts` — โหลด `product.list` / `stock.myBranch` / `inventory.list` / `recipe.list` / `expense.list` / `report.summary` / `audit.query` / `reconcile.getDaily` ผ่าน `callApi` → เขียน cache ลง Dexie (`products`, `stockCache` ที่มีอยู่) → ทุกหน้าเลิก import `loadState` ตรง (localAdapter ยังเป็น backend จำลองของโหมด local อยู่เบื้องหลัง `callApi` — UI ต้องไม่รู้จักมัน) + stale-while-revalidate + ใช้ `catalog_version` เทียบเพื่อ refetch (ปิด H9')
2. Deploy GAS staging จริง: clasp + Script Properties (`SPREADSHEET_ID`, `PEPPER`, `ALERT_EMAIL`) + รัน `setupSheets()` + `installNightlyTriggers()` + ทดสอบ end-to-end 1 รอบ (login→ขาย→void→reconcile→dashboard)
3. CI ขั้นต่ำ: `npm run build` + `vitest` ผ่านก่อน merge
**DoD:** ตั้ง `VITE_API_MODE=gas` แล้วใช้งานครบวงจรได้จริงจาก 2 เครื่องพร้อมกัน ข้อมูลบนจอ = ข้อมูลในชีต

### เฟส B — ความต้องการใหม่ของเจ้าของ (สเปกข้อ 4 ทั้งหมด)
4. Master Item Catalog + `item_code` + ชีต `SupplyItems` + action `item.list`/`item.save` + เขียน `PriceHistory` เมื่อแก้ราคา + หน้า "สินค้า" (4.1)
5. หน้า "สูตรอาหาร" ในเมนูสินค้า (4.2)
6. POS 5 โหมด + "ตัดของเสีย" + แก้ราคาโหมดขายพนักงาน + ขยาย `Sales_priceFlag` (4.3)
7. หน้า Expenses เพิ่มแท็บ "ซื้อเข้าคลัง" + คอลัมน์ `payment_channel`/`purchase_qty`/`item_code` + ชีต `StockMovements` ledger (5.2)
**DoD:** เพิ่มสินค้าซ้ำชื่อ 2 แหล่งแล้วได้ PTG-xxx / PGH-xxx แยกกัน, dropdown ทุกหน้าโชว์รหัส, สร้างสูตร→ผลิต→ต้นทุนล็อก→ขาย→ตัดของเสีย ครบวงจร, ซื้อของเข้าคลังแล้วเห็นทั้งใน Expenses และ Inventory ผูกกันด้วย ref

### เฟส C — แก้ความไม่สอดคล้อง + ฟีเจอร์ค้างของแผนเดิม
8. แก้ข้อ 3.3 (multi-flag), 3.4 (validate ก่อนเขียนใน `Sales_processOne`), 3.5 (lock ครอบ Audit_log), 3.7 (ซ่อน login hint นอกโหมด local), M9' (owner เลือกสาขาใน POS, SaleHistory staff = เครื่องนี้/วันนี้)
9. Admin เต็มรูป (H1'): จัดการผู้ใช้/PIN/force-logout + จัดการ Config
10. Inventory 4 แท็บ + แถบเตือน (H5' ใช้แบบ reference), Production preview เป็น UI ✅/❌ + ต้นทุนประมาณ (M4'), Wastage เลือกจำนวน+ป้ายสี+ยืนยัน (M2'), Void เลือกเหตุผล 4 แบบ (M3'), Reconcile แสดงบิล void/OVERSOLD (M6'), Numpad component (M1'), GoodsReceive ตาราง 20 รายการ + RawPurchase preview หน่วย (M5')
11. กฎ SUSPICIOUS อีก 3 ข้อ (H3'), PDF ฟอนต์ Sarabun + โครง 10-K (H4'), AuditLog viewer ครบตัวกรอง + CSV + สถานะ chain (H6'), Dashboard เพิ่มรายไตรมาส (H8')
12. Performance ตาม GAP-06: reports อ่าน DailySummary (วันนี้เท่านั้นอ่าน Sales สด), idempotency ใช้ TextFinder+CacheService, rebuild เฉพาะเมื่อวาน, backup ลบเก่า 30 วัน/12 สัปดาห์ (M10', H7')

### เฟส D — เทส + Hardening (exit criteria ตาม plan2 ส่วนที่ 7)
13. `Tests.gs`: D1 (560 บาท), D3 (cost locking), D7 (เศษสะสม), A7/A8/A11 + เคสใหม่: item_code รัน unique, ตัดของเสียลง wastage_value ถูกต้อง
14. Playwright offline chaos: C1, C2 (ปิดเครื่องแล้วบิลไม่หาย), C8, C10 + เคสตัดของเสีย offline
15. i18n เนื้อหาหลักครบ 2 ภาษา (M7'), รูปสินค้า webp (M8'), อัปเดต `docs/` ทั้ง 4 ไฟล์ (M11')
**DoD รวม:** เทสชุด A-H ที่เกี่ยวข้องผ่านบน staging, ขายคู่ขนานกับจดมือ 3 วันยอดตรงตาม plan2 8.3

---

*จัดทำจากการอ่านโค้ดทุกไฟล์ของทั้งสองโปรเจกต์ + รัน build/test จริง — 2026-06-11 | ไฟล์นี้ใช้คู่กับ plan.md / Grand's.md / plan2.md (plan2 ศักดิ์สูงสุด) และแทนที่ approve.md ในส่วนสถานะที่ล้าสมัยแล้ว*
