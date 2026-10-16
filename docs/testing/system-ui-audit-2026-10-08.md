> **รายงานย้อนหลัง:** เก็บผลและขอบเขตของรอบเดิมไว้ ดูหลักฐาน CI/CD ล่าสุดที่บันทึกใน [คู่มือ CD](../deployment/continuous-deployment.md) โดยผลเก่าด้านล่างไม่ใช่การทดสอบรุ่นปัจจุบันซ้ำ

# System UI audit — 8 ต.ค. 2569

ตรวจ branch `feature/Chayakorn05` ด้วย browser fixtures, unit/API tests, ฐานข้อมูล PostgreSQL ทดสอบแยก และการอ่านเว็บ local ที่ผู้ใช้เปิดอยู่ ไม่แก้โค้ดผลิตภัณฑ์หรือ Git อ่าน [UI design brief](../ui/lifebalance-ui-design-brief.md) แล้ว โดยยึดชื่อแท็บล่าสุด “หน้าแรก” และการนำแถบเลือกวันออกจากหน้าบันทึกตามข้อกำหนดวันที่ 8 ต.ค.

## API / persistence / เว็บที่ใช้อยู่

- `npm test`: 119 ผ่าน, 3 เคส integration ข้ามเพราะไม่มี `TEST_DATABASE_URL` ในการรันปกติ
- เปิด `postgres:17-alpine` เป็น container ชั่วคราวใหม่ ผูกเฉพาะ localhost ด้วย port ที่ Docker จัดให้ ตรวจ URL ก่อนกำหนด `DATABASE_URL`/`TEST_DATABASE_URL` แล้วใช้ `prisma migrate deploy --schema prisma/schema.prisma`: migrations ทั้ง 13 ชุดผ่าน โดยไม่ใช้ URL ของ Supabase
- รัน `database.integration.test.ts`, `weight-database.integration.test.ts`, `quota-database.integration.test.ts` บนฐานข้อมูลแยก: ทั้ง 3 ผ่าน ตรวจการคง session/ข้อมูลข้าม connection การแยกผู้ใช้ พลังงาน การแก้/ลบน้ำหนักและการคืนค่าน้ำหนักล่าสุด รวมถึงการนับ quota พร้อมกันและคงค่าข้าม connection จากนั้นปิด container และลบฐานข้อมูลชั่วคราวด้วย lifecycle `--rm` ของ Docker
- รวม unit/API และ integration ที่รันแยก: **122 เคสผ่าน**
- เว็บ `http://127.0.0.1:5173/` ใช้ session ที่เปิดอยู่: ยืนยันการโหลด Home ของวันที่ 6 ต.ค. บัญชี เป้าหมาย ประวัติ/ค้นคำทั่วไป “ข้าว” ฐานข้อมูลอาหาร กิจกรรม กราฟน้ำหนัก/สรุปสัปดาห์ และเปิด editor อาหารเดิมพร้อมวันที่เดิม ข้อบกพร่องแถวเตือน 22px เกิดในเว็บจริงด้วย ตรวจฟอร์มโปรไฟล์โดยไม่บันทึก คืนช่องค้นหาและหน้าแรกของวันเดิมเมื่อจบ
- ไม่แก้/ลบข้อมูลบัญชีจริง ไม่เปลี่ยนสิทธิ์กล้อง/การแจ้งเตือน และไม่ใช้ quota AI จริง การส่งรูปถึงผู้ให้บริการ AI, กล้องบนโทรศัพท์จริง, การส่งแจ้งเตือนบนอุปกรณ์จริง และ production deployment ยังไม่ได้ยืนยันจากรอบนี้

## ผลที่พบ

ติดตามการแก้แถวเตือนอาหารและรายการที่เกี่ยวข้องได้ใน [ผลแก้ compact UI](compact-ui-fixes-2026-10-08.md) ข้อสังเกตด้านล่างเป็นผลของรอบ audit เดิม

**P2 — แถวตั้งเวลาเตือนอาหารบีบข้อความจนอ่านยากที่ 390px และ 533px.** ป้ายมื้อและคำอธิบายเวลาถูกบังคับอยู่ในช่องกว้าง 22px; “มื้อที่ 1” และ “เวลา 24 ชั่วโมง: 07:00” จึงแตกเป็นตัวอักษร/คำคนละบรรทัด แถวสูง 120–121px ทั้งที่ช่องเวลาอยู่ห่างทางขวา (`x=242` ที่ viewport 390px, `x=359` ที่ 533px). พบจากภาพและ geometry fixture ที่ reminders-390.png (local-only, ignored: `../../.local/system-ui-audit-20261008/reminders-390.png`), reminders-533.png (local-only, ignored: `../../.local/system-ui-audit-20261008/reminders-533.png`) และไฟล์ JSON ข้างกัน

