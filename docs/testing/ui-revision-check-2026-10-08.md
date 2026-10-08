# LifeBalance: ผลตรวจ UI ตามเอกสาร revision — 8 ต.ค. 2026

Branch: `feature/Chayakorn05` เอกสารของผู้ใช้ `LifeBalance-UI-Revision-Instructions.md` เป็นข้อกำหนดหลักเมื่อขัดกับรอบก่อน อ่าน UI Design Brief และตรวจ component/ภาพ reference ก่อนแก้ งาน presentation ใช้ Luna หนึ่งตัว; หัวหน้าตรวจภาพทีละหน้าและทดสอบรวม

## สิ่งที่เปลี่ยน

- เมนูล่าง: active ใช้สีเขียวไม่มีกรอบตกแต่ง คีย์บอร์ดยังมี focus ที่มองเห็นและ Enter เปลี่ยนแท็บได้
- Progress: สรุปสี่ค่าก่อน toggle/range/กราฟ ตามด้วยประวัติน้ำหนักและสรุปสัปดาห์; ปุ่มเริ่มบันทึกน้ำหนักเป็น action รองขนาดกระชับ ฟอร์มบันทึกยังใช้ปุ่มหลักเดิม ข้อมูลเสริมครบแต่ใช้ระยะและตัวอักษรกระชับ
- Today: วงแหวนซ้าย คงเหลือและ macro ขวา ลดกล่องย่อยซ้อนกัน ดูรายละเอียดอยู่ใน card เดิม ชื่ออาหารแสดงครบ โครงหน้าตั้งทั้งบนมือถือและคอม และความกว้างวันที่/card/CTA ตรงกัน
- Account: avatar/ชื่อ/email/น้ำหนัก/ส่วนสูง/BMI รวมใน profile card เดียว สามเมนูเดิมอยู่ card ถัดไป logout อยู่ท้ายเนื้อหาเป็น action รอง
- Diary: สาม action cards และประวัติกระชับ ปุ่มแก้ไข/ลบอยู่ใกล้ข้อมูล ในมือถือเล็กวางใต้ข้อมูลเพื่อให้ชื่อมีพื้นที่ ไม่ตัดชื่อ/ปริมาณ/kcal/มื้อ

## ไฟล์ที่แก้ในรอบนี้

| ไฟล์ | หน้าที่ |
| --- | --- |
| `src/client/DashboardPanel.tsx` | ย้ายองค์ประกอบภายใน hero |
| `src/client/HealthTrendPanel.tsx` | ลำดับ summary และรูปแบบปุ่มเริ่มบันทึก |
| `src/client/AccountPanel.tsx` | ย้าย metrics เข้า profile card |
| `src/client/styles/mockup-refresh.css` | รูปแบบทั้งสี่หน้า เมนูล่าง และ responsive |
| `e2e/mockup-scope.spec.ts` | ลำดับหน้าจอ ขอบเขต focus พื้นที่กด ภาพ และขนาดการ์ด |
| `e2e/ui-layout.spec.ts` | เปลี่ยนเกณฑ์ desktop จากสองคอลัมน์เป็นแนวตั้งตาม requirement ใหม่ |
| `docs/ui/lifebalance-ui-design-brief.md` | บันทึกข้อกำหนดฉบับล่าสุด |
| เอกสารนี้และ `.local/ui-revision-20261008/index.html` | ผลตรวจและภาพเปรียบเทียบ |

`DiaryPanel.tsx`, `App.tsx` และ API ไม่ได้แก้ในรอบนี้ การจัดหน้าบันทึกใช้ CSS ของ component เดิม

## หลักฐานและผลทดสอบ

