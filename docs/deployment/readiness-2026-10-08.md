# ตรวจความพร้อม deploy — 8 ต.ค. 2569

อัปเดตหลังรายงานนี้: เผยแพร่รุ่นใหม่บน Render แล้ว พร้อมแก้ proxy configuration เพิ่มเติม ดู [ผล deployment จริง](release-2026-10-08.md) รายงานด้านล่างเป็นหลักฐานก่อนเผยแพร่

## ข้อสรุป

พร้อมนำ local candidate ไปอัปโหลดและ deploy โดยใช้เว็บและ API ใน container เดียว และฐานข้อมูล Supabase แยกเช่นเดิม ไม่พบข้อขัดข้องที่ยังค้างจากชุดตรวจนี้ ทั้งนี้ยังไม่ได้อัปโหลด image หรือเปลี่ยน Render และยังต้องตรวจการใช้งานจริงหลัง deploy

สาขา `feature/Chayakorn05` มีการแก้ไขที่ยังไม่ commit อยู่ก่อนเริ่มงาน ตรวจจาก working tree ปัจจุบัน ไม่ใช่เฉพาะ HEAD และไม่ได้ commit/push ในงานนี้

## ผลตรวจ

| รายการ | ผล |
| --- | --- |
| TypeScript + production build | ผ่าน |
| Unit/API tests | 119 ผ่าน |
| PostgreSQL integration | อีก 3 ผ่าน โดยใช้ PostgreSQL 17 ชั่วคราวแยกจากฐานข้อมูลร่วม ครอบคลุม persistence/session/user isolation, ประวัติน้ำหนัก และโควตา AI พร้อมกัน |
| Mocked browser E2E | รอบเต็ม 70 ผ่าน / 1 ไม่ผ่านจาก 71; หลังแก้ scroll clearance ทดสอบ `ui-layout` ซ้ำ 2 ผ่าน รวมกรณีที่เคยไม่ผ่าน ไม่ได้รันทั้งชุดซ้ำ |
| Responsive ใน targeted layout suite | 320px, 390px และ desktop ผ่าน ไม่ล้นแนวนอน และปุ่มหน้าแรกเลื่อนให้พ้นเมนูล่างได้ |
| Docker production runtime | candidate สุดท้ายผ่าน 13 กลุ่ม รวม startup/PORT/health, static assets, auth/CSRF/cookies, TDEE/JSONB, อาหารและสารอาหาร, weekly summary, restart/session และ AI-disabled fallback |
| Avatar runtime | เพิ่ม/อ่าน/ลบรูปผ่าน และไม่เพิ่มแถวประวัติน้ำหนักโดยไม่ตั้งใจ ทดสอบก่อนแก้ CSS โดยไม่มีการเปลี่ยน backend หลังจากนั้น |
| ฐานข้อมูลที่กำหนดในเครื่อง | อ่านตรวจพบ `avatarImageData`, `goalSettings` และสิทธิ์ที่ต้องใช้จัดการน้ำหนักครบ |
| Linux image → Supabase | เชื่อมต่อและตรวจ 7 ตารางผ่านด้วยการอ่านอย่างเดียว ก่อน rebuild CSS ไม่มีการเปลี่ยน backend/config |
| เว็บ Render รุ่นเดิม | `/api/health` ตอบ 200 ยืนยันเพียง HTTP liveness ของรุ่นที่ออนไลน์อยู่ |

ฐานข้อมูล integration และ Docker smoke ใช้ container ชั่วคราวและลบทิ้งแล้ว ไม่มี migration, seed หรือการเขียนข้อมูลทดสอบลงฐานข้อมูลร่วม และไม่มีการเรียก AI ภายนอก

## สิ่งที่แก้ระหว่างตรวจ

- `src/client/styles/reference.css`: เพิ่ม `scroll-margin-bottom` ให้ปุ่มบันทึกอาหารหน้าแรกเพื่อเผื่อเมนูล่างตอนเลื่อนเข้ามุมมอง
- `e2e/ui-layout.spec.ts`: เปลี่ยนขั้นตอนเลื่อนเป็น `scrollIntoView({ block: 'end' })` เพราะ `scrollIntoViewIfNeeded()` เดิมนับพื้นที่ที่เมนู fixed ทับว่าอยู่ใน viewport แล้ว คง assertion ว่าปุ่มต้องพ้นเมนูล่างไว้
- ไม่เปลี่ยน API, business logic หรือเพิ่มฟีเจอร์

## Local candidate สุดท้าย

- Tag: `lifebalance:readiness-20261008`
- Platform: `linux/amd64`, runtime user: `node`
- Image config ID: `sha256:c4d3f3651a1c0fa4ad4e0c2d5b3868160aecc7a5d960c00d8962a8c4d91c7a14`
- Local manifest list: `sha256:398758401a2fe4235bb0b01a7ae193212c041573e791900daa4639237b40f733`
- ยังไม่ได้ push ไป registry; ค่านี้ไม่ใช่หลักฐานว่า Render ใช้ image นี้แล้ว
- Runtime ตรวจไม่พบ `.env`, `.git`, `.local` หรือค่า secret ที่กำหนดฝังไว้ใน image environment

## ขอบเขตและขั้นตอนที่เหลือ

1. อัปโหลด candidate ด้วย tag รุ่นใหม่ไป repository เดิม เก็บ tag/digest รุ่นก่อนหน้าไว้ rollback
2. ตรวจ Render ใช้ฐานข้อมูลและ HTTPS `APP_ORIGIN` ที่ถูกต้อง การตรวจฐานข้อมูลครั้งนี้อ้างอิง configuration ฝั่งเครื่อง ไม่ได้อ่านยืนยัน environment บน Render
3. เปลี่ยน image และ deploy บน Render
4. หลัง deploy ทดสอบ HTTPS login, เพิ่ม/แก้/ลบอาหารย้อนหลัง, เป้าหมาย, น้ำหนัก, รูปโปรไฟล์ และข้อมูลหลัง refresh
5. ตรวจกล้องบนมือถือจริงและ AI จริง: mocked E2E และ AI-disabled smoke ไม่ยืนยัน permission กล้อง, provider key/quota, latency หรือความแม่นยำของ AI

Local build มีคำเตือน annotation จาก dependency และ JS chunk ขนาดเกินเกณฑ์เตือน แต่ build สำเร็จ ส่วน Docker production build แบ่ง chunk และ main JS ประมาณ 269 kB คำเตือนเหล่านี้ไม่ใช่ build failure

หลักฐานภายในเครื่อง: `.local/release-audit-20261008.md`, `.local/goals-check/runtime-result.json`, `.local/docker-supabase-readonly-result.json` และ output ของ `.local/release-db-integration.mjs` ไฟล์ `.local` ไม่ใช่ส่วนของ image หรือ release ที่เผยแพร่
