# 🔍 plan3.md — รีวิวโค้ดทั้งระบบ + ช่องโหว่ความปลอดภัย + บัค + แผนพัฒนารอบถัดไป

> **วันที่ตรวจ:** 2026-06-11
> **วิธีตรวจ:** อ่านโค้ดทุกไฟล์จริง (frontend 24 ไฟล์ / backend GAS 16 ไฟล์ / เอกสารแผน 5 ไฟล์) + รัน `npm run build` (ผ่าน ✅) + `npm test` (14/14 ผ่าน ✅) + เทียบกับภาพหน้าจอผลลัพธ์ที่เจ้าของต้องการ
> **จุดยืนการรีวิว:** ตรงไปตรงมา ไม่เข้าข้าง — ระบุทั้งจุดแข็งที่พิสูจน์ได้และจุดอ่อนที่ต้องแก้ พร้อมความรุนแรงและแผนแก้ทุกข้อ
> **เอกสารนี้ต่อจาก:** plan.md → Grand's.md → plan2.md (ศักดิ์สูงสุด) → approve.md → approve2.md → **plan3.md (ไฟล์นี้)**

---

# ส่วนที่ 1: สรุปผู้บริหาร (Executive Summary)

## 1.1 ระบบแมชกับสิ่งที่ต้องการกี่ %

| มิติการเทียบ | % แมช | คำอธิบาย |
|---|---|---|
| เทียบ **ภาพหน้าจอผลลัพธ์** ที่แนบมา (POS 5 โหมด + ซื้อวัตถุดิบ) | **~95%** | สองหน้านี้ตรงตามภาพแล้วเกือบสมบูรณ์ — POS มี 5 ปุ่มประเภทขาย, ตะกร้า, 6 ช่องทางจ่าย, สต็อกประมาณ; RawPurchase มี dropdown รหัส + preview "= 1,000 g" ขาดเพียงรายละเอียดปลีกย่อย (เช่น ปุ่มหมวดสินค้า ที่เป็นความต้องการใหม่) |
| เทียบ **แผนเดิมทั้งหมด** (plan.md + Grand's.md + plan2.md + approve2.md) | **~90%** | ฟีเจอร์หลักครบ: POS 5 โหมด, FIFO + Cost Locking, Void, Reconcile + reopened, Master Item Catalog + รหัส 5 prefix, สูตรอาหาร, Wastage 2 ชนิด, DailySummary, Audit hash chain, Admin เต็มรูป, PDF Sarabun, Backup/Triggers 5 ตัว — ที่ยังขาด: Playwright offline-chaos (C3'), multi-flag audit (3.3), CI, และบัคที่พบใหม่ในรีวิวนี้ (ส่วนที่ 4) |
| เทียบ **ความต้องการใหม่ 5 ข้อ** ของเจ้าของ (รอบนี้) | **~20%** | ① Responsive ทุก device — มีแค่ breakpoint เดียว (980px) ยังไม่ใช่ mobile-first จริง ② กล่อง layout ขนาดไม่เท่ากัน — ยังมีอยู่จริงอย่างน้อย 9 จุด (ส่วนที่ 5.2) ③ รูปภาพสินค้าใน master + เก็บบน Google Sheets — **ยังไม่มี UI อัปโหลดเลย** (schema มี `image_url` แต่ `item.save` เซ็ตค่าว่างตายตัว) ④ วิเคราะห์รายได้ 5 ประเภท — ปัจจุบันแสดงแค่ 2 กลุ่ม (ลูกค้า vs พนักงาน) ⑤ ปุ่มหมวดสินค้าใน POS + หมวดชัดเจนใน master — ยังไม่มี (หมวดที่มีอยู่เป็น enum คนละชุดกับที่ต้องการ) |
| **ภาพรวมถ่วงน้ำหนัก** | **~78%** | โครงสร้างหลังบ้านแข็งแรงเกินมาตรฐานโปรเจกต์ขนาดนี้ แต่ยังไม่พร้อม Go-Live เพราะมีบัควิกฤติ 1 ตัว (BUG-01) + ช่องโหว่ตรรกะเงินฝั่ง server 1 ตัว (SEC-01) ที่ต้องแก้ก่อน และความต้องการใหม่ 5 ข้อยังไม่ได้เริ่ม |

## 1.2 คำตัดสินแบบตรงไปตรงมา

**สิ่งที่ทำได้ดีจริง (พิสูจน์จากโค้ด ไม่ใช่คำชม):**
- เงินเป็นสตางค์ integer + ปริมาณเป็นหน่วยฐาน integer ทั้งระบบ (GAP-05 ปิดจริง — `utils/money.ts`, `display_factor`)
- FIFO ข้ามล็อต + Cost Locking ถูกต้อง มี unit test ครอบ (เคส 560 บาทจาก plan.md ผ่าน)
- Offline outbox ผ่าน Dexie ครบทุก action ของ staff + idempotency ฝั่ง server (CacheService + TextFinder)
- ความปลอดภัยหลายชั้นทำจริง: token hash-at-rest, iterated hash 10,000 รอบ + PEPPER, lockout, rate limit, device registry, formula-injection sanitize, audit hash chain + verify กลางคืน, backup + prune 30 วัน
- แยกชั้น API (`client.ts` switch local/gas) สะอาด — ย้าย backend ในอนาคตได้โดย UI ไม่ต้องแก้

**สิ่งที่ต้องพูดตรงๆ:**
1. **มีบัควิกฤติที่ทำลายข้อมูล master ได้จากการกดปุ่มเดียว** — ปุ่ม "เปิด/ปิดใช้งาน" ในหน้าสินค้า จะล้างราคาขายเป็น 0, รีเซ็ตหมวด, และเปลี่ยน `display_factor` ของวัตถุดิบเป็น 1000 (รายละเอียด BUG-01) ต้องแก้ก่อนใช้งานจริงเด็ดขาด
2. **Server ยังเชื่อตัวเลขเงินจาก client** — `total_amount` ของบิลไม่ถูกตรวจกับผลรวมรายการฝั่ง server ขัดกับกฎเหล็กของ plan2 GAP-18 ("อย่าเชื่อ client เด็ดขาด") เปิดทางพนักงานที่รู้เทคนิคยิง API ตรงเพื่อลงยอดต่ำกว่าเงินที่รับจริง (SEC-01)
3. **โหมด gas (ที่เปิดใช้อยู่ตอนนี้ตาม `.env.local`) มีบัคแสดงผล "โซ่ hash ขาด" ปลอมตลอดเวลา** เพราะ snapshot ตัด audit เหลือ 250 แถวท้าย แต่ตัวตรวจ chain เริ่มจาก GENESIS (BUG-02) — ทำให้ owner เห็นสัญญาณเตือนปลอมจนชินและเพิกเฉยต่อสัญญาณจริง
4. Responsive ยังไม่ถึงเป้า "ใช้ได้ทุก device" — จอโทรศัพท์แนวตั้งใช้งาน POS ลำบาก (sidebar กินจอ, ตารางต้อง scroll แนวนอน, ฟอร์มกว้างเกินบนจอใหญ่)

---

# ส่วนที่ 2: ผลรีวิวเทียบแผนงานรายฟีเจอร์

## 2.1 ตารางสถานะ (ยึด approve2.md เป็น baseline แล้วตรวจซ้ำกับโค้ดจริงวันนี้)

