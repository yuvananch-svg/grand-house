# Grand House Security Notes

เอกสารนี้เป็นแนวทางสำหรับย้ายจาก prototype แบบ local ไปเป็น full stack web app จริง

## หลักที่ต้องยึด

- ห้ามใส่ `service_role` key หรือ secret key ใน frontend
- ใช้ Supabase Auth สำหรับผู้ใช้จริง และเก็บ role ใน `app_metadata` หรือ table ฝั่งระบบ ไม่ใช้ user-editable metadata
- เปิด Row Level Security ทุก table ที่อยู่ใน exposed schema เช่น `public`
- แยก role อย่างน้อย: `owner`, `staff`
- ทุกการแก้ข้อมูลสำคัญต้องเป็น append-only log หรือมี audit trail
- เอกสารภาษีและการเงินต้องแก้ไขได้เฉพาะ owner
- POS sale, stock movement, payment, document ต้องอ้างอิงกันด้วย id เพื่อ audit ย้อนหลังได้

## Threat Model เบื้องต้น

| ความเสี่ยง | แนวป้องกัน |
|---|---|
| พนักงานเห็นข้อมูลกำไร/ภาษี | RLS + role policy จำกัด owner-only tables/views |
| แก้ยอดขายย้อนหลังโดยไม่มีร่องรอย | ใช้ audit log และไม่ลบ transaction จริง |
| ขายสินค้าหมดอายุ | server-side validation ก่อนบันทึก sale |
| ต้นทุน/สต็อกถูกแก้จาก browser | mutation ต้องผ่าน RPC/Edge Function หรือ policy ที่ตรวจ role |
| key รั่วใน frontend | ใช้ publishable/anon key เท่านั้น และเปิด RLS |

## ก่อนขึ้น production

1. ตั้ง Supabase Auth และ RLS policies
2. เพิ่ม audit log สำหรับ insert/update/delete ที่สำคัญ
3. เพิ่ม backup/export schedule
4. เพิ่ม rate limit ที่ endpoint สำคัญ
5. ตรวจ dependency audit และ lock version
6. ทดสอบ role owner/staff แยกกัน
7. ทดสอบว่าพนักงานไม่สามารถอ่านงบ/ภาษีผ่าน API ได้

## สถานะ prototype ตอนนี้

- PIN ในแอป local เป็นเพียง UX simulation เพื่อแยกหน้าพนักงาน/เจ้าของ
- PIN local ไม่ถือว่าเป็น cybersecurity จริง เพราะข้อมูลยังอยู่ใน browser/localStorage
- ความปลอดภัยจริงต้องเกิดที่ backend: Supabase Auth, RLS, validation ฝั่ง server, audit log, backup และ least privilege

## ฟีเจอร์ที่แนะนำเพิ่มก่อนใช้ร้านจริง

- ปุ่มปิดกะ/ปิดวัน: สรุปเงินสด, QR, ส่วนต่าง, และรายการต้องตรวจ
- Audit trail หน้าจอ owner: ใครแก้ stock, แก้บิล, ตัดเสีย, หรือแก้เอกสาร
- Low stock alert: เตือนวัตถุดิบ/เมนูใกล้หมด
- Waste reason analytics: สรุปของเสียตามสาเหตุ เช่น หมดอายุ, ทำเกิน, เก็บไม่ดี
- Backup/export schedule: export ข้อมูลทุกวันอัตโนมัติ
- Role permission matrix: ระบุชัดว่าพนักงานทำอะไรได้/ไม่ได้ในแต่ละหน้า

อ้างอิงที่ใช้วางแนวทาง:
- Supabase secure product configuration
- Supabase Row Level Security
- Supabase security guidance เรื่องไม่ใช้ service role ใน frontend และไม่ใช้ user metadata ตัดสินสิทธิ์
