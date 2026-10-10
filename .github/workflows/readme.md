# Continuous integration

[ci.yml](ci.yml) ทำงานเมื่อเปิด/อัปเดต pull request และเมื่อ push เข้า `main`:

- `lint`: Python 3.12 และ Ruff
- `test`: Python tests พร้อม branch coverage ขั้นต่ำ 90% เฉพาะโมดูลที่ workflow ระบุ และเก็บ coverage report
- `javascript`: Node.js 22.12, build/typecheck, coverage รวม unit + Playwright Chromium ผ่าน `npm run test:coverage:all` (ทั้งแอปขั้นต่ำ 60%, core business logic 80%), deployment verifier tests และ lazy chunk recovery tests
- `performance`: build production Docker image แล้ววัด API กับ PostgreSQL ชั่วคราว ผู้ใช้จำลอง 100 คน ไม่มีการเขียนข้อมูลจริง เก็บผลเป็น artifact
- `deploy`: เฉพาะ push เข้า `main` หลังทั้งสี่ jobs ข้างต้นผ่าน และตั้ง `CD_ENABLED=true`; build/push image ไป Docker Hub แล้วส่ง immutable digest ไป Render พร้อมตรวจ revision, health และ hash ของไฟล์เว็บ

Browser tests ใช้ API จำลอง ไม่ใช้ฐานข้อมูลหรือโควตา AI จริง ชุด `test:e2e:live` ไม่รันใน CI

การเปิดใช้งาน CD ต้องตั้ง repository secrets ก่อน ดู [คู่มือ Continuous deployment](../../docs/deployment/continuous-deployment.md) หากยังไม่ตั้ง flag/secrets จะมีเฉพาะ CI และ performance checks ส่วน [คู่มือ Docker/Render](../../docs/deployment/render-docker.md) เป็นขั้นตอน manual สำรอง การมี workflow ในโค้ดไม่ใช่หลักฐานว่า CD ทำงานจริงแล้ว ต้องเก็บ successful main run หลังเปิดใช้งานด้วย