| กลุ่ม | สถานะจริงจากโค้ด | หลักฐาน |
|---|---|---|
| Phase A — Data layer ผ่าน API + Dexie cache | ✅ เสร็จ | `stores/dataStore.ts` (app.snapshot → mergeState → cacheAppState), `db/dexie.ts` v2 (products/stockCache/appCache ใช้งานจริงแล้ว ไม่ใช่ dead code) |
| §4.1 Master Item Catalog + รหัส PTG/PGH/RM/PK/SUP | ✅ เสร็จ (มีบัค BUG-01) | `Items.gs`, `localAdapter.saveMasterItem`, `ItemsPage` 4 แท็บ + ค้นหา + ไม่มีปุ่มลบถาวร ✅ |
| §4.2 RecipeManager UI | ✅ เสร็จ | `RecipeManager` ใน App.tsx — สร้างสูตร, ปิดสูตรเก่าอัตโนมัติ, ต้นทุนประมาณ (มีบัคย่อย BUG-10: ต้นทุน "รายสาขา" จริงๆ ไม่กรองสาขา) |
| §4.3 POS 5 โหมด + ตัดของเสีย + แก้ราคาโหมดพนักงาน | ✅ เสร็จ | `POSPage` — wastage mode เข้า outbox เป็น `wastage.create` รายตัว ตรงสเปก, `Sales_priceFlag` ครอบ staff แล้ว |
| §5.2 ซื้อเข้าคลัง (expense + lot คลิกเดียว) + StockMovements ledger | ✅ เสร็จ | `rawlot.purchase {as_expense:true}` ผูก `ref_id=lot_id` ทั้ง local+GAS; `StockMovements_record` ครบทุก path แล้ว (sale/void/wastage/receive/purchase/production/adjust) |
| H1' Admin เต็มรูป (ผู้ใช้/PIN/force-logout/Config) | ✅ เสร็จ | `AdminPage` + `Auth_userManage` (PIN/รหัสผ่าน share salt — มีคอมเมนต์กำกับถูกต้อง) |
| H3' กฎ SUSPICIOUS 4 ข้อ | 🟡 3.5/4 | ราคาต่ำ<50% ✅, ขายพนักงานถี่ ✅, ทิ้งของมูลค่าสูง ✅, ปรับสต็อก = flag ทุกครั้ง (ไม่ใช่ "ถี่เกิน config" — เข้มกว่าแผน ยอมรับได้) |
| H4' PDF Sarabun + 10-K 3 Part | ✅ เสร็จ | `FinancialPage.exportPdf` — embedded font + header/footer + 3 Parts |
| H5' Inventory 4 แท็บ + แจ้งเตือนหมดอายุ | ✅ เสร็จ | `InventoryPage` + expiry badge 🔴🟡🟢 |
| H6' AuditLog viewer ครบตัวกรอง + CSV + chain status | ✅ เสร็จ (มีบัค BUG-02 ใน gas mode) | `AuditPage` |
| H7'/GAP-06 Performance ฝั่ง GAS | 🟡 ส่วนใหญ่เสร็จ | `Reports_summary` อ่าน DailySummary ✅, `Sales_exists` ใช้ Cache+TextFinder ✅, rebuild เฉพาะเมื่อวาน ✅, backup prune 30 วัน ✅ — **แต่ `app.snapshot` อ่านทุกชีตทั้งใบ และ frontend เรียกทุก 15 วินาที** (BUG-07) ซึ่งจะกลายเป็นคอขวด/กิน quota เมื่อข้อมูลโต — ยังไม่มี Archive รายปี และ backup รายสัปดาห์ 12 สัปดาห์ยังไม่แยกชุด |
| C2' Deploy GAS จริง | 🟡 ทำแล้วบางส่วน | `.clasp.json` มี scriptId จริง + `.env.local` ชี้ URL deployment จริง (โหมด gas เปิดใช้อยู่) — แต่ยังไม่มี staging/prod แยก, ไม่มี CI |
| C3' Playwright offline chaos (C1-C10) | ❌ ยังไม่มี | ไม่มี Playwright ในโปรเจกต์ — เทสชุด C ซึ่ง plan2 ระบุว่า "สำคัญที่สุดของระบบนี้" ยังเป็น 0 |
| 3.3 Multi-flag audit | ❌ ยังไม่แก้ | `Sales_chooseFlag`/`chooseSaleFlag` ยังเก็บ flag เดียวแบบ priority — บิลที่ทั้งแก้ราคา+OVERSOLD จะเหลือ flag เดียว สถิติการแก้ราคาต่ำกว่าจริง |
| เอกสาร docs/ 4 ไฟล์ | ✅ อัปเดตแล้ว | SCHEMA/API_CONTRACT/RUNBOOK ตรงโค้ดรอบล่าสุด |

## 2.2 ความไม่สอดคล้องที่ approve2 ข้อ 3 เคยระบุ — สถานะวันนี้

| ข้อ | สถานะ |
|---|---|
| 3.1 สองโลกข้อมูล (UI อ่าน localStorage ตรง) | ✅ แก้แล้ว — ทุกหน้าอ่านผ่าน `loadAppData` → `app.snapshot` |
| 3.2 Dexie dead code | ✅ แก้แล้ว — stockCache ถูกเขียนจาก sync response จริง |
| 3.3 flag เดียวแบบ priority | ❌ ยังอยู่ |
| 3.4 เขียน SaleItems ก่อนหัวบิล ไม่มี rollback | 🟡 แก้ครึ่งเดียว — มี pre-validate รายการก่อนเริ่มเขียนแล้ว แต่ถ้า error กลางลูป (เช่น quota) ยังเกิด partial write + เสี่ยงตัดสต็อกซ้ำตอน retry (ดู SEC-13) |
| 3.5 Audit_log นอก lock | ✅ แก้แล้ว — `GH_WRITE_LOCK_HELD` + lock ภายใน Audit_log |
| 3.6 seed คำนวณวันที่ตอน import | ❌ ยังอยู่ (กระทบเฉพาะโหมด demo) |
| 3.7 login hint โชว์รหัส | ✅ แก้แล้ว — แสดงเฉพาะ `apiMode === "local"` |
| 3.10 Production_preview ไม่กรองสูตร active | ❌ ยังอยู่ (GAS) — ส่ง recipe_id มั่ว/สูตรปิดแล้ว ได้ lines ว่าง + canRun=true |

---

# ส่วนที่ 3: ช่องโหว่ความปลอดภัย (Security Findings) + แผนแก้

> เรียงตามความรุนแรง — ทุกข้อระบุไฟล์/จุดแก้ชัดเจน วิเคราะห์จากมุมผู้โจมตี 3 แบบ: คนนอกที่ได้ URL, พนักงานที่อยากโกง, และอุปกรณ์/บัญชีที่หลุด

## 🔴 SEC-01 (สูง): Server ไม่ตรวจ `total_amount` กับผลรวมรายการ — เปิดทาง "ลงยอดต่ำกว่าเงินที่รับจริง"

- **จุด:** `backend/Sales.gs:Sales_processOne` และ `frontend/src/api/localAdapter.ts:processSale`
- **ปัญหา:** server รับ `draft.total_amount` จาก client ตรงๆ ไม่เคยตรวจว่า = Σ(`unit_price × qty`) ของรายการ และในโหมด **ขายปกติ (normal)** `unit_price` ของแต่ละชิ้นก็ไม่ถูกเทียบกับราคาป้าย (`Sales_priceFlag` ครอบเฉพาะ discount/staff) → พนักงานที่รู้เทคนิค (หรือเครื่องที่ติด malware) สามารถยิง `sale.syncBatch` ที่มีรายการสินค้าจริงแต่ `total_amount` ต่ำกว่าจริง — สต็อกถูกตัดครบ ลูกค้าจ่ายเต็ม แต่ระบบบันทึกรายได้ต่ำ → ส่วนต่างเข้ากระเป๋าโดยไม่มี flag ใดๆ
- **ความเสี่ยงจริง:** ขัดกฎเหล็ก plan2 GAP-18 โดยตรง ("ทุกตัวเลขต้องตรวจฝั่งเซิร์ฟเวอร์ — อย่าเชื่อ client เด็ดขาด") และเป็นช่องโกงเงินสดที่ Reconcile จับไม่ได้ (เพราะยอดระบบ = ยอดที่ถูกปลอม)
- **แผนแก้:**
  1. ใน `Sales_processOne`: คำนวณ `serverTotal = Σ(Number(item.unit_price) × Number(item.qty))` แล้ว **reject ถ้า `draft.total_amount !== serverTotal`** ด้วย code `TOTAL_MISMATCH`
  2. ตรวจ `total_amount` เป็น integer ≥ 0, `cash_received`/`change_given` integer ≥ 0
  3. ขยาย `Sales_priceFlag` ให้ครอบโหมด `normal` และ `freebie` ด้วย: ถ้า `unit_price` ต่างจาก `sell_price` (ยกเว้นตัวแถม=0 และตัวซื้อ freebie ที่ pro-rate แล้วให้เทียบ "ยอดรวมบิล ≥ 50% ของยอดตั้งต้นตาม GAP-17" แทนรายชิ้น) → ตั้ง `PRICE_OVERRIDE`/`SUSPICIOUS`
  4. ทำซ้ำตรรกะเดียวกันใน `localAdapter.processSale` ให้สองโหมดตรงกัน

