# ผลตรวจ Docker ก่อน deploy — 6 ตุลาคม 2026

สาขาที่เตรียมโค้ด: `feature/Chayakorn05` ใช้โค้ด LifeBalance ที่รวมอยู่ใน checkout นี้พร้อมการปรับ runtime/Docker ครั้งนี้ ผลตรวจนี้ยังไม่ใช่ผลทดสอบ Render หรือมือถือจริง

Image: `docker.io/chayakorn7777/lifebalance:20261006-docker-1` สำหรับ `linux/amd64`

อัปโหลดสำเร็จไปยัง private Docker Hub repository แล้ว Registry digest: `sha256:121716dc433fcb9b73b8f6486d57de13efd284d55707b86180e37185443e13cb` การอัปโหลด image ครั้งนี้ไม่ได้ทำ Git commit/push และยังไม่ได้สร้าง deployment บน Render

## ผลตรวจที่ผ่าน

- Build React และ TypeScript server ใน Linux; Prisma Client 6.12.0 สร้าง engine ภายใน Linux build
- Runtime เป็น user `node` และไม่มี `.env`, `.git`, `.local` หรือโฟลเดอร์ seed ซ้ำใน `/app`
- ตรวจ production dependencies จริงใน image: `ip-address` 10.7.3 และ `proxy-addr` 2.0.8; production audit ไม่มีช่องโหว่ที่รายงาน ณ เวลาตรวจ
- ชุด Docker smoke 11 กลุ่มผ่าน: platform/non-root/configured-secret checks, production origin validation, migration ของฐานข้อมูลชั่วคราว, startup โดยไม่มี `.env`, static assets/SPA/API 404, runtime file exclusions, authentication/CSRF/Secure cookies, บันทึกรูปและคำนวณสารอาหารจากกรัม, AI-disabled fallback, restart/session/logout และ healthcheck เมื่อเปลี่ยน `PORT`
- สมัคร/ล็อกอิน ตรวจ session และบันทึกอาหารใน PostgreSQL ชั่วคราว: 200 กรัมได้ 260 kcal แก้เหลือ 100 กรัมได้ 130 kcal; รูปกลับมาในประวัติ และข้อมูลยังอยู่หลัง restart container
- ตรวจ Supabase จริงแยกจาก smoke ด้วย `SELECT 1` และ metadata ของตาราง `User`, `MealLog`, `MealIngredient`, `Session`, `Food`, `ExerciseLog`, `WeightLog` สำเร็จจาก image รุ่นสุดท้าย ไม่มีการเขียน migrate หรือ seed บน Supabase
- ลบ container, volume และ network ที่สร้างเพื่อ smoke test แล้ว ไม่แตะ container PostgreSQL เดิมของทีม

ผลของ auth-profile unit tests 35 เคสผ่านบน dependencies เดิมในเครื่อง จึงไม่นับเป็นการทดสอบ dependencies รุ่นใหม่; หลักฐานการทำงานของรุ่นใหม่มาจาก Docker smoke และการตรวจรุ่น package ใน image โดยตรง

## ขอบเขตและสิ่งที่เหลือ

- ยังมี audit ระดับ high ของ `source-map-js` 1.2.1 ในเครื่องมือ build/dev (รุ่นแก้เริ่ม 1.2.2) ไม่อยู่ใน production dependencies ของ runtime image ต้องติดตามแก้ฝั่งเครื่องมือพัฒนาแยกต่างหาก
- รอบ Docker นี้ไม่ได้เรียก AI จริง จึงไม่ใช้โควตา AI; ทดสอบเฉพาะ fallback เมื่อไม่มี provider
- ทดสอบ cookie flags และ session ด้วย HTTP API harness ที่ส่ง cookie เอง ยังไม่ยืนยัน browser login ผ่าน HTTPS บน Render
- ต้องตรวจ environment ของ Render, HTTPS login, กล้องบนมือถือ, AI จริง และการบันทึก/เปิดประวัติหลัง deploy ก่อนสรุปว่าระบบออนไลน์ใช้งานได้
- `/api/health` เป็น HTTP liveness check; ผลตรวจ query Supabase และ user flows เป็นหลักฐานอีกส่วนหนึ่ง

หลักฐานละเอียดในเครื่องอยู่ใน `.local/docker-deploy-smoke-result.json` และ `.local/docker-supabase-readonly-result.json` ไฟล์เหล่านี้ไม่อยู่ใน Git หรือ image และไม่มีค่า credentials