สาเหตุที่เห็นใน CSS: [reference.css](../../src/client/styles/reference.css#L255) กำหนด grid ของ label เป็น `22px 1fr auto` แต่ JSX มีลูกตรงเพียง `<span>` กับ `<input>`; span จึงตกในช่อง 22px แรก และ input ในช่อง `1fr`. [mockup-refresh.css](../../src/client/styles/mockup-refresh.css#L223) จัด grid ภายใน span แต่ไม่ได้แก้การจัดช่องของ label. ยืนยันซ้ำที่ 390px และ 533px; หน้าจอที่กว้างขึ้นยังต้องมีรูปแบบแถวที่ขยายตามพื้นที่โดยไม่ปล่อยให้ span อยู่ในคอลัมน์ไอคอน.

การตรวจภาพรอบนี้ใช้ fixture สดของทุกหน้าที่ขอใน `.local/system-ui-audit-20261008/`: boot-loading, login/register/login-error, Home, Diary/search/history/manual/ingredient form+catalog/camera denied/activity, Progress/weight form/BMI+weekly, Account/profile/goals/reminders. ฟอร์มสำคัญมีภาพที่ 320 และ 1440px; เตือนมี 390 และ 533px. Geometry JSON แสดงว่าไม่มี horizontal overflow ในภาพที่เก็บ. พบปุ่ม action ย่อยบางรายการต่ำกว่า 44px เช่น edit/delete ในประวัติ 36×40, activity 42×40, และลบน้ำหนัก 30×40; ควรพิจารณาเพิ่มพื้นที่แตะตาม brief. รูปแบบหัวเรื่อง 20–22px สอดคล้องกับภาพ; ข้อความรอง 10–12px บางจุดดูเล็กเมื่อเทียบ brief 12–13px. ป้ายเมนูล่าง 10px เป็นส่วนที่เห็นชัด. หน้า Account และหน้าโปรไฟล์มีทางออกจากระบบคนละจุด (เมนูบัญชีกับหัวหน้าลูก); เป็นข้อเสนอด้านความเรียบง่าย P3. ข้อสังเกตเรื่องตัวอักษร/ทางออกเป็น aesthetic suggestion; พื้นที่แตะต่ำกว่าเป้าเป็น usability issue.

## Playwright

คำสั่ง `npx playwright test --config .local/reliability-check.config.ts` ใช้ Vite ที่ `127.0.0.1:5308`, Chrome และ API fixtures: **54 ผ่าน, 9 ล้มเหลว จาก 63 tests**. Fixture audit รันเดี่ยวผ่าน **1/1** หลังเพิ่มภาพ boot-loading. ไม่มี live API/DB. รายงาน JSON เต็มพร้อม error locations อยู่ที่ `.local/system-ui-audit-20261008/playwright-full.json`.

ล้มเหลวที่ส่วนใหญ่เกิดจาก assertion เก่าที่ไม่ตรงกับ markup/copy ปัจจุบัน:

- `ingredient-flow.spec.ts:62` (320px และ 390px): คาด `.meal-list article`; current Diary markup uses `.diary-meal-history .diary-meal-row` ([DiaryPanel.tsx](../../src/client/DiaryPanel.tsx#L278)). Fresh fixture reproduced `.diary-meal-history article` present with `.meal-list article` count zero. The legacy test stops at the selector and cannot establish a save failure.
- `mobile.spec.ts:238` (re-analysis): expected copy “แทนที่ส่วนประกอบเดิมทั้งหมด”; current copy says “แทนที่ส่วนประกอบกับปริมาณที่แก้ไว้ทั้งหมด”. The assertion targets superseded wording.
- `mobile.spec.ts:401` (reminders): `getByLabel('มื้อที่ 1', exact: true)` times out because the label also includes the helper “เวลา 24 ชั่วโมง: 07:00”. Current fixture confirms the input exists; the test never reaches its permission/delivery assertions. The wrapping itself is the separately verified visual defect above.
- `mobile.spec.ts:464` (uploaded photo): expected `.macro-summary`; current Home renders nutrient rows as `.ref-macro-stack` / `.ref-macro-row` ([DashboardPanel.tsx](../../src/client/DashboardPanel.tsx#L93)). The earlier calorie assertion passes; the failed assertion does not assess nutrient value.
- `mobile.spec.ts:543` (desktop authenticated app): `.profile-layout` measured 584px against the assertion’s 480px ceiling at a 1280px viewport. This is a real design-contract mismatch; the current brief requests a vertical desktop layout but does not specify a 480px maximum. Treat as an open responsive requirement, not a proven usability failure.
- `mobile.spec.ts:591` (catalog save): expects `.meal-list article` after clicking save; this selector is absent from current Diary markup as above. The following API-body assertions were not reached, so this run does not verify them.
- `mobile.spec.ts:635` (history edit): the button `ดูทั้งหมด` does exist on Diary home ([DiaryPanel.tsx](../../src/client/DiaryPanel.tsx#L233)). After editing an item opened from History, the app returns to History (`returnRoute.current = 'history'`) and uses `เสร็จสิ้น`; the test incorrectly expects the Home-only control.
- `mobile.spec.ts:720` (history reuse): same route expectation after a history item is reused and saved; History remains open, so `ดูทั้งหมด` is not present. This is a stale postcondition, not a removed button.

การรันใหม่ของ `e2e/system-ui-audit.spec.ts` เพิ่มภาพและ geometry สำหรับหน้าปัจจุบัน โดย mock ทุก `/api/*`; ไม่ได้เปลี่ยนหรือปิด assertion เดิม. ชุดเดิมตรวจ Home date/actions, goal, macro, history, ingredient, photo, profile/avatar, reminders, progress/weight logs, layout, loading/retry และ navigation. ปรับ fixture assertions ให้ตรง route/copy ปัจจุบันได้ ส่วนเพดาน 480px ควรกำหนดตาม responsive design ที่ต้องการก่อนแก้ assertion.

## หลักฐาน

- [system-ui-audit.spec.ts](../../e2e/system-ui-audit.spec.ts) — fixture captures ทุกหน้าที่ระบุ; API mocks เท่านั้น.
- `.local/system-ui-audit-20261008/` — fresh screenshots/geometry JSON ทุกหน้า, ภาพ boot loading, login error, critical forms ที่ 320/1440px, reminder ที่ 390/533px และ `playwright-full.json` พร้อม error evidence.
- `.local/mockup-refresh-20261008/` — ภาพแท็บ 1–4 ที่ 320/360/390/1440px จาก mockup scope test ใน suite เต็ม.