## 🔴 SEC-02 (สูง): PIN เจ้าของ 6 หลัก brute-force ได้ — ไม่มี lockout ของ PIN

- **จุด:** `backend/Inventory.gs:Inventory_stockAdjust` (และ local adapter)
- **ปัญหา:** ใส่ PIN ผิดได้ไม่จำกัด (มีแค่ rate limit 60 req/นาที ซึ่ง bypass ได้ตาม SEC-03) → PIN 6 หลัก = 1,000,000 แบบ ที่ 60 ครั้ง/นาที ใช้เวลา ~11 วัน, ถ้า bypass rate limit ได้จะเร็วกว่านั้นมาก — office ที่ตั้งใจโกงสต็อกมีเวลาเหลือเฟือ (เทส A10 ของ plan2 ระบุเรื่องนี้ไว้แล้วแต่ยังไม่ได้ implement)
- **แผนแก้:**
  1. เพิ่มตัวนับ `pin_failed_attempts` + `pin_locked_until` ในชีต Users (เฉพาะแถว owner) — ผิดครบ 5 ครั้ง → ล็อกการอนุมัติ 15 นาที + อีเมลแจ้ง owner ทันที (`notifyAlert`)
  2. Audit `PIN_FAILED` มีอยู่แล้ว ✅ — เพิ่มกฎ: PIN_FAILED ≥ 3 ครั้ง/ชั่วโมง → flag SUSPICIOUS ระดับ device

## 🟠 SEC-03 (กลาง): Rate limit ผูกกับ `device_id` ที่ client กำหนดเอง — bypass ได้ด้วยการสุ่ม device_id ใหม่ทุก request

- **จุด:** `backend/Auth.gs:Auth_enforceRateLimit` ใช้ `device_id || token` เป็น key — ผู้โจมตีจากภายนอกที่ได้ URL สุ่ม `device_id` ใหม่ได้ฟรี → ยิงถล่ม/ไล่เดารหัสข้ามผู้ใช้หลายคนพร้อมกันได้ (per-user lockout ยังช่วยกันเดารหัสรายคนอยู่ ✅ แต่ flood ทั้งระบบกันไม่ได้)
- **แผนแก้:**
  1. เพิ่ม rate limit ชั้นที่สอง: key รวมทั้งสคริปต์ (`rate:GLOBAL:<นาที>`) เช่น 600 req/นาที — เกินแล้วตอบ RATE_LIMITED ทุก request ชั่วคราว + อีเมลแจ้ง owner (สัญญาณว่ากำลังโดนยิง)
  2. action `login` ใช้ key เพิ่มอีกชั้นจาก `payload.user_id` (เช่น 10 ครั้ง/นาที/user_id) — กันไล่เดาแบบกระจาย device
  3. ยอมรับข้อจำกัด GAS (ไม่มี IP) และบันทึกไว้ใน docs ตามที่ plan2 ส่วนที่ 4 ระบุ

## 🟠 SEC-04 (กลาง): ปิดบัญชีผู้ใช้แล้ว session เดิมยังใช้ได้ต่อจนหมดอายุ (30 วัน)

- **จุด:** `Auth_verifyToken` ตรวจแค่ token_hash/expiry/revoked — ไม่ตรวจว่า user ยัง `active` อยู่
- **ความเสี่ยง:** ไล่พนักงานออกแล้วกด "ปิดบัญชี" แต่ลืมกด force_logout → พนักงานเก่ายังใช้แอปได้อีก 30 วัน
- **แผนแก้:** ใน `Auth_userManage` mode `update_user` เมื่อ `active=false` ให้ revoke ทุก session ของ user นั้นอัตโนมัติ (โค้ด force_logout มีอยู่แล้ว เรียกซ้ำได้เลย) — ทางเลือกเสริม: `Auth_verifyToken` เช็ก user.active (แลกกับการอ่านชีต Users เพิ่ม 1 ครั้ง/request — ใช้ CacheService cache รายชื่อ user ที่ inactive 5 นาทีแทน)

## 🟠 SEC-05 (กลาง): ไม่มีเพดานขนาด batch/payload — DoS ด้วย payload ยักษ์

- **จุด:** `Sales_syncBatch` รับ `payload.sales` ไม่จำกัดจำนวน, รายการ items ต่อบิลไม่จำกัด — plan2 ชั้นที่ 8 กำหนด "≤ 50 ต่อ batch" ไว้แล้วแต่ไม่ได้ implement; payload ใหญ่ทำให้ request เดียวกินเวลาเกิน quota 6 นาที + lock ค้าง ทั้งระบบหยุด
- **แผนแก้:** ใน `doPost` ตรวจ `e.postData.contents.length ≤ 200KB`; ใน `Sales_syncBatch` ตรวจ `sales.length ≤ 50` และ `items.length ≤ 100` ต่อบิล → reject `BATCH_TOO_LARGE`; ฝั่ง `syncEngine.flushOutbox` แบ่งส่งเป็นก้อนตามเพดานเดียวกัน

## 🟠 SEC-06 (กลาง): ไม่ validate enum ฝั่ง server (`sale_type`, `payment_method`, `expense_type` ฯลฯ)

- **จุด:** `Sales_processOne` เขียน `draft.sale_type` ลงชีตดิบๆ — ค่าแปลกปลอม (เช่น `"hacked"`) จะ: ถูกบันทึกในชีต Sales, หล่นหายเงียบๆ จาก DailySummary (patch key `rev_hacked` ไม่มีคอลัมน์), ทำให้ยอดรวม revenue_by_type ไม่เท่า gross_revenue แบบหาสาเหตุยาก; `paymentSummaryKey` เหมาค่าแปลกเป็น `pay_other` เงียบๆ
- **แผนแก้:** สร้าง validator กลางใน `Main.gs` — ตาราง enum ต่อ action (sale_type ∈ {normal,discount,freebie,staff}, payment_method ∈ 6 ค่า, expense_type ∈ 6 ค่า, warehouse, base_unit, target_type) → ค่านอกลิสต์ reject `BAD_ENUM` ตาม plan2 middleware ขั้นที่ 7

## 🟡 SEC-07 (กลาง-ต่ำ): Partial-write ใน `Sales_processOne` เสี่ยง "ตัดสต็อกซ้ำ" ตอน retry

- **จุด:** ลำดับเขียนคือ ตัดสต็อก + เขียน SaleItems **ก่อน** เขียนแถว Sales — ถ้า error กลางทาง (quota/timeout) จะมี SaleItems ค้าง + สต็อกถูกตัด แต่ไม่มีแถว Sales → `Sales_exists` ของ retry รอบถัดไปตอบ false → **ตัดสต็อกซ้ำรอบสอง**
- **แผนแก้:** ย้ายการจอง idempotency ขึ้นก่อนเขียน: `CacheService.put("sale:"+id)` ทันทีที่เริ่มประมวลผล (ก่อนตัดสต็อก) + เขียนแถว Sales เป็นรายการแรกด้วย status ชั่วคราว แล้วค่อยตัดสต็อก/เขียน items แล้ว update เป็น active — หรืออย่างน้อยให้ retry ที่เจอ SaleItems ของ id เดิมถือเป็น duplicate

