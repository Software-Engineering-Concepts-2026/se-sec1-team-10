# ผลตรวจเป้าหมายและ catalog วันที่ 6 ตุลาคม 2569

ตรวจโค้ดใน branch `feature/Chayakorn05` สำหรับงานข้อ 1–4 ที่ตกลงกัน: เป้าหมายจาก TDEE, งบอาหารที่ไม่เพิ่มพลังงานออกกำลังกายซ้ำ, การติดตามน้ำหนัก/สรุปรายสัปดาห์ และรายการอาหารอ้างอิงเพิ่มเติม ไม่รวมระบบกู้บัญชีหรือการย้ายรูปไป Supabase Storage

## สิ่งที่เปลี่ยน

- แสดง TDEE และให้เลือกสมดุล ลดน้ำหนัก หรือเพิ่มกล้ามเนื้อ โดยต้องเลือกเพศสำหรับสูตรอย่างชัดเจน ปรับพลังงานเองได้ และ server คำนวณค่าที่แนะนำจากข้อมูลบัญชีเอง
- เป้าหมายเดิมคงเดิมจนผู้ใช้ยืนยันรูปแบบใหม่ ข้อมูลส่วนตัวที่เปลี่ยนจะแสดงคำแนะนำให้คำนวณใหม่ ไม่บันทึกทับอัตโนมัติ
- เป้าหมายรูปแบบใหม่เทียบกับพลังงานอาหาร เพราะ TDEE รวมกิจกรรมแล้ว บัญชีที่ยังใช้เป้าหมายเดิมคงการคิดพลังงานสุทธิ
- กราฟน้ำหนักแสดงจุดเริ่มต้น ปัจจุบัน เป้าหมาย และผลต่าง สรุป 7 วันเทียบกับเป้าหมายปัจจุบัน โดยไม่ถือว่าวันที่ไม่มีบันทึกอาหารเป็นการกินศูนย์
- Catalog เพิ่มจาก 17 เป็น 25 รายการ ข้อมูลใหม่แยกอาหารดิบ/สุกและมีแหล่งอ้างอิง USDA พร้อมคำสั่งเพิ่มเฉพาะรายการที่ยังไม่มี

รายละเอียดสูตรและข้อจำกัดอยู่ใน [คู่มือเป้าหมาย](../goals.md) และแหล่งข้อมูลอาหารอยู่ใน [ตารางอ้างอิง catalog](../food-catalog-sources.md)

## ผลทดสอบ

| การตรวจ | ผล | ขอบเขต |
| --- | --- | --- |
| TypeScript client และ server | ผ่าน | `tsc --noEmit` และ `tsc -p tsconfig.server.json --noEmit` |
| Vitest ทั้งชุด | 107 ผ่าน, 2 ข้าม | 8 test files ผ่าน; 2 ไฟล์ integration ต้องเปิดใช้ฐานทดสอบแยก |
| PostgreSQL integration ที่เปิดแยก | 2 ผ่าน | Lifecycle และ quota ใช้ PostgreSQL ชั่วคราว |
| Migration และ catalog กับ PostgreSQL ชั่วคราว | ผ่าน | Deploy migrations ซ้ำได้; catalog เพิ่ม 25 รายการครั้งแรก และรันซ้ำไม่แก้รายการเดิมหรืออาหาร custom |
| การเก็บเป้าหมายใน JSONB | ผ่าน | เป้าหมายและ session อ่านได้หลังสร้าง Prisma client/app instance ใหม่ |
| Playwright `e2e/goals.spec.ts` | 4 ผ่าน | 320px, 390px และ desktop; การยืนยันเป้าหมาย, legacy/manual, profile เปลี่ยน, ไม่มีเป้าหมาย/ไม่มีบันทึกอาหาร และไม่ล้นแนวนอน |
| ข้อมูลอาหารใหม่ 8 รายการ | ผ่าน | ตรวจ kcal/โปรตีน/คาร์บ/ไขมัน/น้ำตาลจากหน้า record ของ USDA; แก้โปรตีนหมูสันในอบเป็น 26.17 กรัมต่อ 100 กรัม |
| Docker build Linux/amd64 | ผ่าน | Prisma generate, Vite build และ server compile ใน image |
| Docker runtime smoke | 13 กลุ่มผ่าน | Healthcheck, frontend, auth/cookie/origin, TDEE JSONB, กรัมอาหาร, รูปที่บันทึก, summary, AI fallback, session/ข้อมูลหลัง restart |

Unit และ browser tests ตรวจการคำนวณ ค่าที่ไม่ถูกต้อง ข้อมูลที่ client ปลอมมา การแยกบัญชี และการไม่เพิ่มงบออกกำลังกายซ้ำ Browser tests ใช้ API จำลอง; การตรวจฐานจริงและ Linux runtime ใช้ PostgreSQL ชั่วคราวแยกต่างหาก จึงไม่ควรอ้างผล browser tests ว่าเป็นผลทดสอบ Supabase หรือ Render

Image ที่ทดสอบในเครื่อง: `lifebalance:20261006-goals-check`

Manifest digest: `sha256:7c821823b588f556f0e10035cf52be8ca82fdc89ba8b3bf8dd2eabe73776e534`

หลักฐานในเครื่องที่ Git ignore ไว้:

- `.local/goals-check/database-result.json`
- `.local/goals-check/runtime-result.json`
- `.local/goals-check/goals-320.png`
- `.local/goals-check/progress-desktop.png`
- `.local/usda-source-check/catalog-reference-verification-20261006.json`

ชุดทดสอบลบเฉพาะ containers/volumes/network ชั่วคราวของตัวเองเมื่อจบ ไม่เปลี่ยนฐาน Supabase และไม่เรียก AI ภายนอกในรอบนี้

## สถานะการปล่อยรุ่น

โค้ดและ local image ผ่านการตรวจข้างต้น **ยังไม่ได้ push image หรือเปลี่ยนบริการ Render และยังไม่ได้ใช้ migration/catalog update กับ Supabase ของทีม** การตรวจครั้งนี้ไม่ยืนยันฟีเจอร์ใหม่บนเว็บจริง กล้องมือถือจริง หรือการวิเคราะห์ด้วย AI จริง

ก่อนปล่อยต้องตรวจ pending migrations แล้วให้ผู้รับผิดชอบฐานใช้บัญชีที่มีสิทธิ์ DDL รัน `npm run db:migrate` เพื่อเพิ่มคอลัมน์ `User.goalSettings` จาก migration `20261006130000_add_goal_settings` ก่อนเริ่ม server ใหม่ จากนั้นเพิ่มรายการอาหารด้วย `npm run db:catalog:update` และ build/publish image tag ใหม่ตาม [คู่มือ Render](../deployment/render-docker.md) ไม่ต้อง seed ทับฐานร่วม

บน Windows การ generate Prisma ในเครื่องพบ DLL ถูก dev API เดิมล็อก ต้องหยุด API ก่อน `npm run db:generate` ในขั้นตอนอัปเดตเครื่อง ส่วนการ generate ใน Linux Docker image ผ่านแล้ว
