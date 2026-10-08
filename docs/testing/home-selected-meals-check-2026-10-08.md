# Home: selected-date meal actions — 8 ต.ค. 2569

Branch: `feature/Chayakorn05`

## Scope

- ใช้โลโก้เดิมหน้าคำทักทาย
- รายการอาหารตรงกับวันที่ใน date selector พร้อมจำนวนและปุ่มเพิ่ม
- การ์ดรูป/placeholder ชื่อสองบรรทัด kcal ส่วนประกอบย่อ และ action แก้ไข/ลบ
- เปิด MealPanel เดิมจากพื้นที่หลักของการ์ดหรือปุ่มแก้ไข
- เพิ่มอาหารด้วยวันที่ที่เลือก แก้รายการเดิมด้วย PUT โดยไม่สร้างรายการซ้ำ
- บันทึกสำเร็จกลับหน้าแรกของวันเดิม แม้เปลี่ยนวันที่ของอาหารใน editor
- ใช้ confirmation/DELETE เดิมและโหลดพลังงาน สารอาหาร จำนวนรายการใหม่
- ความผิดพลาดคง draft หรือรายการเดิมพร้อมข้อความ และเปลี่ยนวันแสดง loading แทนข้อมูลเก่า
- ไม่มี route/API ใหม่ ไม่เปลี่ยนสูตร TDEE งบแคลอรี หรือการคำนวณสารอาหาร

## Validation

ชุดทดสอบเบราว์เซอร์ใช้ API จำลองผ่าน `.local/reliability-check.config.ts`; ไม่เขียนข้อมูลใน Supabase จริง

- `e2e/home-meal-actions.spec.ts`: 5 ผ่าน — เพิ่ม/แก้ย้อนหลัง, บันทึกไม่ผ่านและย้ายวันที่, ยกเลิก/ลบผิดพลาด/ลบสำเร็จ, responsive, เลือกวันเดิม, เปลี่ยนวันระหว่างโหลด
- Regression 12 ผ่าน: `home-date-selector`, `macro-targets`, `ui-layout`, `save-flow`, `mockup-scope`
- `npm run build`: ผ่าน รวม TypeScript ฝั่ง client/server; มี warning เดิมเรื่อง annotation ใน Zod และขนาด bundle
- `git diff --check`: ผ่าน
- จอ 320, 360, 390, 533, 1440px ไม่ล้นแนวนอน; edit/delete สูงอย่างน้อย 44px และ CTA ไม่ชนเมนูล่าง
- ตรวจภาพ 320/390px แล้ว; ภาพ fixture อยู่ `.local/home-meal-actions-20261008/home-{width}.png`

ผลนี้ยืนยันการเชื่อม UI/คำขอ API ด้วยข้อมูลจำลอง ยังไม่ได้ยืนยันการเขียนฐานข้อมูล production หรือ deploy การเปลี่ยนแปลงนี้
