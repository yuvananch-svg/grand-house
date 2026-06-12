# 🛡️ Grand's House — plan2.md: Gap Analysis, Security Hardening & Complete Build-to-Test Master Plan

> **ตำแหน่งของเอกสารนี้ในชุดแผนงาน:**
> - [`plan.md`](plan.md) = ข้อกำหนดทางธุรกิจ (Business Requirements) — "ระบบต้องทำอะไรได้บ้าง"
> - [`Grand's.md`](Grand's.md) = พิมพ์เขียวทางเทคนิค (Technical Blueprint) — "เขียนโค้ดอะไร โครงสร้างไหน"
> - **`plan2.md` (ไฟล์นี้) = แผนปิดช่องโหว่ + ความปลอดภัย + การเชื่อม UI/UX↔Backend อย่างเป็นระบบ + แผนสร้างตั้งแต่ศูนย์จนจบ + แผนเทสหาบัคละเอียดที่สุด**
>
> **กฎการใช้ 3 ไฟล์:** เมื่อสั่งงาน AI Coding Agent ให้แนบทั้ง 3 ไฟล์เสมอ — ถ้าข้อความใดใน `Grand's.md` ขัดแย้งกับ `plan2.md` **ให้ยึด plan2.md เป็นหลัก** (เพราะเป็นฉบับแก้บัคแล้ว)

---

# ส่วนที่ 1: ผลการวิเคราะห์ช่องโหว่ (Gap Analysis — บัคที่ "จะเกิดแน่นอน" ถ้าสร้างตามแผนเดิม)

ผมไล่อ่าน `plan.md` + `Grand's.md` ทีละบรรทัดแบบ adversarial review (สมมติตัวเองเป็นคนเจาะระบบ/พนักงานที่อยากโกง/อินเทอร์เน็ตที่ล่มผิดจังหวะ) พบช่องโหว่ 22 จุด เรียงตามความรุนแรง:

## 🔴 ระดับวิกฤติ (ระบบพังหรือเงินหาย)

### GAP-01: CORS Preflight ทำให้ Frontend คุยกับ Google Apps Script ไม่ได้เลย
- **ปัญหา:** `Grand's.md` ข้อ 8 ให้ส่ง JSON ไป GAS — แต่ถ้า Frontend ส่ง `Content-Type: application/json` เบราว์เซอร์จะยิง OPTIONS preflight ก่อน ซึ่ง **GAS Web App ไม่ตอบ OPTIONS** → ทุก request ถูกเบราว์เซอร์บล็อก ระบบใช้ไม่ได้ตั้งแต่วันแรก
- **ทางแก้ (บังคับใช้):** ส่ง request ด้วย `Content-Type: text/plain;charset=utf-8` แล้วใส่ JSON string ใน body (เป็น "simple request" ไม่มี preflight) — GAS อ่านจาก `e.postData.contents` ได้ปกติ ฝั่งตอบกลับใช้ `ContentService.createTextOutput(JSON.stringify(res)).setMimeType(ContentService.MimeType.JSON)`
- **ผลพวงข้อ 2:** GAS ตอบ HTTP 200 เสมอ (คืน 401/403 จริงไม่ได้) → **error code ทั้งหมดต้องอยู่ใน body** `{ok:false, code:"AUTH_EXPIRED"|"FORBIDDEN"|...}` และ `client.ts` ต้องตัดสินจาก `body.ok` เท่านั้น ห้ามดู HTTP status

### GAP-02: ไม่มีระบบยกเลิกบิลที่กดผิด (Void Sale) — แผนเดิมตกหล่นทั้ง 2 ไฟล์
- **ปัญหา:** พนักงานต่างด้าวจิ้มผิดแน่นอน (ผิดสินค้า/ผิดจำนวน/ผิดช่องทางจ่าย) แต่ไม่มีทางแก้บิล → สต็อกถูกตัดผิด, ยอด Reconcile ไม่มีวันตรง, ออฟฟิศปวดหัวทุกวัน
- **ทางแก้:** เพิ่ม action `sale.void` พร้อมกติกา:
  - Staff ขอ void ได้เฉพาะบิลของตัวเอง **ภายใน 15 นาที** และบิลยังไม่ถูก reconcile — ต้องเลือกเหตุผล (จิ้มผิดสินค้า/ผิดจำนวน/ลูกค้ายกเลิก/อื่นๆ ใช้ปุ่มไอคอน ไม่ต้องพิมพ์)
  - Office/Owner void ได้ทุกบิลที่ยังไม่ reconcile
  - Backend คืนสต็อกกลับล็อตเดิมตาม `lot_breakdown` (qty_remaining += qty ทีละล็อต), ตั้ง `Sales.status='voided'` (ห้ามลบแถว), บันทึก AuditLog action=`SALE_VOID` พร้อมเหตุผล
  - ทุกรายงาน/Reconcile กรอง `status='active'` เท่านั้น แต่หน้า AuditLog เห็นบิล voided ทั้งหมด (จับพฤติกรรม void ถี่ผิดปกติได้)

### GAP-03: บิลขายที่ sync มาช้า "หลัง" ออฟฟิศกดปิดบัญชีวันนั้นไปแล้ว (Late-Arriving Sale)
- **ปัญหา:** แท็บเล็ตเน็ตหลุดทั้งคืน → ออฟฟิศ reconcile วันนั้นเสร็จ status='reconciled' → เช้าวันถัดมาแท็บเล็ต sync บิลเมื่อวานขึ้นมา → ยอดวันที่ปิดไปแล้วเปลี่ยน แต่ไม่มีใครรู้ → บัญชีเพี้ยนเงียบๆ
- **ทางแก้:** ใน `Sales.gs` ตอนรับบิล: ถ้า `business_date` ของบิล < วันนี้ และ Reconciliation ของวันนั้น status='reconciled' →
  1. รับบิลตามปกติ (ห้ามทิ้ง — เงินรับมาแล้วจริง) แต่ตั้ง `late_after_reconcile=TRUE`
  2. เปลี่ยน Reconciliation วันนั้นเป็น status='reopened' อัตโนมัติ
  3. ขึ้น badge สีแดงในหน้า Reconcile ของออฟฟิศ + แจ้งเตือนบน Dashboard ของ owner
  4. AuditLog flag=`LATE_SYNC`

### GAP-04: "วันที่ของบิล" ใช้เวลาเครื่อง client → นาฬิกาแท็บเล็ตเพี้ยน/ถูกแก้ = ปลอมประวัติได้
- **ปัญหา:** `Grand's.md` ใช้ `created_at` จากเครื่อง client เพียงค่าเดียว — แท็บเล็ตตั้งเวลาผิด (หรือพนักงานตั้งใจแก้นาฬิกาเครื่องเพื่อย้ายยอดข้ามวัน) จะทำให้รายงานรายวันและ reconcile เพี้ยนหมด
- **ทางแก้:** เก็บ **2 เวลาแยกกันเสมอ**: `client_created_at` (เวลากดจบขาย) + `server_received_at` (เวลาเซิร์ฟเวอร์ตอนรับ) และให้ Backend คำนวณ `business_date` เอง:
  - ถ้าบิลถูกส่งแบบ online สดๆ (`server_received_at - client_created_at` < 10 นาที) → business_date มาจากเวลาเซิร์ฟเวอร์ (เชื่อถือได้)
  - ถ้าเป็นบิล offline sync → ใช้ `client_created_at` แต่ **ถ้าเพี้ยนจากเวลาเซิร์ฟเวอร์เกิน 48 ชม. ให้ตั้ง flag=`CLOCK_DRIFT`** ให้ owner ตรวจ
  - Timezone ตั้งตายตัวที่โปรเจกต์ GAS: `Asia/Bangkok` (ใส่ใน appsscript.json — ถ้าลืมข้อนี้ รายงานจะคร่อมวันแบบงงๆ ทั้งระบบ)

### GAP-05: ทศนิยมของวัตถุดิบ (0.15 kg) จะเกิด Floating-Point Error สะสม
- **ปัญหา:** `Grand's.md` ให้เงินเป็นสตางค์ (integer) แล้ว ✅ แต่ปริมาณวัตถุดิบยังเป็นทศนิยม (0.15 kg) — การตัดสต็อก FIFO ลบทศนิยมซ้ำๆ จะเกิดเศษ 0.0000001 ค้าง ทำให้ `qty_remaining` ไม่เป็นศูนย์พอดี ล็อตปิดไม่ลง และเช็ก "วัตถุดิบพอไหม" ผิดพลาด
- **ทางแก้ (บังคับใช้ทั้งระบบ):** ปริมาณทุกชนิดเก็บเป็น **จำนวนเต็มของหน่วยฐาน (base unit)**:
  - น้ำหนัก → กรัม (g), ปริมาตร → มิลลิลิตร (ml), นับชิ้น → ชิ้น
  - `RawMaterials` เพิ่มคอลัมน์ `base_unit` (`g`/`ml`/`piece`) และ `display_unit` + `display_factor` (เช่น แสดง "กก." = ÷1000)
  - สูตรอาหาร `qty_per_unit` = integer หน่วยฐาน (หมู 0.15 kg → เก็บ `150` g)
  - UI แปลงเป็นหน่วยอ่านง่ายตอนแสดงผลเท่านั้น — **ในชีตและในการคำนวณห้ามมีทศนิยมของปริมาณและเงินเด็ดขาด**

### GAP-06: ความเร็ว — อ่านทั้งชีตทุก request จะช้าลงเรื่อยๆ จนระบบใช้ไม่ได้ใน 6-12 เดือน
- **ปัญหา:** ชีต `Sales` โต ~600 แถว/วัน (3 สาขา) = ~220,000 แถว/ปี — ถ้า `report.summary` แบบ "Inception-to-Date" ไล่อ่านทุกแถวทุกครั้ง จะใช้เวลาหลายสิบวินาทีและชน quota 6 นาทีในที่สุด การหา idempotency ด้วยการสแกนทั้งชีตก็ช้าแบบเดียวกัน
- **ทางแก้ 4 ชั้น:**
  1. **ชีตสรุปรายวัน `DailySummary`** (ชีตใหม่ #19): trigger กลางคืน + อัปเดต incremental ตอนมีบิลใหม่ — เก็บ ยอดขาย/COGS/ของเสีย แยก สาขา×วัน×ประเภทขาย×ช่องทางจ่าย → Dashboard ช่วงยาวอ่านจากชีตนี้ (หลักร้อยแถว) ส่วน "วันนี้" เท่านั้นที่อ่านจาก `Sales` สด
  2. **Idempotency เร็ว:** เช็กบิลซ้ำด้วย `TextFinder` เฉพาะคอลัมน์ id + แคช id ล่าสุด 1,000 ตัวใน `CacheService` (TTL 6 ชม.) — ไม่สแกนทั้งชีต
  3. **อ่านครั้งเดียวต่อ request:** `SheetDB.gs` ต้อง `getDataRange().getValues()` ครั้งเดียวแล้วทำงานใน memory ห้าม `getValue()` ทีละเซลล์ในลูป (ช้ากว่ากัน 100 เท่า)
  4. **Archive รายปี:** ทุก 1 ม.ค. ย้ายแถวปีก่อนของ `Sales`/`SaleItems`/`AuditLog` ไปไฟล์ `GrandsHouse_Archive_<ปี>` — รายงานย้อนหลังข้ามปีใช้ `DailySummary` (ไม่ต้องเปิด archive) ตัวเลขจึงครบเสมอ

### GAP-07: สองแท็บเล็ตในสาขาเดียวกันขายพร้อมกัน → สต็อกหน้าจอเพี้ยนคนละทาง
- **ปัญหา:** `stockCache` ใน IndexedDB ตัดเฉพาะเครื่องตัวเอง — เครื่อง A ขายไป 5 กล่อง เครื่อง B ยังเห็นสต็อกเต็ม
- **ทางแก้ (ยอมรับ eventual consistency อย่างมีระบบ):**
  - สต็อกบนหน้า POS แสดงเป็น "คงเหลือโดยประมาณ" (ตัวเลขจาง) — แหล่งความจริงคือชีตเท่านั้น
  - ทุกครั้งที่ `sale.syncBatch` ตอบกลับ ให้แนบ snapshot สต็อกสาขาปัจจุบันมาด้วย → เครื่องอัปเดต `stockCache` ทันที (เครื่องที่ออนไลน์จะคลาดเคลื่อนไม่เกิน ~15 วินาที)
  - **ห้ามบล็อกการขายเมื่อ stockCache = 0** (ของจริงอาจมีอยู่หน้าร้าน) — ใช้กลไก `OVERSOLD` flag ฝั่ง backend ตาม `Grand's.md` 3.5 ข้อ 4 ตามเดิม

## 🟠 ระดับสูง (ช่องโหว่ความปลอดภัย/การโกง)

### GAP-08: URL ของ GAS เป็นสาธารณะ — ใครได้ URL ก็ยิง API ได้ไม่จำกัด
- **ปัญหา:** Web App ต้อง deploy แบบ "Anyone can access" (เพราะพนักงานไม่มีบัญชี Google) → คนนอกที่ได้ URL (หลุดจากเครื่องพนักงาน) สามารถ brute-force รหัสผ่าน หรือยิง request ถล่มได้
- **ทางแก้:** ดูส่วนที่ 4 (Security 10 ชั้น) — สรุปคือ: lockout หลังล็อกอินพลาด 5 ครั้ง, rate limit ต่อ token/อุปกรณ์, ทะเบียนอุปกรณ์ (Device Registry), token แบบ hash-at-rest, และ audit ทุกความพยายามที่ล้มเหลว

### GAP-09: Token เก็บแบบ plain text ในชีต Sessions — ถ้าไฟล์ชีตหลุด token ใช้ได้ทันที
- **ทางแก้:** ชีต `Sessions` เก็บ **SHA-256(token)** ไม่เก็บ token ดิบ — ตอน verify ให้ hash token ที่ client ส่งมาแล้วค่อยเทียบ (แบบเดียวกับรหัสผ่าน) → ต่อให้เห็นชีตทั้งไฟล์ก็ปลอม session ไม่ได้

### GAP-10: รหัสผ่าน hash รอบเดียว (SHA-256+salt) — เร็วเกินไป brute-force ได้
- **ทางแก้:** ใช้ **iterated hashing 10,000 รอบ + salt (ต่อคน) + pepper (ความลับฝั่งเซิร์ฟเวอร์)**:
  - `hash = SHA256^10000(password + salt + PEPPER)` — PEPPER เก็บใน **Script Properties** (ไม่อยู่ในชีต, ไม่อยู่ในโค้ด, ไม่อยู่ใน git) → ต่อให้ขโมยชีต Users ไปทั้งไฟล์ก็ crack ไม่ได้เพราะไม่มี pepper
  - บังคับรหัสผ่าน ≥ 8 ตัว สำหรับ office/owner; staff ใช้รหัสที่ owner ตั้งให้

### GAP-11: รหัสอนุมัติปรับสต็อกใช้ "รหัสผ่าน owner" พิมพ์บนเครื่องพนักงาน — เสี่ยงโดนแอบจำ/keylog
- **ปัญหา:** `Grand's.md` 2.3 ให้ owner พิมพ์รหัสผ่านหลักของตัวเองบนคอมพิวเตอร์ออฟฟิศ — ถ้ารหัสหลุด คนนั้นได้สิทธิ์ owner ทั้งระบบ
- **ทางแก้:** เพิ่ม **Approval PIN 6 หลัก** แยกจากรหัสผ่าน (คอลัมน์ `approval_pin_hash` ใน Users เฉพาะ owner) — PIN ใช้ได้แค่อนุมัติรายการ ใช้ล็อกอินไม่ได้ → ต่อให้ PIN หลุดก็เข้าระบบไม่ได้ และ owner เปลี่ยน PIN ได้จากหน้าตั้งค่า

### GAP-12: Formula Injection — พนักงาน (หรือผู้ไม่หวังดี) ใส่ข้อความขึ้นต้นด้วย `=` ลงช่อง note → กลายเป็นสูตรรันในชีต
- **ปัญหา:** ค่าใดที่ขึ้นต้นด้วย `=`, `+`, `-`, `@` เมื่อเขียนลง Google Sheets จะถูกตีความเป็นสูตร — เปิดทางทั้งข้อมูลเพี้ยนและการดึงข้อมูลข้ามชีต (`=IMPORTRANGE(...)`)
- **ทางแก้:** `SheetDB.gs` มีฟังก์ชัน `sanitize(value)` บังคับผ่านทุกการเขียน: ถ้าเป็น string ที่ขึ้นต้นด้วยอักขระเสี่ยง ให้เติม `'` นำหน้า + จำกัดความยาวทุก field (note ≤ 500 ตัวอักษร) + ตรวจ enum ทุกค่าที่เป็นตัวเลือก (sale_type, payment_method ฯลฯ) ฝั่งเซิร์ฟเวอร์ — ค่าที่ไม่อยู่ในลิสต์ = reject

### GAP-13: AuditLog แก้ไขย้อนหลังได้โดยคนที่เข้าถึงไฟล์ชีต — "ตรวจสอบย้อนกลับ" จึงยังไม่แน่นจริง
- **ปัญหา:** AuditLog เป็นแค่ชีตธรรมดา ใครเปิดไฟล์ได้ (เช่น มือถือ owner หาย / รหัส Google หลุด) ลบแถวแก้แถวได้เนียนๆ
- **ทางแก้ (Tamper-Evident Hash Chain):** ทุกแถว AuditLog มีคอลัมน์ `row_hash = SHA256(prev_row_hash + timestamp + user_id + action + ref_id + detail)` — ต่อกันเป็นโซ่แบบ blockchain อย่างง่าย:
  - แก้/ลบแถวใดแถวหนึ่ง → hash ของแถวถัดไปทั้งหมดไม่ตรง → ตรวจจับได้ทันที
  - Trigger กลางคืนรัน `verifyAuditChain()` ไล่เช็กทั้งโซ่ → ถ้าโซ่ขาด ส่งอีเมลแจ้ง owner ทันที พร้อมระบุแถวที่ถูกแก้
  - สำรอง AuditLog รายวันไปไฟล์ archive แยก (เขียนทับไม่ได้จาก web app) — defense in depth

### GAP-14: แผนเดิมไม่ log "ความพยายามที่ล้มเหลว" — การเดารหัส/ลองยิง API ที่ถูกปฏิเสธหายไปจากประวัติ
- **ทางแก้:** `Main.gs` ต้อง audit ทั้งขาสำเร็จและขาล้มเหลว: `LOGIN_FAILED` (พร้อม user_id ที่ลอง — mask รหัสผ่านเสมอ), `FORBIDDEN_ATTEMPT` (role ไหนพยายามเรียก action อะไร), `INVALID_TOKEN`, `RATE_LIMITED`, `PIN_FAILED` — ทั้งหมด flag=`SUSPICIOUS` อัตโนมัติเมื่อเกิดถี่

## 🟡 ระดับกลาง (ตรรกะธุรกิจ/UX ที่จะกลายเป็นบัค)

### GAP-15: "เก็บขายต่อพรุ่งนี้" (ยืดอายุ) เป็น action ออนไลน์ — แต่ตอนเย็นคือเวลาที่เน็ตอาจล่มพอดี
- **ทางแก้:** `stock.extendExpiry` ต้องเข้า outbox แบบเดียวกับบิลขาย (`type:'extend_expiry'`) — offline ได้ 100% เหมือนกันทุก action ของ staff (กฎเหล็ก: **ทุก action ของ staff ต้อง offline ได้หมด ไม่มีข้อยกเว้น**)

### GAP-16: ราคาสินค้าแก้แล้วไม่มีประวัติ — ตรวจย้อนกลับไม่ได้ว่า "ตอนนั้นราคาป้ายเท่าไร"
- **ทางแก้:** เพิ่มชีต `PriceHistory` (#20): ทุกครั้งที่ owner แก้ `sell_price`/`staff_price` ให้ insert แถวใหม่ (product_id, ราคาเก่า, ราคาใหม่, ใคร, เมื่อไร) — ของเดิมห้ามแก้ทับเฉยๆ + AuditLog action=`PRICE_CHANGE`

### GAP-17: นิยาม "ราคาแพงสุด" ของบิลแถมยังกำกวม → AI แต่ละตัวจะเขียนไม่เหมือนกัน
- **นิยามตายตัว (ยึดตามนี้เท่านั้น):** ในโหมด `freebie` ตะกร้าแบ่ง 2 กลุ่มชัดเจน (ตัวซื้อ/ตัวแถม โดยพนักงานสลับกลุ่มได้ด้วยปุ่ม toggle บนการ์ดสินค้าในตะกร้า)
  - ตัวแถมทุกชิ้น: `unit_price = 0` ตายตัว
  - ตัวซื้อแต่ละชิ้น: ค่าตั้งต้น = `sell_price` ปกติของชิ้นนั้น **ยกเว้น** ระบบเสนอ "ยอดรวมบิล" ตั้งต้น = `max(sell_price ของตัวซื้อ) × จำนวนหน่วยรวมของตัวซื้อ` ตาม spec "ดึงราคาแพงสุดมาคิดเงิน" — แสดงเป็นช่องยอดรวมที่แก้ตัวเลขได้ 1 ช่อง (พนักงานเห็นเลขเดียว เข้าใจง่าย)
  - เมื่อพนักงานแก้ยอดรวม → ระบบเฉลี่ยถอยกลับ (pro-rate) ลง unit_price ของตัวซื้อแต่ละชิ้นตามสัดส่วน เพื่อให้ Σ(unit_price×qty) = ยอดรวมที่แก้เสมอ (กันยอดบิลกับยอดรายการไม่เท่ากัน)
  - ต้นทุน: ทุกชิ้นรวมตัวแถมตัด FIFO + คิด unit_cost จริง (ตามแผนเดิม) ✅

### GAP-18: เงินทอนติดลบ / รับเงินน้อยกว่ายอด — แผนเดิมไม่กันไว้
- **ทางแก้ (validation 2 ฝั่ง):** Frontend: ปุ่มจบการขาย disabled จนกว่า `cash_received ≥ total_amount` | Backend: reject `CASH` ที่ `cash_received < total_amount` ด้วย code `INVALID_CASH` — และทุกตัวเลขเงิน/จำนวนต้องเป็น integer > 0 (ตรวจฝั่งเซิร์ฟเวอร์ทุก field — อย่าเชื่อ client เด็ดขาด)

### GAP-19: ของเสียฝั่ง "วัตถุดิบ" (หมูเน่า ผักเหี่ยว) ไม่มีที่ลง — แผนเดิมมีแต่ของเสียสินค้าสำเร็จรูป
- **ทางแก้:** เพิ่ม action `rawWastage.create` (สิทธิ์ office) ใช้ `consumeFIFO` ตัด `RawLots` + บันทึกมูลค่าลงหมวด Wastage Value เดียวกัน (เพิ่มคอลัมน์ `wastage_type`: `finished`/`raw` ในชีต Wastage) — มูลค่าของเสียบน Dashboard จะครบทั้งสองชนิด

### GAP-20: รูปสินค้าโหลดจาก Google Drive ตรงๆ จะช้า/โดน rate limit และ offline ไม่เห็นรูป
- **ทางแก้:** รูปทั้งหมด: ย่อเป็น WebP สี่เหลี่ยมจัตุรัส ≤ 400×400px ≤ 60KB ตั้งแต่ตอนเตรียมข้อมูล → เก็บใน `frontend/public/products/<PRD-id>.webp` (รวมไปกับตัวแอป) → Service Worker precache อัตโนมัติ → **เปิดแอปครั้งแรกแบบ offline ก็เห็นรูปครบ** (เพิ่มสินค้าใหม่ = เพิ่มรูป + rebuild + deploy ซึ่งนานๆ ครั้ง ยอมรับได้; ระหว่างรอ rebuild ระบบแสดงการ์ดสีพื้น+ชื่อสินค้าแทน)

### GAP-21: ไม่มีระบบรายงาน Error จากหน้างาน — บัคบนแท็บเล็ตจะเงียบหาย ไม่มีใครรู้
- **ทางแก้:** เพิ่มชีต `ErrorLog` (#21) + action `log.clientError` (จำกัด 20 รายการ/เครื่อง/วัน กันสแปม): Frontend ครอบ global error handler (`window.onerror`, unhandledrejection, error boundary ของ React) ส่ง stack trace + device_id + เวอร์ชันแอป ขึ้นชีต → ตรวจทุกเช้าผ่าน Health Report (ส่วนที่ 8)

### GAP-22: ไม่มีแผน Backup / กู้คืน — ถ้าเผลอลบชีตหรือไฟล์เสีย ข้อมูลธุรกิจหายทั้งหมด
- **ทางแก้:** Trigger เวลา 02:00 ทุกคืน: `DriveApp.makeCopy()` ไฟล์ DB ทั้งไฟล์ไปโฟลเดอร์ `Backups/` ตั้งชื่อ `GrandsHouse_DB_backup_YYYY-MM-DD` เก็บย้อนหลัง 30 วัน (ลบอันเก่ากว่านั้นอัตโนมัติ) + ทุกวันอาทิตย์เก็บสำเนารายสัปดาห์แยกอีกชุด เก็บ 12 สัปดาห์ — มีเอกสารขั้นตอนกู้คืน (Restore Runbook) ในส่วนที่ 8.4

---

# ส่วนที่ 2: การแก้ไขสถาปัตยกรรมและ Schema (Δ เพิ่มเติมจาก Grand's.md)

## 2.1 ชีตที่เพิ่มใหม่ (จาก 18 → 23 ชีต)

### ชีต 19: `DailySummary` — สรุปรายวันสำหรับ Dashboard เร็ว (แก้ GAP-06)
| คอลัมน์ | คำอธิบาย |
|---|---|
| id | DSM-<branch>-<date> (unique ต่อสาขาต่อวัน) |
| branch_id, business_date | มิติหลัก |
| rev_normal, rev_discount, rev_freebie, rev_staff | ยอดขายแยกประเภท (สตางค์) |
| pay_qr1, pay_qr2, pay_grab, pay_cash, pay_thai, pay_other | ยอดแยกช่องทาง |
| cogs_total, wastage_value, bill_count, void_count | ต้นทุน/ของเสีย/จำนวนบิล/จำนวน void |
| last_rebuilt_at | เวลาคำนวณล่าสุด |
> อัปเดต 2 ทาง: (1) incremental ทุกครั้งที่บิลใหม่เข้า (2) rebuild ยกวันด้วย trigger กลางคืน (กันเพี้ยนสะสม) — ถ้าสองทางขัดกัน ยึด rebuild

### ชีต 20: `PriceHistory` — ประวัติราคา (แก้ GAP-16)
| คอลัมน์ | product_id, field (`sell_price`/`staff_price`), old_value, new_value, changed_by, changed_at |

### ชีต 21: `ErrorLog` — error จากหน้างาน (แก้ GAP-21)
| คอลัมน์ | id, device_id, user_id, app_version, message, stack (ตัดที่ 1,000 ตัวอักษร), url, created_at |

### ชีต 22: `Devices` — ทะเบียนอุปกรณ์ (แก้ GAP-08 + เพิ่ม traceability)
| คอลัมน์ | คำอธิบาย |
|---|---|
| device_id | UUID สร้างครั้งแรกที่เปิดแอป เก็บใน IndexedDB ส่งมากับทุก request |
| label | ตั้งชื่อโดย owner เช่น "แท็บเล็ตเกษตรใหม่ #1" |
| branch_id, first_seen, last_seen | ผูกสาขา + เวลาใช้งาน |
| status | `active` / `blocked` — **owner กดบล็อกอุปกรณ์ที่หาย/แปลกปลอมได้ทันที** → ทุก request จากเครื่องนั้นถูกปฏิเสธแม้ token ยังไม่หมดอายุ |

### ชีต 23: `Config` — ค่าตั้งระบบ (แทน hard-code)
| key | ตัวอย่างค่า | ใช้กับ |
|---|---|---|
| void_window_minutes | 15 | GAP-02 |
| day_cutoff_hour | 0 | business_date (ร้านปิดเที่ยงคืนพอดี ถ้าเปลี่ยนเวลาปิดร้านค่อยแก้) |
| suspicious_price_pct | 50 | กฎ flag ราคาต่ำผิดปกติ |
| suspicious_staffsale_per_day | 5 | กฎ flag ขายพนักงานถี่ |
| rate_limit_per_min | 60 | GAP-08 |
| login_lockout_attempts / lockout_minutes | 5 / 15 | GAP-08 |
| schema_version | 1 | ใช้ตอน migrate โครงสร้างในอนาคต |

## 2.2 คอลัมน์ที่เพิ่ม/แก้ในชีตเดิม (สรุป Δ)

| ชีต | เปลี่ยนแปลง | เหตุผล |
|---|---|---|
| `Sales` | เพิ่ม `status` (`active`/`voided`), `void_reason`, `voided_by`, `voided_at` | GAP-02 |
| `Sales` | เปลี่ยน `created_at` → `client_created_at` + `server_received_at` + `business_date` + `late_after_reconcile` + `device_id` | GAP-03, 04 |
| `Sessions` | `token` → `token_hash` (SHA-256) + เพิ่ม `device_id`, `revoked` | GAP-09 |
| `Users` | เพิ่ม `approval_pin_hash` (เฉพาะ owner), `failed_attempts`, `locked_until` | GAP-10, 11 |
| `Wastage` | เพิ่ม `wastage_type` (`finished`/`raw`), `material_id` (กรณี raw) | GAP-19 |
| `RawMaterials` | เพิ่ม `base_unit`, `display_unit`, `display_factor` — ปริมาณทุกที่เป็น integer หน่วยฐาน | GAP-05 |
| `AuditLog` | เพิ่ม `row_hash`, `prev_hash`, `device_id`, `success` (TRUE/FALSE) | GAP-13, 14 |
| `Reconciliations` | `status` เพิ่มค่า `reopened` | GAP-03 |

## 2.3 สถาปัตยกรรมความปลอดภัยฉบับแก้ไข (แทนแผนภาพเดิมข้อ 0 ของ Grand's.md)

```
[เบราว์เซอร์/PWA]
   │  ① HTTPS เท่านั้น (Firebase Hosting บังคับ)
   │  ② body = JSON string ส่งแบบ text/plain (เลี่ยง CORS preflight — GAP-01)
   │  ③ แนบ token + device_id ทุก request
   ▼
[GAS Web App — Main.gs Middleware Pipeline ทำงานเรียงลำดับนี้เสมอ]
   1. parse + ตรวจโครง request (มี action/payload ไหม)
   2. rate limit (CacheService ต่อ device_id: 60 req/นาที) ──✗→ ตอบ RATE_LIMITED + audit
   3. ตรวจ device_id ใน Devices (blocked?) ──✗→ DEVICE_BLOCKED + audit
   4. verify token: SHA256(token) เทียบ Sessions + ไม่หมดอายุ + ไม่ revoked ──✗→ AUTH_EXPIRED + audit
   5. ตรวจ role ↔ action ตามตาราง ROLE_ACTIONS ──✗→ FORBIDDEN + audit (flag SUSPICIOUS)
   6. บังคับ branch ของ staff ทับค่า client เสมอ
   7. validate payload รายฟิลด์ (ชนิด/ช่วง/enum/ความยาว) + sanitize formula injection (GAP-12)
   8. LockService ครอบเฉพาะส่วนเขียน → ทำงาน → เขียน AuditLog พร้อม hash chain
   9. ตอบ {ok, data | code} — HTTP 200 เสมอ (GAP-01)
   ▼
[Google Sheets — แชร์กับ "ไม่มีใครเลย" นอกจากบัญชี owner เพียงบัญชีเดียว]
   + Backup รายคืน / Audit chain verify รายคืน / DailySummary rebuild รายคืน
```

---

# ส่วนที่ 3: การเชื่อม UI/UX เข้ากับ Backend บน Google Sheets อย่างเป็นระบบ

หลักการ: **ทุกหน้าจอมี "สัญญาหน้าจอ (Screen Contract)"** — ระบุครบ 7 อย่าง: ① องค์ประกอบ UI ② state ที่ต้องมี ③ action ที่เรียก ④ ชีตที่ถูกแตะ ⑤ พฤติกรรม offline ⑥ สถานะพิเศษ (loading/error/empty) ⑦ สิ่งที่ลง AuditLog — AI ที่เขียนโค้ดต้องทำให้ครบทั้ง 7 ก่อนถือว่าหน้าจอนั้นเสร็จ

## 3.1 Design System กลาง (บังคับใช้ทุกหน้าจอ)

| หมวด | ข้อกำหนด |
|---|---|
| ปุ่มสำหรับ staff | สูง ≥ 64px, ตัวอักษร ≥ 20px, ห่างกัน ≥ 12px (นิ้วใหญ่จิ้มไม่พลาด) |
| ภาษา | ระบบ i18n 2 ภาษา: ไทย + พม่า (พนักงานต่างด้าว) — สลับด้วยปุ่มธงชาติมุมจอ, label หลักทุกตัวมีไอคอนกำกับเสมอ (ไม่พึ่งตัวหนังสืออย่างเดียว) |
| สี state | เขียว=สำเร็จ, แดง=ผิดพลาด/หมดอายุ, เหลือง=รอ sync/ใกล้หมดอายุ, เทา=กดไม่ได้ — ใช้ชุดเดียวทั้งแอป |
| ตัวเลขเงิน | แสดง format ไทย `1,234.50` เสมอ — แปลงจากสตางค์ที่ขอบ UI เท่านั้น (`utils/money.ts` เป็นที่เดียวที่แปลง) |
| Numpad | คอมโพเนนต์เดียวใช้ร่วมทุกที่ (แก้ราคา/รับเงินสด/จำนวน) — ปุ่มใหญ่ มีปุ่มลบ และแสดงค่า preview ตัวใหญ่ |
| การยืนยัน | ทุก action ที่ย้อนยากต้องมี dialog ยืนยัน 1 ชั้น (ภาพ+จำนวน+เงิน สรุปให้เห็นก่อนกด) — ห้ามมี dialog ซ้อนเกิน 1 ชั้น |
| Toast แจ้งผล | สำเร็จ = เด้งเขียว 2 วิ หายเอง / ผิดพลาด = ค้างจนกดปิด พร้อมข้อความภาษาคน (ห้ามโชว์ stack trace ให้พนักงานเห็น) |
| ตัวบอกสถานะเน็ต | ไอคอนมุมจอ 3 สถานะ: 🟢 ออนไลน์ / 🟡 มี X รายการรอส่ง / 🔴 ออฟไลน์ — กดดูรายการค้างส่งได้ |

## 3.2 กติกากลางของการเชื่อมข้อมูล (Data Binding Rules)

1. **อ่าน:** ทุกหน้าอ่านจาก cache ใน IndexedDB ก่อน (แสดงผลทันที ไม่มีจอขาว) แล้วยิง API เบื้องหลัง → ได้ของใหม่ค่อย re-render (รูปแบบ stale-while-revalidate)
2. **เขียน (ฝั่ง staff):** เขียนลง outbox เสมอ → UI ตอบ "สำเร็จ" ทันที → syncEngine ส่งตามหลัง (optimistic, ตาม Grand's.md 3.3)
3. **เขียน (ฝั่ง office/owner):** ต้อง online เท่านั้น (งานพวกนี้ทำที่ออฟฟิศซึ่งมีเน็ต) — ปุ่ม submit แสดง spinner จนกว่าจะได้ `ok:true` แล้วค่อยเคลียร์ฟอร์ม ถ้า error ให้คงค่าในฟอร์มไว้ทั้งหมด (ห้ามล้างให้พิมพ์ใหม่)
4. **ทุก response ที่ ok:false** → `client.ts` แปลง code เป็นข้อความ 2 ภาษาจากตาราง `errorMessages.ts` ที่เดียว
5. **เวอร์ชันข้อมูล master (Products/ราคา):** ตอบกลับทุก API จะแนบ `catalog_version` (เลข run ทุกครั้งที่ owner แก้สินค้า/ราคา) — ถ้า client เห็นเวอร์ชันใหม่กว่า cache ให้ดึง `product.list` ใหม่อัตโนมัติ → ราคาบนทุกเครื่องอัปเดตภายในไม่กี่นาทีโดยไม่ต้อง refresh

## 3.3 Screen Contracts — สัญญาหน้าจอครบทุกหน้า

### S1 — Login (`Login.tsx`) ทุก role
| ข้อ | สัญญา |
|---|---|
| UI | ช่อง User ID, Password, ปุ่มเข้าระบบใหญ่, ปุ่มสลับภาษา |
| Action → ชีต | `login` → อ่าน `Users`, เขียน `Sessions`, `Devices` (auto-register), `AuditLog` |
| Offline | ถ้ามี session เดิมใน IndexedDB ที่ยังไม่หมดอายุ → เข้าใช้ได้เลยโดยไม่ต้องต่อเน็ต (จำเป็นสำหรับเปิดร้านตอนเน็ตล่ม) |
| Error states | รหัสผิด ("รหัสไม่ถูกต้อง" — ห้ามบอกว่า user มีจริงไหม), โดน lockout (โชว์นับถอยหลัง), เครื่องถูกบล็อก |
| Audit | LOGIN / LOGIN_FAILED |

### S2 — เลือกประเภทขาย (`SaleTypeSelect.tsx`) staff
4 ปุ่มยักษ์เต็มจอพร้อมไอคอน+สี (ขายปกติ=เขียว, ลดราคา=ส้ม, แถม=ฟ้า, พนักงาน=ม่วง) | ไม่เรียก API (เลือกแล้วเก็บใน cartStore) | offline ได้สมบูรณ์ | Audit: ไม่ต้อง (ยังไม่เกิดรายการ)

### S3 — เลือกสินค้า (`ProductGrid.tsx`) staff
| ข้อ | สัญญา |
|---|---|
| UI | grid การ์ดรูปสินค้า 3-4 คอลัมน์ แยกแท็บตาม category, แตะ = +1 พร้อม badge จำนวน, แถบตะกร้าล่างจอแสดงยอดรวม real-time, สต็อก "ประมาณ" มุมการ์ด (GAP-07), โหมดแถม: ปุ่ม toggle ซื้อ/แถม บนการ์ดในตะกร้า (GAP-17) |
| Data | อ่าน `products` + `stockCache` จาก IndexedDB ล้วนๆ — **หน้านี้ไม่ยิง API เลย** (เร็วสุด, offline สมบูรณ์) |
| Empty | ไม่มีสินค้า → ภาพประกอบ + "ติดต่อออฟฟิศ" (เกิดเมื่อยังไม่เคย sync ครั้งแรก) |

### S4 — Checkout (`Checkout.tsx`) staff
| ข้อ | สัญญา |
|---|---|
| UI | สรุปรายการ (แก้จำนวน/ลบได้), ปุ่มช่องทางจ่าย 6 ปุ่มไอคอน, ถ้า CASH → Numpad รับเงิน + เงินทอนตัวเลขยักษ์เขียว, ปุ่ม "จบการขาย" ใหญ่สุดในจอ |
| Validation | ตะกร้าว่าง = ปุ่ม disabled, CASH ต้อง `รับเงิน ≥ ยอด` (GAP-18), โหมดแถมต้องมีตัวซื้อ ≥ 1 ชิ้น |
| Action → ชีต | เขียน outbox → syncEngine → `sale.syncBatch` → `Sales`, `SaleItems`, `FinishedStock` (ตัด FIFO), `DailySummary`, `AuditLog` |
| Offline | สมบูรณ์ 100% — หลังกดจบ โชว์เช็คเขียว + เลขบิล + สถานะ "รอส่ง 🟡/ส่งแล้ว 🟢" |
| Audit | SALE_CREATE (+PRICE_OVERRIDE ถ้าแก้ราคา) |

### S5 — บิลย้อนหลัง + Void (`SaleHistory.tsx` — หน้าใหม่ตาม GAP-02) staff
| ข้อ | สัญญา |
|---|---|
| UI | ลิสต์บิลวันนี้ของเครื่องนี้ (เวลา/ยอด/ช่องทาง/สถานะ sync), บิลที่อยู่ใน 15 นาทีมีปุ่ม "ยกเลิกบิล" แดง → เลือกเหตุผลด้วยไอคอน → ยืนยัน |
| Action → ชีต | `sale.void` → `Sales` (status), `FinishedStock` (คืนล็อต), `DailySummary`, `AuditLog` |
| Offline | ขอ void บิลที่ยังอยู่ใน outbox = ลบจาก outbox ได้เลย (ยังไม่เคยขึ้นคลาวด์) / บิลที่ sync แล้ว ต้อง online |
| Audit | SALE_VOID + เหตุผล |

### S6 — Wastage (`Wastage.tsx`) staff
ตาม Grand's.md ข้อ 4 + เพิ่ม: ทั้ง "ทิ้ง" และ "เก็บขายต่อ" เข้า outbox ได้ (GAP-15) | ชีต: `Wastage`, `FinishedStock`, `DailySummary`, `AuditLog` | ปุ่มยืนยันสรุป "ทิ้ง X ชิ้น มูลค่าจะถูกบันทึก" กันจิ้มพลาด

### S7 — ปิดยอดสิ้นวัน (`DayClose.tsx` — หน้าใหม่) staff
| ข้อ | สัญญา |
|---|---|
| UI | สรุปวันนี้ของสาขา: จำนวนบิล, ยอดแยกช่องทาง, **"เงินสดที่ควรมีในเก๊ะ = X บาท"** ตัวใหญ่, รายการรอ sync ค้าง (ต้องเป็น 0 ก่อนปิดร้าน — ถ้าค้างให้โชว์ปุ่ม "ลองส่งอีกครั้ง") |
| Data | คำนวณจาก IndexedDB ฝั่งเครื่อง + เทียบกับเซิร์ฟเวอร์เมื่อ online |
| ทำไมต้องมี | ปิด loop ของ plan.md 3.2 (ยอดเงินสดในเก๊ะ) ให้พนักงานเช็กเองก่อนส่งเงิน → ยอด reconcile ตรงตั้งแต่ต้นทาง |

### S8 — รับของจากบริษัทแม่ (`GoodsReceive.tsx`) office
ฟอร์มตาม Grand's.md 6.1 + ตาราง "รับเข้าล่าสุด 20 รายการ" ไว้ทวนสอบ | Validation: qty>0, cost>0, วันที่ไม่อยู่อนาคต | ชีต: `GoodsReceipts`, `FinishedStock`, `AuditLog` | Online เท่านั้น

### S9 — ซื้อวัตถุดิบเข้าล็อต (`RawPurchase.tsx`) office
ฟอร์ม: วัตถุดิบ (ค้นหา+รูป), จำนวน (แสดง display_unit แปลงเป็น base unit อัตโนมัติ — โชว์ "= 1,500 g" ใต้ช่องให้เห็น), ราคารวมล็อต → ระบบหาร unit_cost เอง | ชีต: `RawLots`, `AuditLog`

### S10 — คลัง 4 แท็บ (`Inventory.tsx`) office/owner
4 แท็บตาม Grand's.md 5.1 | แต่ละแถวเจาะลงเห็น "รายล็อต" (วันที่รับ, คงเหลือ, ต้นทุน/หน่วย, จะหมดอายุเมื่อไร) | แถบเตือนบนสุด: ล็อตใกล้หมดอายุ 3 วัน + วัตถุดิบต่ำกว่าขั้นต่ำ | อ่านอย่างเดียว (การแก้ = ไปหน้า StockAdjust เท่านั้น — single path, audit ครบ)

### S11 — ผลิตสินค้า (`Production.tsx`) office/owner
ตาม Grand's.md 5.3 (preview → run) + เพิ่มใน preview: **แสดงต้นทุนต่อชิ้นโดยประมาณก่อนกดผลิต** (เห็นเลยว่าล็อตนี้จะ lock ต้นทุนเท่าไร) | ชีต: `ProductionOrders`, `RawLots`, `FinishedStock`, `AuditLog`

### S12 — ปรับสต็อก (`StockAdjust.tsx`) office + PIN owner
เลือกล็อต → ใส่จำนวนจริงที่นับได้ → เหตุผล (บังคับ) → modal ใส่ **PIN 6 หลักของ owner** (GAP-11) | Backend ตรวจ PIN ฝั่งเซิร์ฟเวอร์ | ชีต: `StockAdjustments`, `RawLots`/`FinishedStock`, `AuditLog` (flag อัตโนมัติถ้าปรับถี่)

### S13 — Reconcile (`Reconcile.tsx`) office
ตาม Grand's.md 6.2 + เพิ่ม: แถวที่ `late_after_reconcile`/`reopened` ขึ้นแถบแดงบนสุดพร้อมปุ่ม "ตรวจใหม่" (GAP-03) + แสดงรายการบิล void ของวันนั้นแยกบรรทัด (ยอด void ไม่รวมในยอดระบบ แต่ต้องเห็นว่ามี) | ชีต: `Reconciliations`, `Sales`, `AuditLog`

### S14 — ค่าใช้จ่าย (`Expenses.tsx`) office — ตาม Grand's.md 6.3 | เพิ่มตารางรายการเดือนนี้ + ยอดรวมต่อหมวด real-time

### S15 — Dashboard (`Dashboard.tsx`) owner
ตาม Grand's.md 7.1 แต่ **อ่านจาก `DailySummary`** (GAP-06): ช่วง ≤ วันนี้ผสม `Sales` สดเฉพาะวันนี้ | การ์ดแจ้งเตือนบนสุด: reconcile ค้าง/mismatch/reopened, AuditLog flag SUSPICIOUS ใหม่, ErrorLog ใหม่ — owner เปิดแอปปุ๊บเห็นปัญหาก่อนเห็นกราฟ

### S16 — งบการเงิน + PDF (`FinancialReport.tsx`) owner — ตาม Grand's.md 7.3 + ทุกตัวเลขในงบกดเจาะลงดูที่มาได้ (drill-down ถึงระดับบิล/ล็อต — ส่วนที่ 5)

### S17 — Audit Log Viewer (`AuditLog.tsx`) owner
ตาม Grand's.md 7.4 + เพิ่ม: แถบสถานะโซ่ hash "✅ ตรวจสอบล่าสุดเมื่อคืน — ไม่พบการแก้ไข" (GAP-13), กรองตาม device, ปุ่ม export CSV ช่วงเวลาที่เลือก

### S18 — จัดการระบบ (`Admin.tsx`) owner
จัดการผู้ใช้ (เพิ่ม/ปิด/รีเซ็ตรหัส/ตั้ง PIN), จัดการอุปกรณ์ (ตั้งชื่อ/บล็อก — GAP-08), แก้ Config, จัดการสินค้า+ราคา (ลง PriceHistory อัตโนมัติ), จัดการสูตรอาหาร (RecipeManager)

---

# ส่วนที่ 4: แผนความปลอดภัย 10 ชั้น (Defense-in-Depth)

| ชั้น | มาตรการ | กัน/แก้อะไร | อ้างอิง |
|---|---|---|---|
| 1. Transport | HTTPS บังคับทุกเส้นทาง (Firebase Hosting + GAS เป็น HTTPS โดยธรรมชาติ), ไม่มี mixed content | ดักฟังข้อมูลกลางทาง | — |
| 2. การเข้าถึงไฟล์ DB | Spreadsheet แชร์กับ **0 คน** — GAS deploy "Execute as: Me" → web app เป็นทางเข้าเดียว, SPREADSHEET_ID เก็บใน Script Properties ไม่ฝังในโค้ด/ไม่ส่งให้ frontend | คนนอกเปิดไฟล์ตรง | GAP-08 |
| 3. รหัสผ่าน | Iterated SHA-256 ×10,000 + salt/คน + PEPPER ใน Script Properties, นโยบายความยาว, ห้าม log รหัสทุกกรณี | ขโมยชีตไป crack | GAP-10 |
| 4. Session | token สุ่ม (UUID×2), เก็บเฉพาะ hash, อายุ 30 วัน + ต่ออายุอัตโนมัติเมื่อใช้งาน, logout = revoke, owner force-logout รายคน/รายเครื่องได้ | token รั่วจากชีต/ใช้ token เก่า | GAP-09 |
| 5. อุปกรณ์ | Device Registry + บล็อกเครื่องหาย/แปลกปลอม + device_id ติดทุก audit | เครื่องหาย, เครื่องปลอม | GAP-08 |
| 6. Brute-force/Flood | login lockout 5 ครั้ง/15 นาที (ต่อ user และต่อ device), rate limit 60 req/นาที/เครื่อง ผ่าน CacheService | เดารหัส, ยิงถล่ม | GAP-08 |
| 7. Authorization | ตาราง ROLE_ACTIONS ฝั่งเซิร์ฟเวอร์เป็นแหล่งความจริงเดียว, staff ถูก override branch เสมอ, การอนุมัติพิเศษใช้ PIN แยก | สิทธิ์ข้ามระดับ/ข้ามสาขา/ยืมรหัส owner | GAP-11 |
| 8. Input | validate ชนิด+ช่วง+enum+ความยาวทุก field ฝั่งเซิร์ฟเวอร์, sanitize formula injection, จำนวนรายการต่อ batch ≤ 50 | ข้อมูลขยะ, formula injection, payload ยักษ์ | GAP-12, 18 |
| 9. Tamper-Evidence | AuditLog hash chain + verify รายคืน + log ทั้งสำเร็จ/ล้มเหลว + append-only | แก้ประวัติย้อนหลัง, การโกงเงียบ | GAP-13, 14 |
| 10. Recovery | Backup รายคืน 30 วัน + รายสัปดาห์ 12 สัปดาห์, Restore Runbook, ErrorLog + Health Report รายเช้า | ลบไฟล์/ข้อมูลพัง/บัคเงียบ | GAP-21, 22 |

**ข้อจำกัดที่ต้องบอกตรงๆ:** GAS ไม่ให้ IP address ของผู้เรียก → ระบุตัวตนระดับเครือข่ายไม่ได้ ชดเชยด้วย device_id + audit ละเอียด | และความปลอดภัยสูงสุดของระบบ = ความปลอดภัยของบัญชี Google เจ้าของ → **บังคับเปิด 2-Step Verification ของบัญชี Google owner เป็นเงื่อนไขก่อน go-live** (อยู่ใน checklist ส่วนที่ 6)

---

# ส่วนที่ 5: การตรวจสอบย้อนกลับ End-to-End (Traceability)

หลักการ: **เงินทุกบาทและของทุกชิ้นต้องเล่าเรื่องตัวเองได้** — ทดสอบด้วย 4 โจทย์นี้ ระบบต้องตอบได้ใน ≤ 5 คลิก:

| โจทย์ | เส้นทางข้อมูลที่ระบบต้องไล่ให้ดูได้ |
|---|---|
| T1: "บิลนี้กำไรเท่าไร มาจากของล็อตไหน" | `Sales` → `SaleItems.lot_breakdown` → `FinishedStock` ล็อต → (ถ้าผลิตเอง) `ProductionOrders.consumption_detail` → `RawLots` → วันที่ซื้อ+ราคาซื้อ |
| T2: "ตัวเลขกำไรเดือนนี้บน Dashboard มาจากไหน" | Dashboard → `DailySummary` รายวัน → กดวันใดวันหนึ่ง → รายบิลของวันนั้น → ลึกถึง T1 |
| T3: "ใครแตะข้อมูลนี้บ้าง" | ทุกเอกสารมี ref ใน `AuditLog` (กรองด้วย ref_id) → เห็นทุก action เรียงเวลา พร้อม device, ค่าเดิม→ใหม่, สำเร็จ/ล้มเหลว — โซ่ hash การันตีว่าไม่ถูกแก้ย้อนหลัง |
| T4: "เงินสดวันที่ X หายไป 200 บาท เกิดอะไรขึ้น" | `Reconciliations` วันนั้น (diff รายช่องทาง) → บิล CASH ทั้งหมดของวัน → บิล void/late_sync/OVERSOLD ของวัน → audit ของพนักงานกะนั้น |

กลไกที่ทำให้ทำได้: id มาตรฐานทุกตาราง + `lot_breakdown`/`consumption_detail` JSON + `source_ref` ใน FinishedStock + AuditLog hash chain + ห้าม UPDATE ทับข้อมูลเชิงประวัติ (ทุกการแก้ = แถวใหม่ + สถานะ ไม่ใช่ลบของเก่า: void ไม่ลบบิล, แก้สูตร = ปิดเก่าเปิดใหม่, แก้ราคา = PriceHistory)

---

# ส่วนที่ 6: ขั้นตอนสร้างตั้งแต่ศูนย์จนจบ (Build Runbook ทีละก้าว)

> ใช้คู่กับ Roadmap 6 เฟสใน `Grand's.md` ข้อ 9 — ส่วนนี้คือรายละเอียดระดับ "ทำอะไรก่อน-หลัง คลิกอะไร ตั้งค่าอะไร" และจุดที่เพิ่มจาก plan2

## เฟส 0 — เตรียมโครงสร้างพื้นฐาน (ก่อนเขียนโค้ดบรรทัดแรก)
1. บัญชี Google ของ owner: เปิด **2-Step Verification** (เงื่อนไขบังคับ)
2. สร้าง Spreadsheet 2 ไฟล์: `GrandsHouse_DB_STAGING` และ `GrandsHouse_DB_PROD` (แยกสนามซ้อมกับของจริงตั้งแต่วันแรก — ห้ามเทสบนของจริงเด็ดขาด)
3. สร้างโปรเจกต์ GAS 2 ตัว (staging/prod) ผูก clasp กับ git repo — Script Properties แต่ละตัว: `ENV`, `SPREADSHEET_ID`, `PEPPER` (สุ่ม 64 ตัวอักษร — ห้ามเหมือนกันสองสภาพแวดล้อม)
4. ตั้ง timezone `Asia/Bangkok` ใน `appsscript.json` ทั้งสองโปรเจกต์ (GAP-04)
5. เขียน `Bootstrap.gs`: ฟังก์ชัน `setupSheets()` สร้างชีตทั้ง 23 + header + ชีต Config ค่าตั้งต้น + ผู้ใช้ตัวอย่าง — รันซ้ำได้โดยไม่พังของเดิม (idempotent) → ใช้สร้างทั้ง staging และ prod ให้โครงตรงกัน 100%
6. Firebase Hosting 2 site (staging/prod) + repo frontend + CI ขั้นต่ำ (build ผ่าน + vitest ผ่าน ก่อน deploy ได้)

## เฟส 1 — Foundation: SheetDB + Security middleware + Auth + Login
ลำดับงาน: `SheetDB.gs` (อ่านครั้งเดียว/เขียน batch/sanitize/TextFinder) → middleware 9 ขั้นตามแผนภาพ 2.3 → `Auth.gs` (hash 10k รอบ, lockout, token hash, device registry) → หน้า Login + route guard
**Definition of Done เฟส 1:** เทสชุด A (ส่วนที่ 7) ผ่านครบ — รวมเทสความปลอดภัย A6-A12

## เฟส 2 — POS Core (ตาม Grand's.md + ส่วนเพิ่มของ plan2)
ลำดับ: productStore + catalog_version → cartStore (4 โหมด + กฎ freebie ฉบับ GAP-17 + validation GAP-18) → Checkout → Dexie outbox + syncEngine → `Sales.gs` (idempotent + FIFO + business_date ฉบับ GAP-04 + late-sync GAP-03 + DailySummary incremental) → **SaleHistory + Void (GAP-02)** → DayClose (S7)
**DoD:** เทสชุด B + C ผ่านครบ

## เฟส 3 — Inventory & Production Engine
ลำดับ: RawMaterials หน่วยฐาน integer (GAP-05) → RawPurchase → `consumeFIFO()` → Recipes/RecipeItems + RecipeManager → Production preview/run + cost locking → StockAdjust + PIN (GAP-11) → rawWastage (GAP-19)
**DoD:** เทสชุด D ผ่านครบ — โดยเฉพาะ D3 (560 บาท) และ D7 (ทศนิยม)

## เฟส 4 — Wastage + Office Hub
Wastage (รวม extendExpiry เข้า outbox — GAP-15) → GoodsReceive → Reconcile (รวม reopened flow) → Expenses
**DoD:** เทสชุด E ผ่านครบ

## เฟส 5 — Owner Suite + ระบบนิเวศกลางคืน
DailySummary rebuild trigger → Dashboard + RevenueAnalysis + FinancialReport + PDF → AuditLog viewer + hash chain + `verifyAuditChain()` trigger → Admin (S18) → Backup trigger + ErrorLog + Health Report email
**DoD:** เทสชุด F + G ผ่านครบ

## เฟส 6 — Hardening, UAT, Go-Live
1. รันเทสทุกชุด A-H บน staging จนผ่าน 100% (ส่วนที่ 7)
2. Performance: seed ข้อมูลจำลอง 6 เดือน (~110,000 แถว Sales) → วัดทุก API ตามเป้า H-Perf
3. UAT กับพนักงานจริง 2 วัน (สคริปต์ H-UAT) — ภาษาพม่า/ไทยจริง อุปกรณ์จริง เน็ตจริง
4. Go-Live Runbook: รัน `setupSheets()` บน PROD → คีย์ master data จริง (สินค้า/ราคา/สูตร/ผู้ใช้/สต็อกตั้งต้นด้วย StockAdjust ครั้งแรกพร้อม PIN) → deploy frontend prod → ติดตั้ง PWA ลงแท็บเล็ตทุกเครื่อง + ทดสอบ 1 บิลจริงต่อสาขา → เปิดใช้คู่ขนานกับวิธีจดมือเดิม 3 วัน → เทียบยอดตรงกัน 3 วันติด → ตัดเข้าระบบเต็มตัว
5. **Rollback plan:** ถ้าเจอปัญหาวิกฤติช่วงคู่ขนาน → กลับไปจดมือทันที (ข้อมูลในระบบเก็บไว้วิเคราะห์ ไม่ลบ) → แก้บัคบน staging → เริ่มคู่ขนานใหม่

---

# ส่วนที่ 7: แผนการทดสอบหาบัคอย่างละเอียดที่สุด (Test Master Plan)

## 7.0 โครงเครื่องมือและสภาพแวดล้อม
| ระดับ | เครื่องมือ | รันที่ไหน |
|---|---|---|
| Unit (frontend) | Vitest — `money.ts`, cartStore (ทุกโหมด), syncEngine (mock), การแปลงหน่วย | CI ทุก commit |
| Unit (backend) | ฟังก์ชันเทสใน `Tests.gs` รันกับชีต STAGING (สร้าง/ล้างข้อมูลเทสเอง) | ก่อนปิดทุกเฟส |
| Integration/E2E | Playwright ต่อ staging — รวมโหมด offline (`context.setOffline(true)`) | ก่อนปิดทุกเฟส |
| Security | สคริปต์ยิง API ตรง (ข้าม UI) ทดสอบสิทธิ์/injection/replay | เฟส 1 และก่อน go-live |
| Performance | seed script + จับเวลาจริง | เฟส 6 |
| UAT | สคริปต์กระดาษ + พนักงานจริง | เฟส 6 |

**กติกา:** ทุกเทสเขียนเป็น (Setup → Action → Expected) | บัคที่เจอ = ลงตาราง BUGS.md (อาการ/ขั้นตอนทำซ้ำ/ความรุนแรง/สถานะ) | เทสที่เคยเจอบัคต้องกลายเป็น regression test ถาวร | **Exit criteria ของทุกเฟส = เทสชุดของเฟสผ่าน 100% + ไม่มีบัค Critical/High ค้าง**

## ชุด A — Authentication & Security (12 เคส)
| # | เคส | Expected |
|---|---|---|
| A1 | ล็อกอินถูกต้องทั้ง 3 role | ได้ token, เห็นเมนูตรง role, Sessions เก็บ hash ไม่ใช่ token ดิบ |
| A2 | รหัสผิด 1-4 ครั้ง | LOGIN_FAILED ลง audit ทุกครั้ง, ยังลองต่อได้ |
| A3 | รหัสผิดครั้งที่ 5 | ล็อก 15 นาที, ล็อกอินด้วยรหัสถูกก็ไม่ผ่านจนพ้นเวลา |
| A4 | token หมดอายุ/ถูก revoke | ทุก action ตอบ AUTH_EXPIRED → UI เด้งหน้า login โดยไม่ทำ outbox หาย |
| A5 | owner force-logout เครื่อง staff | request ถัดไปจากเครื่องนั้นถูกปฏิเสธทันที |
| A6 | staff ยิง API ตรง (curl) เรียก `report.summary` | FORBIDDEN + audit flag SUSPICIOUS |
| A7 | staff ปลอม `branch_id` สาขาอื่นใน payload | ข้อมูลถูกเขียนเป็นสาขาตัวเองเสมอ (ถูก override) |
| A8 | ส่ง note ค่า `=IMPORTRANGE(...)`, `+1+1`, `@cmd` | ค่าในชีตเป็นข้อความล้วน (มี `'` นำ) ไม่กลายเป็นสูตร |
| A9 | ยิง 100 req ใน 1 นาทีจาก device เดียว | โดน RATE_LIMITED ตั้งแต่ req ที่ 61 + audit |
| A10 | ใส่ PIN ผิด 5 ครั้งตอนปรับสต็อก | PIN_FAILED ลง audit + ล็อกการอนุมัติชั่วคราว |
| A11 | replay บิลเดิม (ส่ง sale.syncBatch id ซ้ำ 10 รอบ) | ชีตมีบิลเดียว ตอบ duplicate 9 รอบ |
| A12 | device ที่ถูกบล็อกส่ง request | DEVICE_BLOCKED ทุก action รวม login |

## ชุด B — POS ทุกโหมดขาย (10 เคส)
| # | เคส | Expected |
|---|---|---|
| B1 | ขายปกติ 3 สินค้า จ่าย QR1 | ยอดถูก, Sales+SaleItems ครบ, สต็อกลดถูกล็อต (FIFO เก่าก่อน), DailySummary ขยับ |
| B2 | ลดราคา: แก้ 45→35 บาท | unit_price=3500 สตางค์, audit PRICE_OVERRIDE, ถ้าต่ำกว่า 50% → flag SUSPICIOUS |
| B3 | แถม: ซื้อกะเพรา 40.- + นม 25.-, แถมหมูปิ้ง | ยอดตั้งต้น = 40×2=80 (แพงสุด×จำนวนตัวซื้อ ตาม GAP-17), หมูปิ้ง price=0, ทั้ง 3 ชิ้นถูกตัดสต็อก+มี unit_cost จริง |
| B4 | แถม: แก้ยอดรวม 80→75 | unit_price ตัวซื้อถูก pro-rate, Σ รายการ = 7500 สตางค์พอดี (ไม่มีเศษหาย) |
| B5 | แถมโดยไม่มีตัวซื้อเลย | กดจบไม่ได้ + ข้อความอธิบาย |
| B6 | ขายพนักงาน | ใช้ staff_price, ยอดแยกใน revenue_by_type.staff |
| B7 | CASH รับ 100 ยอด 87 | ทอน 13 แสดงตัวใหญ่, cash_received/change_given ถูกบันทึก |
| B8 | CASH รับ 80 ยอด 87 | ปุ่มจบกดไม่ได้ (frontend) และ API reject (backend) — เทสทั้งสองชั้น |
| B9 | Void บิลใน 15 นาที | สต็อกคืนล็อตเดิมตรงตาม lot_breakdown, status=voided, รายงานไม่นับ, audit ครบ |
| B10 | Void บิลเกิน 15 นาที (staff) / บิล reconciled (office) | ถูกปฏิเสธพร้อมเหตุผลถูกต้องทั้งสองกรณี |

## ชุด C — Offline & Sync Chaos (10 เคส — ชุดสำคัญที่สุดของระบบนี้)
| # | เคส | Expected |
|---|---|---|
| C1 | ปิดเน็ต → ขาย 10 บิลครบ 4 โหมด → เปิดเน็ต | ขึ้นครบ 10 ไม่ซ้ำ เรียงเวลา client ถูกต้อง |
| C2 | ปิดเน็ต → ขาย 5 → **ปิดเบราว์เซอร์/restart เครื่อง** → เปิดแอป (ยังออฟไลน์) → ขายอีก 3 → เปิดเน็ต | ครบ 8 บิล (พิสูจน์ IndexedDB อยู่รอดข้าม session) |
| C3 | เน็ตหลุด "ระหว่าง" sync (kill connection กลางทาง) | ไม่มีบิลหาย/ไม่มีบิลซ้ำ — retry รอบถัดไปสำเร็จ |
| C4 | server ตอบช้า 30 วิ (จำลอง timeout) | client timeout แล้ว retry, ฝั่งชีตไม่มีแถวซ้ำ (idempotency รับมือ double-write) |
| C5 | 2 แท็บเล็ตสาขาเดียวกัน ขายสินค้าเดียวกันพร้อมกัน (online) | สต็อกรวมถูกต้อง (LockService), ไม่มีล็อตติดลบ |
| C6 | 3 เครื่อง 3 สาขา sync พร้อมกันเครื่องละ 20 บิล | 60 บิลครบ ถูกสาขา ถูกล็อต |
| C7 | ขายออฟไลน์เกินสต็อกระบบ (ระบบมี 3 ขายไป 5) | บิลถูกรับ, ตัด 3, flag OVERSOLD, แจ้งเตือนออฟฟิศ |
| C8 | บิลค้างคืน sync หลัง reconcile แล้ว | late_after_reconcile=TRUE, Reconciliation → reopened, badge แดงขึ้นทั้ง office และ owner (GAP-03) |
| C9 | ตั้งนาฬิกาแท็บเล็ตย้อนหลัง 3 วันแล้วขายออฟไลน์ | flag CLOCK_DRIFT, owner เห็นใน audit (GAP-04) |
| C10 | extendExpiry + wastage ตอนออฟไลน์ | เข้า outbox, sync แล้วถูกต้องทั้งคู่ (GAP-15) |

## ชุด D — FIFO / Production / ต้นทุน (8 เคส)
| # | เคส | Expected |
|---|---|---|
| D1 | ซื้อหมู 2 ล็อต (ราคา 100/120 ต่อ kg) ใช้ 5kg ที่ล็อตแรกเหลือ 2kg | ต้นทุน 560 บาทพอดี, ล็อต1 เหลือ 0, ล็อต2 เหลือถูกต้อง (เคสตรงจาก plan.md 5.1) |
| D2 | ผลิต 50 กล่อง สูตร 10 ส่วนผสม + บรรจุภัณฑ์ 3 ชนิด | unit_cost_locked = (วัตถุดิบ+บรรจุภัณฑ์)/50, consumption_detail ครบทุกล็อตทุกรายการ |
| D3 | ผลิตวันนี้ → พรุ่งนี้ราคาวัตถุดิบขึ้น → ผลิตใหม่ → ดูรายงานย้อนหลัง | ล็อตเก่าโชว์ต้นทุนเก่า ล็อตใหม่ต้นทุนใหม่ ประวัติไม่ขยับ (Cost Locking) |
| D4 | ผลิตตอนวัตถุดิบขาด 1 รายการ | preview แสดง ❌ บอกจำนวนที่ขาด, ปุ่มผลิตกดไม่ได้, ยิง API ตรงก็ถูก reject (เทส 2 ชั้น) |
| D5 | ขายสินค้าที่มาจาก 2 ล็อตต้นทุนต่างกันในบิลเดียว | total_cogs = ถ่วงน้ำหนักตามจริง, lot_breakdown 2 แถว |
| D6 | ปรับสต็อกด้วย PIN ถูกต้อง | จำนวนเปลี่ยน, StockAdjustments มี approved_by, audit ครบ |
| D7 | สูตรใช้ 150g × ผลิต 33 ชุด ทำซ้ำ 100 รอบ (เทสสะสมเศษ) | qty_remaining เป็น integer เสมอ ไม่มีเศษทศนิยมตกค้าง (GAP-05) |
| D8 | แก้สูตรอาหารหลังเคยผลิตไปแล้ว | สูตรเก่า active=FALSE, ใบผลิตเก่าอ้างสูตรเก่าได้ครบ, ผลิตใหม่ใช้สูตรใหม่ |

## ชุด E — Wastage / Reconcile / Expenses (7 เคส)
| # | เคส | Expected |
|---|---|---|
| E1 | ทิ้งของ 2 ล็อตต้นทุนต่างกัน | ตัดล็อตหมดอายุก่อน, total_cost_value ตรงถ่วงน้ำหนัก |
| E2 | "เก็บขายต่อพรุ่งนี้" | expiry_date +1 วัน, audit ระบุคนยืด |
| E3 | ทิ้งวัตถุดิบดิบ (rawWastage) | RawLots ลด, มูลค่ารวมใน wastage_value ของ Dashboard (GAP-19) |
| E4 | Reconcile วันปกติ ยอดตรงทุกช่อง | กดยืนยันได้, Sales ทั้งวันเป็น reconciled |
| E5 | ยอดเงินสดขาด 200 | บังคับกรอก note, status=mismatch, เด้งแจ้งเตือน owner |
| E6 | Reconcile วันที่มีบิล void + บิล OVERSOLD | ยอดระบบไม่รวม void, รายการพิเศษแสดงแยกให้เห็น |
| E7 | คีย์ค่าใช้จ่าย ลบ/ศูนย์/อนาคต | ถูก reject ทุกกรณี (validation backend) |

## ชุด F — Dashboard / รายงาน / PDF (6 เคส)
| # | เคส | Expected |
|---|---|---|
| F1 | เทียบ Dashboard กับคำนวณมือจากชีตดิบ (1 วัน, 1 สาขา) | ตรงทุกตัวเลขถึงหลักสตางค์ |
| F2 | สลับ ทุกสาขา↔รายสาขา และช่วงเวลา 5 แบบ | ตัวเลขสอดคล้องกัน (ผลรวมรายสาขา = ทุกสาขา) |
| F3 | สัดส่วนลูกค้าจริง vs พนักงาน | normal+discount+freebie อยู่ฝั่งลูกค้า, staff แยกฝั่ง ตาม plan.md 7.2 |
| F4 | DailySummary rebuild กลางคืน vs ยอด incremental | ตรงกัน 100% — ถ้าไม่ตรง = บัคต้องหาให้เจอก่อนปิดเฟส |
| F5 | Export PDF งบเดือน | ฟอนต์ไทยถูก, A4 ไม่ตกขอบ, เลขตรงหน้าจอ, โครง 10-K ครบ 3 Part |
| F6 | งบดุล: สินทรัพย์สต็อก = Σ(qty_remaining × unit_cost) ทุกล็อตทุกคลัง | ตรงกับคำนวณมือ |

## ชุด G — Audit & Traceability (5 เคส)
| # | เคส | Expected |
|---|---|---|
| G1 | ทำครบทุก action ใน 1 วันเทส | ทุกรายการอยู่ใน AuditLog ถูก feature_group, มี device_id, hash chain ต่อเนื่อง |
| G2 | แอบแก้เซลล์หนึ่งใน AuditLog โดยตรง (จำลองคนใน) | `verifyAuditChain()` จับได้ ระบุแถว + อีเมลแจ้ง owner |
| G3 | โจทย์ T1-T4 จากส่วนที่ 5 | ไล่เส้นทางครบใน ≤ 5 คลิกจริง |
| G4 | กฎ flag อัตโนมัติทั้ง 4 ข้อ (ราคาต่ำ/ขายพนักงานถี่/ปรับสต็อกถี่/ทิ้งของแพง) | ทริกเกอร์ถูกเงื่อนไขตามค่าใน Config |
| G5 | เปลี่ยนราคาสินค้า | PriceHistory มีแถวใหม่, บิลเก่ายังโชว์ราคาเดิม |

## ชุด H — Performance, อุปกรณ์จริง, UAT
**H-Perf (บน staging ที่ seed 6 เดือน ~110k แถว):** `sale.syncBatch` 10 บิล ≤ 5 วิ | `report.summary` รายเดือน ≤ 4 วิ / inception ≤ 6 วิ (ผ่าน DailySummary) | `product.list` ≤ 3 วิ | เปิดแอปจาก cache ≤ 2 วิ | ขาย 1 บิลจบ (นิ้วแตะแรก→เช็คเขียว) ≤ 15 วิ
**H-Device:** ทดสอบบนแท็บเล็ต Android จริงของร้าน + iPhone/iPad (Safari มีข้อจำกัด IndexedDB eviction — ต้องเทส C2 บน iOS ด้วยโดยเฉพาะ) + PWA install ครบทุกเครื่อง
**H-UAT (สคริปต์พนักงานจริง 2 วัน):** วันที่ 1 — staff ขายจริงคู่จดมือทั้งวัน + เย็นบันทึกของเสีย + DayClose | วันที่ 2 — office ทำครบวงจร (รับของ/ซื้อวัตถุดิบ/ผลิต/reconcile ยอดเมื่อวาน) + owner ตรวจ Dashboard เทียบจดมือ | เกณฑ์ผ่าน: ยอดตรงจดมือ 100%, พนักงานทำเองได้โดยไม่ต้องถามเกิน 1 ครั้ง/ฟีเจอร์, ไม่มีบัค Critical/High

---

# ส่วนที่ 8: การดูแลหลังเปิดใช้ (Operations & Monitoring)

## 8.1 งานอัตโนมัติกลางคืน (Time-driven Triggers)
| เวลา | งาน | แจ้งเตือนเมื่อ |
|---|---|---|
| 01:00 | rebuild `DailySummary` ของเมื่อวาน | ผล rebuild ≠ ค่า incremental |
| 01:30 | `verifyAuditChain()` ทั้งโซ่ | โซ่ขาด → อีเมล owner ทันที |
| 02:00 | Backup DB (รายวัน 30 วัน / อาทิตย์ละชุด 12 สัปดาห์) | copy ล้มเหลว |
| 02:30 | ลบ Sessions หมดอายุ + เคลียร์ ErrorLog เก่า > 90 วัน | — |
| 07:00 | **Health Report อีเมลถึง owner:** ยอดเมื่อวานทุกสาขา, reconcile ค้าง/mismatch, SUSPICIOUS ใหม่, ErrorLog ใหม่, สถานะ backup/chain, จำนวนแถวรวม (เฝ้า quota 10M เซลล์) | ทุกเช้า |

## 8.2 Playbook เหตุการณ์ผิดปกติ
| เหตุการณ์ | ทำทันที |
|---|---|
| แท็บเล็ตหาย/ถูกขโมย | owner เปิด Admin → block device → force-logout → เปลี่ยนรหัส staff สาขานั้น (ครบใน 2 นาที ไม่ต้องพึ่งช่าง) |
| สงสัยพนักงานทุจริต | AuditLog filter คน+ช่วงเวลา → ดู void/PRICE_OVERRIDE/ขายพนักงาน/CLOCK_DRIFT ประกอบกัน |
| ชีตพัง/ลบผิด | Restore Runbook: เอา backup ล่าสุด → rename เป็น DB ใหม่ → อัปเดต SPREADSHEET_ID ใน Script Properties → ตรวจ C1 หนึ่งรอบ → เปิดใช้ (เสียข้อมูลสูงสุด = ตั้งแต่ 02:00 ของวันนั้น ซึ่งกู้เพิ่มได้จาก outbox ของแท็บเล็ตที่ยังไม่เคลียร์ + Google Sheets version history) |
| GAS quota เต็ม/ระบบช้าผิดปกติ | ดู ErrorLog + ลด polling → ถ้าถึงทางตัน เริ่มแผนย้าย Supabase (API layer แยกชั้นไว้แล้ว — frontend ไม่ต้องแก้) |

## 8.3 เกณฑ์ "เสร็จสมบูรณ์" ของทั้งโปรเจกต์ (Final Definition of Done)
- [ ] เทสชุด A-H ผ่าน 100% บน staging และบันทึกผลไว้เป็นหลักฐาน
- [ ] คู่ขนานกับจดมือ 3 วัน ยอดตรง 3 วันติดทุกสาขา
- [ ] Trigger กลางคืนทั้ง 5 ตัวทำงานแล้วอย่างน้อย 3 คืนโดยไม่มี error
- [ ] Health Report ถึงอีเมล owner ทุกเช้า
- [ ] Backup กู้คืนจริงสำเร็จอย่างน้อย 1 ครั้ง (ซ้อม restore ก่อนเปิดจริง — backup ที่ไม่เคยซ้อมกู้ = ไม่มี backup)
- [ ] 2-Step Verification บัญชี Google owner เปิดแล้ว
- [ ] เอกสาร 3 ไฟล์ (plan.md / Grand's.md / plan2.md) อัปเดตตรงกับของจริงที่สร้างเสร็จ

---

*plan2.md จบ — ใช้คู่กับ [plan.md](plan.md) (ความต้องการธุรกิจ) และ [Grand's.md](Grand's.md) (พิมพ์เขียวเทคนิค) โดย plan2.md มีศักดิ์สูงสุดเมื่อขัดแย้งกัน*