## 🟡 SEC-08 (ต่ำ): `wastage.create` / `stock.extendExpiry` ไม่ validate ขอบเขต

- `qty` ของ wastage ไม่ตรวจ > 0 / integer (ค่าติดลบสร้างแถวขยะ), และ **ยืดอายุได้ไม่จำกัดครั้ง** — พนักงานกด "เก็บขายต่อ" ทุกเย็นได้เรื่อยๆ ของเน่าไม่เคยถูกบังคับทิ้ง
- **แผนแก้:** validate `qty` integer 1..10000; เพิ่มคอลัมน์ `extend_count` ใน FinishedStock — เกิน 2 ครั้ง → ต้องเป็น office/owner หรือ flag SUSPICIOUS

## 🟡 SEC-09 (ต่ำ): ErrorLog ไม่มีเพดาน 20 รายการ/เครื่อง/วัน ตาม GAP-21 — สแปมชีตได้; เพิ่มตัวนับใน CacheService key `err:<device>:<วัน>`

## 🟡 SEC-10 (ต่ำ): CSV export จากหน้า Audit เสี่ยง Excel formula injection — ค่าใน detail/user_id ที่ขึ้นต้น `=+-@` จะรันเป็นสูตรเมื่อเปิดใน Excel แม้ครอบ quote แล้ว → เติม `'` นำหน้าค่าที่ขึ้นต้นด้วยอักขระเสี่ยงตอน export (ใช้ logic เดียวกับ `sanitize` ฝั่ง GAS)

## 🟡 SEC-11 (ต่ำ/นโยบาย): ความเสี่ยงด้านข้อมูลตั้งต้นและไฟล์

- รหัสผ่าน seed (`owner1234`, `staff1234`, PIN `246810`) อยู่ทั้งใน `Bootstrap.gs` (จะถูก seed ขึ้นชีตจริง) และใน git — **ต้องบังคับเปลี่ยนทั้งหมดก่อน go-live** ใส่ใน checklist
- `.clasp.json` (scriptId) ถูก track ใน git — scriptId ไม่ใช่ secret โดยตรง แต่ถ้า repo เป็น public ควรย้ายเข้า `.gitignore`
- `.env.local` (GAS URL) ignore ถูกต้องแล้ว ✅; PEPPER อยู่ใน Script Properties ถูกต้องแล้ว ✅
- Token เก็บใน localStorage/IndexedDB — ยอมรับได้สำหรับ PWA ภายในร้าน แต่ห้ามฝัง third-party script ใดๆ ใน index.html ตลอดชีพโปรเจกต์ (ลด XSS-token-theft)

## ✅ สิ่งที่ตรวจแล้ว "ไม่พบช่องโหว่" (ยืนยันให้สบายใจ)

- SQL/Formula injection: `sanitize()` ครอบทุกการเขียนผ่าน `SheetDB_insert/update` ✅
- XSS: React escape โดย default, ไม่มี `dangerouslySetInnerHTML` ✅
- สิทธิ์ข้าม role: `ROLE_ACTIONS` ตรงกันสองฝั่ง, staff ถูก override branch ใน `doPost` ✅, snapshot กรองข้อมูลตาม role ถูกต้อง (staff ไม่เห็น users/rawLots/expenses, password ถูก mask) ✅
- Replay บิลซ้ำ: idempotency ทำงาน (ยกเว้นเคส partial-write ใน SEC-07) ✅
- Audit ขาล้มเหลวครบ: LOGIN_FAILED/FORBIDDEN_ATTEMPT/INVALID_TOKEN/PIN_FAILED/SALE_REJECTED ✅

---

# ส่วนที่ 4: บัคที่พบ (Bugs) + แผนแก้

## 🔴 BUG-01 (วิกฤติ — ทำลายข้อมูล): ปุ่ม "เปิด/ปิดใช้งาน" ในหน้าสินค้า ล้างราคาเป็น 0 และพังหน่วยวัตถุดิบ

- **จุด:** `App.tsx` ฟังก์ชัน `toggleActive` (บรรทัด ~1558) สร้าง payload จาก `emptyDraft(...)` ที่มีแต่ค่า default แล้วส่งเข้า `item.save`
- **กลไกพัง:** `buildItemPayload` แปลง `sell_baht:""` → `sell_price: 0` → ฝั่ง save (`localAdapter.saveMasterItem` และ `Items.gs:Items_save` เช็ก `!= null` ซึ่ง 0 ผ่าน) →
  1. **สินค้า PTG/PGH:** `sell_price`/`staff_price` ถูกตั้งเป็น 0 จริง + เขียน PriceHistory ขยะ 2 แถว + `category` ถูกรีเซ็ตเป็น `rice_box` + `shelf_life_days` กลายเป็น 1
  2. **วัตถุดิบ RM/PK:** `warehouse` ถูกรีเซ็ตเป็น `raw_fresh`, `base_unit` เป็น `g`, **`display_factor` เป็น 1000** — ของที่นับเป็น "ชิ้น" (ขวด/กล่อง) จะแสดงผล/แปลงหน่วยผิด 1000 เท่าทันที กระทบสูตรอาหารและการซื้อเข้าคลังทั้งหมด
- **ผลกระทบ:** กดปุ่มเดียว → POS ขายราคา 0 บาท / คลังเพี้ยนพันเท่า — และเกิดได้ทั้งโหมด local และ gas (เขียนทับชีตจริง)
- **แผนแก้:**
  1. `toggleActive` ส่ง payload แบบ partial: `{ type, id, name_th, name_my, active }` เท่านั้น
  2. ฝั่ง save สองฝั่ง: field ใดไม่ถูกส่ง (undefined) ห้ามแตะของเดิม — เปลี่ยนเงื่อนไขจาก `!= null` ที่ frontend bypass ด้วย 0 เป็น "มี key จริงใน payload" + ห้ามรับ `sell_price: 0` โดยไม่ตั้งใจ (ถ้าต้องการตั้ง 0 จริงให้ UI ยืนยัน)
  3. เพิ่ม regression test: toggle แล้วราคา/หน่วยต้องไม่เปลี่ยน

## 🔴 BUG-02 (สูง — เฉพาะโหมด gas ที่ใช้อยู่จริง): หน้า Audit แสดง "Hash chain ขาด" ปลอมตลอดเวลา

- **จุด:** `Snapshot.gs` ส่ง `auditLog` เฉพาะ 250 แถวท้าย แต่ `verifyChain()` ใน App.tsx เริ่มตรวจจาก `prev = "GENESIS"` → แถวแรกของ slice ไม่มีทาง prev_hash = GENESIS → owner เห็น "✗ ขาดที่ ..." ทุกวัน → เกิด alert fatigue สัญญาณจริง (มีคนแก้ชีต) จะถูกมองข้าม
- **แผนแก้:** ให้ `verifyChain` ใช้ `prev_hash` ของแถวแรกใน slice เป็นจุดตั้งต้นแทน GENESIS (ตรวจความต่อเนื่องภายใน slice) และแสดงข้อความ "ตรวจ 250 รายการล่าสุด — โซ่ทั้งเส้นตรวจโดย trigger กลางคืน" เพื่อสื่อขอบเขตจริง

## 🟠 BUG-03 (กลาง — เสี่ยงปิดบัญชีผิด): ช่อง "คีย์ยอดจริง" ในหน้า Reconcile ไม่รีเฟรชเมื่อเปลี่ยนสาขา/วันที่

