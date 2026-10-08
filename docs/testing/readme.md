# เอกสารทดสอบ

- [ผลคลีนโค้ดก่อนรวมเข้า life-balance-test วันที่ 8 ตุลาคม 2569](code-cleanup-2026-10-08.md) — ลดโค้ด/CSS ที่เลิกใช้, production build, dependency patches และ regression
- [ผลปรับหน้าแก้ไข/ตรวจอาหารตาม reference วันที่ 8 ตุลาคม 2569](meal-editor-reference-2026-10-08.md) — shared editor, วันที่จุดเดียว, 10 ส่วนประกอบ และปุ่มท้ายหน้าที่กระชับ
- [ผลแก้การ์ดส่วนประกอบและ UI จาก audit วันที่ 8 ตุลาคม 2569](compact-ui-fixes-2026-10-08.md) — responsive, ปุ่มย่อย, เตือนมื้ออาหาร และ regression ของระบบเดิม
- [ผลทดสอบเป้าหมาย TDEE และ catalog วันที่ 6 ตุลาคม 2569](goals-check-2026-10-06.md) — โค้ดและ Docker ในเครื่อง; ยังไม่ได้อัปเดต Supabase/Render
- [ผลทดสอบ LifeBalance กับ Supabase และ AI จริง วันที่ 6 ตุลาคม 2569](live-system-check-2026-10-06.md)
- [ผลทดสอบ AI ด้วยรูปอาหารหนึ่งรายการ](food-ai-live-check.md)
- [ผลทดสอบ AI ด้วยเมนูที่มีหลายส่วนประกอบ](mixed-meal-live-check.md)
- [แผนทดสอบและหลักฐาน Lab 9](lab9-test-plan.md)

รัน `npm test` สำหรับ unit tests และ `npm run test:e2e` สำหรับหน้าเว็บที่ใช้ API จำลอง ผลสองชุดนี้ยังไม่ยืนยันการเชื่อมฐานข้อมูลหรือ AI จริง

การทดสอบกับฐานข้อมูลจริงใช้ `npm run test:e2e:live` หลังเปิด API และหน้าเว็บที่พอร์ต 5173 พร้อมตั้งค่า `.env` ให้ถูกต้อง ชุดนี้สร้างบัญชี QA ชั่วคราวและลบเฉพาะบัญชีนั้นหลังทดสอบ ใช้ catalog จริงและไม่เรียก AI ใน flow กรอกอาหารเอง ไม่ต้องรัน migration หรือ seed ซ้ำบนฐานข้อมูลทีมที่เตรียมไว้แล้ว