- เก็บภาพก่อนแก้ด้วยข้อมูลจำลองเดียวกัน จากนั้นแก้และตรวจภาพตามลำดับ navigation → Progress → Today → Account → Diary ก่อนเริ่มหน้าถัดไป
- ตรวจ **320, 360, 390 และ 1440 px** ไม่พบ horizontal overflow; สี่แท็บกดได้ ปุ่มกราฟ/ใช้มื้อซ้ำอย่างน้อย 44 px ปุ่มบันทึกอาหารและเป้าหมายไม่ถูกเมนูล่างบัง
- ที่ 390 px: quick actions **133.69 → 114 px ลด 14.7%**; history card ของชื่ออาหารยาวชุดทดสอบ **153 → 117.5 px ลด 23.2%** มือถือ 320 px ใช้ layout ปุ่มใต้ข้อมูลเพื่อรักษาความกว้างชื่อ
- Playwright **21 กรณีผ่าน**: scope/layout 3, diary history 3, avatar 3, reliability 8, save flow 3, weight logs 1
- ครอบคลุมบันทึก/แก้ไข/ลบ/ใช้มื้อซ้ำ วันที่ย้อนหลัง บันทึกน้ำหนัก แก้โปรไฟล์/เป้าหมาย รูปโปรไฟล์เพิ่ม/เปลี่ยน/ลบ โหลดรูปกลับ การบันทึกล้มเหลวเก็บ draft และการป้องกันคำตอบ API ที่กลับมาช้า
- TypeScript client/server และ production build ผ่าน; มีคำเตือน bundle ขนาดเดิมและ annotation ของ dependency
- ตรวจ diff: state/effects/การคำนวณ/API ก่อน JSX ของสาม component ตรงกับก่อนแก้ และ handler ใน JSX เดิม; `git diff --check` ผ่าน
- ไม่เพิ่ม route, button หรือ capability; ไม่มี QR/barcode หรือ Settings รวมศูนย์ ไม่มีการสร้างข้อมูลเป้าหมาย macro หรือเปลี่ยนความหมายสีกราฟรายสัปดาห์

[เปิดภาพก่อน/หลังทั้งสี่หน้า](../../.local/ui-revision-20261008/index.html)

| หน้า | ก่อนแก้ 390 px | หลังแก้ 390 px |
| --- | --- | --- |
| วันนี้ | [ภาพ](../../.local/ui-revision-20261008/before/1-390.png) | [ภาพ](../../.local/ui-revision-20261008/after/1-390.png) |
| บันทึก | [ภาพ](../../.local/ui-revision-20261008/before/2-390.png) | [ภาพ](../../.local/ui-revision-20261008/after/2-390.png) |
| ความคืบหน้า | [ภาพ](../../.local/ui-revision-20261008/before/3-390.png) | [ภาพ](../../.local/ui-revision-20261008/after/3-390.png) |
| บัญชี | [ภาพ](../../.local/ui-revision-20261008/before/4-390.png) | [ภาพ](../../.local/ui-revision-20261008/after/4-390.png) |

ข้อจำกัด: ทดสอบในเครื่องด้วย API จำลอง ไม่ใช่การยืนยัน production/Supabase หรือกล้องบนมือถือจริง ไม่เขียนฐานข้อมูลร่วม ไม่มี commit/push/PR/merge/deploy ในรอบนี้ รายงาน desktop สองคอลัมน์จากรอบก่อนถูกแทนที่ด้วยเกณฑ์แนวตั้งตามเอกสารล่าสุด

## ปรับบัญชีเพิ่มตามคำขอถัดมา

- เอาแถวสรุปน้ำหนัก/ส่วนสูง/BMI ที่แสดงซ้ำออก คงข้อมูลครบในปุ่ม “ดูข้อมูลโปรไฟล์” และแบบฟอร์มเดิม ไม่ลบข้อมูลฐานข้อมูล
- ตรวจ HTTP จากเว็บที่ผู้ใช้เปิดอยู่พอร์ต 5173 พบ CSS รวมเดิมยังไม่รวม `mockup-refresh.css` แม้เรียกไฟล์แยกได้ การบันทึก entry stylesheet ให้ Vite ประมวลผลใหม่ทำให้ CSS รวมมี logout/layout/focus overrides ล่าสุดแล้ว
- ความต่างของข้อมูลตัวอย่างและ viewport 390 px ยังมีผลต่อภาพเทียบกับบัญชีจริง แยกจากสาเหตุ CSS ค้างข้างต้น
- Build ผ่าน และทดสอบเฉพาะส่วนที่ได้รับผล **7 กรณีผ่าน**: scope ที่ยืนยันเปิด/ปิดข้อมูลค่าร่างกาย, avatar 3, save flow 3 ตรวจ responsive 320/360/390/1440 px
- [ภาพบัญชีล่าสุด 390 px](../../.local/account-summary-cleanup-20261008/4-390.png) ใช้ข้อมูลจำลอง คำขอนี้แทนที่ข้อกำหนดก่อนหน้าที่ให้แสดง metrics ตลอดเวลาใน profile card