- **จุด:** `ReconcilePage` ใช้ `defaultValue={satangToBaht(system[method])}` (uncontrolled) — เปลี่ยน dropdown สาขาหรือวันที่แล้ว ยอดระบบในตารางเปลี่ยน แต่ค่าในช่องกรอกยังเป็นของสาขา/วันก่อนหน้า → office กดบันทึกโดยไม่ทันสังเกต = reconciliation ตัวเลขผิดทั้งแถว
- **แผนแก้:** ใส่ `key={branch + date}` ที่ FormPanel เพื่อบังคับ remount หรือเปลี่ยนเป็น controlled input

## 🟠 BUG-04 (กลาง): `event.currentTarget.reset()` หลัง `await` — ฟอร์มไม่เคลียร์ + unhandled rejection

- **จุด:** `GoodsReceivePage`, `RawPurchasePage`, `ExpensesPage` (2 ฟอร์ม) — React ตั้ง `currentTarget` เป็น null หลังจบ sync phase ของ event → `.reset()` หลัง `await callApi(...)` โยน TypeError เงียบๆ (ไม่เข้า ErrorBoundary เพราะอยู่ใน async) — ผู้ใช้เห็น toast สำเร็จแต่ฟอร์มค้างค่าเดิม เสี่ยงกดบันทึกซ้ำ
- **แผนแก้:** เก็บ `const formEl = event.currentTarget;` ไว้ก่อน `await` แล้วเรียก `formEl.reset()` — และเพิ่ม listener `unhandledrejection` ส่งเข้า `log.clientError` (ตอนนี้ hook ไว้แค่ `window.onerror`)

## 🟠 BUG-05 (กลาง): Owner ถูก hardcode สาขา BR-KASET ใน 3 หน้า

