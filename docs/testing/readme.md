# เอกสารทดสอบ

- [ผลตรวจ UI และเตรียมรวม branch วันที่ 10 ตุลาคม 2569](ui-polish-merge-check-2026-10-10.md) — regression, responsive, date focus และ independent review
- [ผลตรวจและปรับคู่มือวันที่ 9 ตุลาคม 2569](documentation-check-2026-10-09.md) — ข้อมูลหน้าจอ/สถาปัตยกรรม/setup/CI และลิงก์ในคู่มือปัจจุบัน
- [ผลแก้ lazy chunk recovery วันที่ 9 ตุลาคม 2569](chunk-recovery-2026-10-09.md) — fallback, reload ที่ผู้ใช้กดเอง และ production-build browser tests
- [ผลคลีนโค้ดก่อนรวมเข้า life-balance-test วันที่ 8 ตุลาคม 2569](code-cleanup-2026-10-08.md) — ลดโค้ด/CSS ที่เลิกใช้, production build, dependency patches และ regression
- [ผลปรับหน้าแก้ไข/ตรวจอาหารตาม reference วันที่ 8 ตุลาคม 2569](meal-editor-reference-2026-10-08.md) — shared editor, วันที่จุดเดียว, 10 ส่วนประกอบ และปุ่มท้ายหน้าที่กระชับ
- [ผลแก้การ์ดส่วนประกอบและ UI จาก audit วันที่ 8 ตุลาคม 2569](compact-ui-fixes-2026-10-08.md) — responsive, ปุ่มย่อย, เตือนมื้ออาหาร และ regression ของระบบเดิม
- [ผลทดสอบเป้าหมาย TDEE และ catalog วันที่ 6 ตุลาคม 2569](goals-check-2026-10-06.md) — โค้ดและ Docker ในเครื่อง; ยังไม่ได้อัปเดต Supabase/Render
- [ผลทดสอบ LifeBalance กับ Supabase และ AI จริง วันที่ 6 ตุลาคม 2569](live-system-check-2026-10-06.md)
- [ผลทดสอบ AI ด้วยรูปอาหารหนึ่งรายการ](food-ai-live-check.md)
- [ผลทดสอบ AI ด้วยเมนูที่มีหลายส่วนประกอบ](mixed-meal-live-check.md)
- [แผนทดสอบและหลักฐาน Lab 9](lab9-test-plan.md)

รายงานที่มีวันที่เป็นหลักฐานของรอบนั้น ไม่ใช่สถานะล่าสุดของ Render หรือฐานข้อมูล ดูวิธีใช้งานปัจจุบันที่ [คู่มือใช้งาน](../user-guide.md) และขอบเขตภาพที่ [UI Design Brief](../ui/lifebalance-ui-design-brief.md)

รัน `npm test` สำหรับ unit/API tests และ `npm run test:e2e` สำหรับหน้าเว็บที่ใช้ API จำลอง ใช้ `npm run build` แล้ว `npm run test:e2e:chunks` สำหรับการกู้คืนเมื่อไฟล์หน้าจอรุ่นที่ build โหลดไม่ได้ ผลเหล่านี้ยังไม่ยืนยันการเชื่อมฐานข้อมูลหรือ AI จริง คำสั่ง CI ดู [workflow](../../.github/workflows/readme.md)

การทดสอบกับฐานข้อมูลจริงใช้ `npm run test:e2e:live` หลังเปิด API และหน้าเว็บที่พอร์ต 5173 พร้อมตั้งค่า `.env` ให้ถูกต้อง ใช้ฐานข้อมูลทดสอบแยกเท่านั้น ชุดนี้สร้างบัญชี QA และอาหารจริงแล้วลบเฉพาะบัญชีทดสอบท้ายชุด ใช้ catalog จริงและไม่เรียก AI ใน flow กรอกอาหารเอง ไม่ต้องรัน migration หรือ seed ซ้ำบนฐานที่ schema/catalog พร้อมแล้ว และชุดนี้ไม่รันใน CI ดู [การเตรียมทดสอบ](../local-testing.md)