- `SaleHistoryPage` / `WastagePage` / `DayClosePage` ใช้ `session.branch_id === "ALL" ? "BR-KASET" : ...` — owner ดูบิล/ของเสีย/ปิดยอดของท่ารั้ว-บ้านโจ้ไม่ได้เลย (M9' แก้เฉพาะหน้า POS)
- **แผนแก้:** ยกตัวเลือกสาขาของ owner (แบบเดียวกับ POSPage) เป็น component กลาง `OwnerBranchPicker` แล้วใช้ทั้ง 4 หน้า

## 🟡 BUG-06 (ต่ำ-กลาง): `Production_run` (GAS) ตัดวัตถุดิบก่อนตรวจว่า product ของสูตรยังมีอยู่

- ถ้า recipe ชี้ product ที่ถูกปิด/ลบ → `product.shelf_life_days` โยน error **หลัง** ตัด raw lots ไปแล้ว → วัตถุดิบหายแต่ไม่มีล็อตสินค้าเกิด (partial write) — ย้ายการ resolve product ขึ้นไปก่อนเริ่มตัด + `Production_preview` ตรวจ recipe มีจริง+active (ปิด 3.10 ของ approve2 ในงานเดียวกัน)

## 🟡 BUG-07 (ต่ำ-กลาง / performance): โหมด gas เรียก `app.snapshot` (อ่านทุกชีตทั้งใบ ~24 ชีต) ทุก 15 วินาทีต่อเครื่อง

- `App.tsx` ตั้ง `setInterval(sync, 15_000)` → `flushOutbox` + `loadAppData` → snapshot เต็ม — 3 สาขา × 2 เครื่อง = อ่านชีตทั้งไฟล์ ~2,880 ครั้ง/วัน ข้อมูลปีแรก (~220k แถว Sales) จะทำให้ snapshot ช้าหลายสิบวินาทีและกิน quota — ขัดเจตนา GAP-06
- **แผนแก้ (เรียงตามผลตอบแทน):**
  1. แยก "sync outbox" (ทุก 15 วิ — เบา) ออกจาก "refresh snapshot" (ทุก 3-5 นาที หรือเมื่อ `catalog_version` เปลี่ยน หรือหลัง action ของผู้ใช้เอง)
  2. ให้ `App_snapshot` กรอง `Sales`/`SaleItems`/`StockMovements`/`Wastage` เฉพาะช่วง 7-30 วันล่าสุด (หน้ารายงานช่วงยาวใช้ `report.summary` ที่อ่าน DailySummary อยู่แล้ว)
  3. เพิ่ม Archive รายปีตาม GAP-06 ข้อ 4 (ยังไม่ทำ)

## 🟡 BUG-08 (ต่ำ): rebuild กลางคืนทำ `void_count` ของเมื่อวานหายเป็น 0 — เพราะ rebuild นับเฉพาะบิล active; ให้บวก void_count จากบิล status=voided ของวันนั้นด้วย

## 🟡 BUG-09 (ต่ำ): `SaleHistoryPage` โหลดรายการ outbox ครั้งเดียวตอน mount (`useEffect [] `) — กด sync แล้วรายการ "บิลที่อยู่ในเครื่อง" ไม่อัปเดตจนกว่าจะเปลี่ยนหน้า; ผูกกับ `outboxCount` หรือ refresh หลัง void/sync

## 🟡 BUG-10 (ต่ำ): ต้นทุนสูตร "รายสาขา" ไม่กรองสาขาจริง — `weightedAvgRawCost`/`recipeUnitCost` ใน localAdapter รวม lots ทุกสาขา ทั้งที่ UI มี dropdown สาขา (RecipeManager/ItemCatalog) → ตัวเลขชวนเข้าใจผิด; เพิ่ม filter `lot.branch_id === branch_id`

## 🟡 BUG-11 (ต่ำ — โหมด demo): วันที่ seed คำนวณตอน import module + ใช้ UTC (`new Date().toISOString()`) ไม่ใช่เวลาไทย — เปิดแอปข้ามเที่ยงคืน/ช่วง 00:00-07:00 วันที่จะเพี้ยน 1 วัน (เฉพาะข้อมูลตัวอย่าง)

## 🟡 BUG-12 (ต่ำ): `RawPurchasePage` ตั้ง state `materialId` จาก `activeMaterials[0]` ณ render แรก — ถ้ารายการวัตถุดิบมาทีหลัง (โหลดผ่าน API) ค่า select จะเป็น "" ชั่วขณะและส่งฟอร์มได้ทั้งที่ยังไม่เลือกจริง; ใส่ guard `if (!material) return` ใน submit

---

# ส่วนที่ 5: แผนงานความต้องการใหม่ 5 เรื่อง (สเปกพร้อมส่งต่อให้ Codex)

## 5.1 📱 Responsive ทุก device (โทรศัพท์ / iPad / จอคอมทุกขนาด)

**สถานะปัจจุบัน:** มี viewport meta ✅, มี breakpoint เดียวที่ 980px ซึ่งแค่ยุบ sidebar ลงมาเป็นบล็อกบนสุด (กินพื้นที่ ~กว่าครึ่งจอมือถือก่อนถึงเนื้อหา), ตารางทุกตัว `min-width: 680px` ต้อง scroll แนวนอน, ฟอร์มกว้างเต็มจอบน desktop ใหญ่ (ดูภาพ "ซื้อวัตถุดิบ" ที่ช่องยาวผิดปกติ), Numpad ใช้ได้ดีบนจอสัมผัสแล้ว ✅

**เป้าหมาย 3 ช่วงจอ:**

| ช่วง | อุปกรณ์ | Layout หลัก |
|---|---|---|
| ≤ 640px | โทรศัพท์ | ไม่มี sidebar — ใช้ **bottom tab bar** (เมนูหลัก 4-5 อัน ตาม role) + เมนู "เพิ่มเติม" แบบ sheet; POS = product grid 2 คอลัมน์ + **แถบตะกร้าลอยล่างจอ** (ยอดรวม + ปุ่มจบการขาย) แตะแล้วขยายเป็น bottom sheet เต็มตะกร้า; ตารางทุกตัวเปลี่ยนเป็น card list (ไม่ scroll แนวนอน) |
| 641–1024px | iPad/แท็บเล็ตร้าน (จอหลักของ staff) | sidebar ย่อเหลือไอคอน 64px (แตะค้างเห็น label); POS = grid 3 คอลัมน์ + cart panel ขวา 320px; ปุ่ม staff ทุกปุ่ม ≥ 64px ตาม Design System plan2 3.1 (ตอนนี้ nav 44px, payment 46px — ต่ำกว่าสเปก) |
| > 1024px | Desktop office/owner | เหมือนปัจจุบัน + **จำกัดความกว้างฟอร์ม** `max-width: 640px` และจัด 2 คอลัมน์เมื่อช่องเยอะ (แก้ปัญหาช่องยาวผิดปกติในภาพ) |

**งานเชิงเทคนิค (ไฟล์: `styles.css`, `App.tsx`):**
1. กำหนด design tokens ที่ `:root` (เลิกใช้ `var(--border)` ที่ไม่เคยประกาศ — ตอนนี้พึ่ง fallback)
2. เพิ่ม breakpoints: `@media (max-width: 640px)`, `(641px–1024px)`, ใช้ `clamp()` กับ font หัวข้อ/ตัวเลขเงิน
3. สร้าง `BottomNav` component (มือถือ) — แสดงตาม role เดียวกับ `nav` array เดิม; sidebar แสดงเฉพาะ ≥ 641px
4. `SimpleTable` เพิ่ม prop `cardOnMobile` — render เป็น `<dl>` card ต่อแถวบนจอแคบ (ใช้ headers เดิมเป็น label)
5. POS: `.pos-layout` มือถือ = คอลัมน์เดียว + `position: fixed` cart bar; ตรวจ `env(safe-area-inset-bottom)` สำหรับ iPhone
6. ทดสอบจริงตามชุด H-Device ของ plan2 (โดยเฉพาะ iOS Safari + IndexedDB eviction)

## 5.2 📐 จุดที่กล่อง/ช่องขนาดไม่เท่ากัน (ตรวจพบ 9 จุด) + วิธีแก้

| # | จุด | อาการ | วิธีแก้ (styles.css) |
|---|---|---|---|
| 1 | ฟอร์ม office ทุกหน้า (`.form-grid`) vs ตัวเลือกสาขาใน POS (`.inline-control` max 360px) | ช่องในฟอร์มกว้างเต็มจอ (เห็นชัดในภาพ "ซื้อวัตถุดิบ" — ช่องยาว ~2,000px) ขณะหน้าอื่นแคบ | `.form-grid { max-width: 640px }` + จอ ≥1024px จัด `grid-template-columns: repeat(2, 1fr)` (ช่องเต็มแถวใช้ `grid-column: 1/-1`) |
| 2 | `.sale-type-grid` ใช้ `auto-fit, minmax(150px,1fr)` | จอความกว้างกลางๆ ปุ่ม 5 อันแตกเป็นแถว 4+1 / 3+2 ขนาดไม่เท่ากัน | desktop: `repeat(5, 1fr)`; ≤1024px: `repeat(3,1fr)`; ≤640px: `repeat(2,1fr)` (ปุ่มที่ 5 `grid-column: span 2`) |
| 3 | `.metric-grid` `auto-fit, minmax(180px,1fr)` | การ์ดตัวเลข 6 ใบบน Dashboard แตกแถว 4+2 — ใบแถวล่างกว้างกว่าแถวบน | ใช้ `repeat(3, 1fr)` (desktop) / `repeat(2,1fr)` (มือถือ) — จำนวนคอลัมน์คงที่ทุกแถวเท่ากันเสมอ |
| 4 | `.product-card` | สูงไม่เท่ากันเมื่อชื่อสินค้ายาวต่างกัน / โหมดตัดของเสียมีบรรทัดเพิ่ม | กำหนดโครงในการ์ด: ชื่อ `display:-webkit-box; -webkit-line-clamp:2; min-height:2.6em` + ดันราคา/สต็อกชิดล่างด้วย `margin-top:auto` |
| 5 | `.segmented` (แท็บคลัง 4 แท็บ, แท็บสินค้า) | ปุ่มกว้างตามความยาวข้อความ — "1. ข้าวกล่องบริษัทแม่" กว้างกว่า "4. ของแห้ง+บรรจุภัณฑ์" ไม่เท่ากัน + ล้นจอแคบ | `.segmented { display:flex; width:100% } .segmented button { flex:1 }` + จอแคบให้ scroll-x หรือขึ้น 2 แถว |
| 6 | `NumpadInput` trigger vs `input` ปกติ | สูง/ฟอนต์/พื้นหลังคนละแบบ (padding 14px, 1.25rem, พื้นเทา, ชิดขวา) อยู่ฟอร์มเดียวกับ input ปกติ (44px) ดูเป็นคนละระบบ | ตั้ง `min-height: 44px` เท่ากัน, ใช้ border/radius token เดียวกัน — คงตัวเลขชิดขวาไว้ (ดีอยู่แล้วสำหรับเงิน) |
| 7 | `.payment-grid` ปุ่ม 46px vs Design System staff ≥ 64px | ปุ่มช่องทางจ่าย (ปุ่มที่ staff กดบ่อยสุด) เล็กกว่าสเปก plan2 3.1 | `min-height: 64px` ในบริบท POS |
| 8 | `.cart-panel` fixed 360px | บน iPad แนวตั้ง (768px) เหลือพื้นที่ product grid แค่ ~390px = การ์ดบีบ 2 คอลัมน์เบียด | breakpoint 1024px: cart 300px; ≤640px: ใช้ bottom sheet ตามข้อ 5.1 |
| 9 | `.badge`/`.recipe-detail` ใช้ `var(--*)` ที่ไม่ได้ประกาศ + radius ปนกัน (8/10/12/16px) | สไตล์ legacy สองชุดปนกัน — กล่องมุมโค้งไม่เท่ากันทั้งแอป | ประกาศ token `--radius-sm/md/lg`, `--border` ที่ `:root` แล้วไล่แทนที่ค่า hardcode ทั้งไฟล์ |

## 5.3 🖼️ รูปภาพสินค้าใน Master + บันทึกบน Google Sheets

**สถานะปัจจุบัน:** `Products.image_url` มีอยู่ในชีต/Type/ProductVisual แล้ว ✅ แต่ `item.save` ทั้งสองฝั่ง hardcode `image_url: ""` และไม่มี UI อัปโหลด — ที่ใช้ได้ตอนนี้คือไฟล์ static ใน `public/products/<item_code>.svg` ซึ่งต้อง rebuild app ทุกครั้งที่เพิ่มรูป (ขัดกับความต้องการ "เพิ่มจากหน้าจอได้เลย")

**ข้อจำกัดที่ต้องรู้ก่อนเลือกแนวทาง:** เซลล์ Google Sheets เก็บได้สูงสุด 50,000 ตัวอักษร → รูป WebP 60KB เป็น base64 ≈ 80,000 ตัวอักษร **เกินลิมิต** ดังนั้นมี 2 ทางจริง:

| แนวทาง | ข้อดี | ข้อเสีย |
|---|---|---|
| **(แนะนำ) A: บีบรูปแรงขึ้นให้ ≤ 30KB → เก็บ base64 ใน column ใหม่ `image_data` ของชีต Products** | ตรงโจทย์ "เก็บบน Google Sheet" 100%, offline เห็นรูปทันทีจาก snapshot cache, ไม่พึ่ง Drive/rate limit (ตรงใจ GAP-20), ไม่มีระบบสิทธิ์เพิ่ม | รูปคมชัดน้อยลง (300×300 q≈0.7 เพียงพอสำหรับการ์ด POS), ชีต Products หนักขึ้น (~30KB/สินค้า — 100 สินค้า = 3MB ยังห่างลิมิต 10M เซลล์มาก แต่ต้องแยกออกจาก `app.snapshot` เป็น endpoint `product.images` โหลดครั้งแรก/เมื่อ catalog_version เปลี่ยน เพื่อไม่ให้ polling หนัก) |
| B: อัปโหลดเข้า Google Drive ผ่าน GAS (`DriveApp.createFile`) เก็บเฉพาะ URL ในชีต | รูปใหญ่/คมได้, ชีตเบา | GAP-20 เตือนเอง: Drive โดน rate limit + offline ไม่เห็นรูปจนกว่าจะ cache, ต้องเปิดสิทธิ์ไฟล์ anyone-with-link (รูปหลุดสาธารณะได้), ซับซ้อนกว่า |

**งานที่ต้องทำ (แนวทาง A):**
1. **Frontend (`ItemsPage`):** เพิ่ม `<input type="file" accept="image/*">` ใน ItemDraft ของ PTG/PGH → วาดลง `<canvas>` ครอปจัตุรัส 300×300 → `toDataURL("image/webp", 0.72)` → ถ้า > 30KB ลด quality ซ้ำจนผ่าน → แสดง preview ก่อนบันทึก
2. **Payload:** `item.save` เพิ่ม field `image_data` (data URL) — validate ฝั่ง server: prefix `data:image/webp;base64,` + ความยาว ≤ 45,000 ตัวอักษร
3. **Backend:** เพิ่มคอลัมน์ `image_data` ใน SHEETS.Products + `Bootstrap.gs` + `Items_save` รับ/อัปเดต (partial — ไม่ส่ง = ไม่แตะ ตามบทเรียน BUG-01) + bump `catalog_version`
4. **แสดงผล:** `ProductVisual` ใช้ `image_data` ก่อน → fallback `image_url` (รูป static เดิม) → fallback ตัวอักษรย่อ
5. **Performance:** ตัด `image_data` ออกจาก `app.snapshot`/`product.list` ปกติ — เพิ่ม action `product.images` (คืน `{id, image_data}`) เรียกเมื่อ catalog_version เปลี่ยน แล้ว cache ลง Dexie `products`
6. **docs:** อัปเดต SCHEMA.md / API_CONTRACT.md

## 5.4 📊 หน้าวิเคราะห์รายได้ — สัดส่วน 5 ประเภท (ขายปกติ / ลดราคา / สินค้าแถม / ขายพนักงาน / ของเสีย)

**สถานะปัจจุบัน:** `RevenuePage` แสดง pie แค่ 2 ก้อน (ลูกค้าทั่วไป = normal+discount+freebie รวมกัน vs พนักงาน) ตาม plan.md 7.2 เดิม — ข้อมูลที่ต้องใช้มีครบแล้วใน `summarize()` (`revenue_by_type` แยก 4 ประเภท + `wastage_value`)

**สเปกใหม่:**
1. เพิ่มตัวกรอง สาขา + ช่วงเวลา 5 แบบ (ใช้ `resolveDateRange` เดิมของ Dashboard — ตอนนี้ RevenuePage ไม่มีตัวกรองเลย)
2. กราฟ Pie 5 ชิ้น: ขายปกติ / ลดราคา / สินค้าแถม / ขายพนักงาน / **มูลค่าของเสีย** + ตารางสรุป (ยอดบาท, จำนวนบิล, % ของยอดรวม)
   - หมายเหตุเชิงบัญชีที่ต้องแสดงในหน้าจอ: 4 ตัวแรกเป็น "รายได้" แต่ของเสียเป็น "ต้นทุนที่สูญ" — ให้แสดงในกราฟเดียวกันได้ตามที่ต้องการ แต่ % ให้คิดจากฐาน (รายได้รวม + มูลค่าของเสีย) และระบายสีของเสียเป็นโทนแดงให้ต่างชัด เพื่อไม่ให้อ่านผิดว่าของเสียคือรายได้
3. คงกราฟเดิม "ลูกค้าจริง vs พนักงาน" ไว้เป็นกราฟที่สอง (plan.md 7.2 ยังต้องการมุมมองนี้อยู่)
4. แถมที่ควรมี: ตารางแยกรายสาขา (3 แถว × 5 ประเภท) เพื่อเทียบกันได้ในหน้าเดียว
- **ไฟล์ที่แตะ:** `App.tsx` (RevenuePage เท่านั้น — backend มีข้อมูลครบแล้ว ไม่ต้องแก้)

## 5.5 🍱 ปุ่มหมวดสินค้าในหน้าขาย + หมวดชัดเจนตั้งแต่ master

**สถานะปัจจุบัน:** `Product.category` มี enum `rice_box | drink | snack | breakfast` (แสดงเป็นอังกฤษดิบๆ ใน dropdown) — POS ไม่มีแท็บหมวดใดๆ แสดงสินค้าทั้งหมดกองเดียว

**สเปกใหม่ (ตามที่เจ้าของกำหนด):** หมวด = ข้าวกล่อง(G), ข้าวกล่อง(GH), ของว่าง, น้ำ, ของหวาน, ขนม, อื่นๆ

**ข้อสังเกตการออกแบบ (สำคัญ):** "ข้าวกล่อง(G)" กับ "ข้าวกล่อง(GH)" จริงๆ คือหมวดเดียว (ข้าวกล่อง) × แหล่งที่มา 2 แบบ ซึ่งระบบ**มีข้อมูลอยู่แล้ว**ใน `source_type` (parent=G จากบริษัทแม่ / self_produced=GH ผลิตเอง) — **ไม่ควรสร้าง category ซ้ำซ้อนกับ source_type** มิฉะนั้นจะเกิดข้อมูลขัดแย้งกันเอง (เช่น category=ข้าวกล่อง(G) แต่ source=self_produced) แผนคือ:

1. **ขยาย enum `ProductCategory`** เป็น: `rice_box` (ข้าวกล่อง), `savory` (ของว่าง), `drink` (น้ำ), `dessert` (ของหวาน), `snack` (ขนม), `other` (อื่นๆ) — ตัด `breakfast` เดิม โดย migration จับเข้า `rice_box` หรือ `savory`
2. **ปุ่มหมวดบน POS** เรียงตามที่เจ้าของสั่ง: `[ข้าวกล่อง(G)] [ข้าวกล่อง(GH)] [ของว่าง] [น้ำ] [ของหวาน] [ขนม] [อื่นๆ] [ทั้งหมด]` — สองปุ่มแรก filter ด้วย `category==="rice_box" && source_type==="parent"/"self_produced"`, ที่เหลือ filter ด้วย category ตรงๆ; ปุ่มแสดง badge จำนวนสินค้าในหมวด; จำสถานะหมวดที่เลือกไว้ข้ามการขาย (ไม่ reset ทุกบิล)
3. **หน้า master (`ItemsPage`):** dropdown หมวดแสดง **ภาษาไทย** (map enum→label ผ่าน i18n — เพิ่มคำพม่าด้วยเพราะ staff เห็นปุ่มเหล่านี้ทุกวัน) + ทำหมวดเป็น "บังคับเลือก" ตอนสร้างสินค้าใหม่ ห้าม default เงียบๆ
4. **Migration:** อัปเดตค่า category ของสินค้า seed + เพิ่มสคริปต์ `migrateCategories()` ใน Bootstrap.gs สำหรับชีตจริง (map breakfast→rice_box ฯลฯ)
5. **ตาราง/ตัวกรองอื่นที่ใช้ category:** ItemCatalog แสดง label ไทยแทน enum ดิบ
- **ไฟล์ที่แตะ:** `types.ts`, `App.tsx` (POSPage + ItemsPage), `i18n.ts`, `seed.ts`, `Bootstrap.gs`, `docs/SCHEMA.md` — โครงชีตไม่ต้องเปลี่ยน (คอลัมน์ category มีอยู่แล้ว)

---

# ส่วนที่ 6: ลำดับการลงมือ (Roadmap เรียงตามความเสี่ยง)

## เฟส 1 — หยุดเลือดก่อน (ทำทันที ก่อนใช้งานจริงทุกวัน)
1. **BUG-01** toggle ล้างราคา/หน่วย (วิกฤติ — ข้อมูล master พังได้ทุกเมื่อ) + regression test
2. **SEC-01** server ตรวจ total_amount + enum validation (SEC-06 ทำพร้อมกันได้ — จุดแก้เดียวกันใน Sales_processOne)
3. **BUG-02** chain ปลอมในหน้า Audit (โหมด gas ที่ใช้อยู่)
4. **BUG-03** Reconcile ช่องไม่รีเฟรช (เสี่ยงปิดบัญชีผิดทุกวัน)
**DoD:** ยิงเทส — toggle สินค้า 10 รอบราคาคงเดิม / ส่งบิล total ปลอมโดน reject + flag / เปลี่ยนสาขาใน Reconcile แล้วช่องอัปเดต

## เฟส 2 — ปิดช่องโหว่ที่เหลือ
5. SEC-02 PIN lockout, SEC-04 revoke session เมื่อปิด user, SEC-05 เพดาน batch, SEC-07 ลำดับ idempotency, SEC-08/09/10 validation ย่อย
6. BUG-04 (currentTarget), BUG-05 (owner เลือกสาขา 3 หน้า), BUG-06 (Production_run ตรวจ product ก่อนตัด)
**DoD:** เทสชุด A ของ plan2 (A1-A12) ผ่านครบ — โดยเฉพาะ A9, A10, A11

## เฟส 3 — ความต้องการใหม่ 5 ข้อ (ส่วนที่ 5)
7. หมวดสินค้า POS + master (5.5 — เล็กสุด ได้ผลเร็วสุด ทำก่อน)
8. Revenue 5 ประเภท (5.4 — แตะไฟล์เดียว)
9. รูปภาพสินค้า (5.3)
10. แก้กล่องไม่เท่ากัน 9 จุด (5.2) → ต่อด้วย Responsive เต็มรูป (5.1) — สองข้อนี้ทำติดกันเพราะแตะ styles.css ชุดเดียวกัน
**DoD:** ใช้งานครบ flow บนมือถือจริง + iPad จริง + จอ desktop, สร้างสินค้าใหม่พร้อมรูป+หมวดจากหน้าจอแล้วเห็นใน POS ภายใน catalog_version ถัดไป

## เฟส 4 — ความทนทานระยะยาว (จาก backlog เดิม + ที่พบใหม่)
11. BUG-07 ลดความถี่/ขนาด snapshot (ก่อนข้อมูลจริงโต) + Archive รายปี (GAP-06 ข้อ 4)
12. Playwright offline-chaos C1-C10 (C3' — ค้างจาก approve2 ยังเป็นความเสี่ยงอันดับต้นของระบบ offline-first)
13. Multi-flag audit (3.3), BUG-08/09/10/11/12, backup รายสัปดาห์ 12 สัปดาห์แยกชุด, CI (build+test ก่อน push), แยก staging/prod GAS
14. Go-live checklist เดิมของ plan2 8.3 + เพิ่ม: เปลี่ยนรหัส seed ทุกตัว + PIN, เปิด 2FA บัญชี Google owner

---

# ส่วนที่ 7: คำแนะนำเพิ่มเติมเพื่อความสมบูรณ์ (ไม่บังคับ แต่คุ้ม)

1. **แตกไฟล์ App.tsx (2,043 บรรทัด / 17 หน้าในไฟล์เดียว)** — แยกเป็น `pages/*.tsx` + `components/*.tsx` ก่อนเริ่มงาน responsive จะลดความเสี่ยง merge conflict และทำให้ AI agent แก้เฉพาะหน้าได้แม่นขึ้น (ตอนนี้ buildMasterItemsForUi ก็ซ้ำกับ localAdapter.buildMasterItems อยู่)
2. **i18n ยังครอบ ~35 คำ** — เนื้อหาหลักของหน้า office/owner เป็นไทย hardcode (ยอมรับได้เพราะ office อ่านไทยได้) แต่หน้าที่ staff ใช้ (Wastage/DayClose/SaleHistory) ควรครบพม่า 100% ก่อน UAT
3. **ขนาด bundle:** chunk pdf 1.2MB (Sarabun ฝัง base64) — ตอนนี้ precache โดย service worker ทุกเครื่องรวม staff ที่ไม่มีสิทธิ์ใช้ PDF → ย้าย `fonts/sarabun.ts` ไปโหลด lazy เมื่อกด Export ครั้งแรก (จริงๆ import เป็น dynamic แล้ว แต่ workbox precache ดูดเข้า cache ทุกเครื่องอยู่ดี — เพิ่ม `globIgnores` สำหรับ chunk pdf)
4. **เวลาเครื่องใน id:** `makeId()` ใช้ `Date.now()+random 4 ตัว` — โอกาสชนต่ำแต่ไม่เป็นศูนย์เมื่อหลายเครื่องสร้างพร้อมกันในวินาทีเดียวกัน; พิจารณาผูก device_id ต่อท้าย id ฝั่ง client (บิลเกิดที่ client เท่านั้น จุดอื่นเกิดใน lock ฝั่ง server อยู่แล้ว)
5. **Monitoring เชิงรุก:** Health Report มีแล้ว — เพิ่มบรรทัด "บิล flag SUSPICIOUS เมื่อวาน + มูลค่า" และ "จำนวน dead items ใน outbox ของแต่ละ device" (dead queue ตอนนี้เห็นได้จากหน้า SaleHistory ของเครื่องนั้นเท่านั้น — owner ไม่มีทางรู้ว่ามีบิลตายค้างที่สาขา)
6. **ซ้อม restore จริง 1 ครั้ง** ตาม plan2 8.3 — "backup ที่ไม่เคยซ้อมกู้ = ไม่มี backup"

---

---

# ส่วนที่ 8: งาน Go-Live ที่เลื่อนออกไปก่อน (ค่อยทำเมื่อพร้อม)

งานด้านล่างนี้ **ไม่ใช่โค้ด** และยังไม่จำเป็นในระยะทดสอบ — ทำเมื่อพร้อมจะเปิดใช้กับข้อมูลจริงจริงๆ

1. **เปลี่ยนรหัสผ่าน seed ทุกตัว + PIN** — รหัสทดสอบ (`owner1234`, `staff1234` ฯลฯ) ต้องเปลี่ยนเป็นรหัสแข็งแรงก่อน go-live ทำผ่านหน้า Admin ในระบบ
2. **เปิด 2FA บัญชี Google เจ้าของ** — บัญชีที่เก็บ Spreadsheet และ Apps Script ต้องเปิด การยืนยัน 2 ขั้นตอน ที่ myaccount.google.com → ความปลอดภัย
3. **ซ้อม restore จริงและกรอก `restore-drill.json`** — นำ backup มากู้คืนใน Spreadsheet ใหม่จริงๆ เพื่อยืนยันว่ากู้ได้ แล้วกรอกหลักฐานตาม `docs/restore-drill.example.json`
4. **รัน `npm run check:prod` แล้วกรอก `production-smoke.json`** — รายการตรวจสอบอัตโนมัติก่อน go-live ต้องผ่านทุกข้อ จากนั้นกรอกหลักฐานตาม `docs/production-smoke.example.json`
5. **สร้าง staging GAS project และใส่ script ID ใน `.clasp.staging.json`** — สร้างโปรเจกต์ Apps Script แยกสำหรับทดสอบที่ script.google.com แล้วนำ ID มาใส่ในไฟล์ `.clasp.staging.json`

---

*plan3.md จัดทำจากการอ่านโค้ดทุกไฟล์ + รัน build/test จริง — 2026-06-11 | ใช้คู่กับ plan2.md (สถาปัตยกรรม) และ approve2.md (สเปกงานรอบก่อน) | เฟส 1-2 ของส่วนที่ 6 ควรเสร็จก่อนเปิดใช้กับข้อมูลจริงทุกวัน*
