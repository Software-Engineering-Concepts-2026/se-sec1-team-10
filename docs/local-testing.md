# ทดสอบ LifeBalance บนเครื่องนี้

ตอนนี้เปิดแอปที่ http://127.0.0.1:5173 ได้ โดยใช้ PostgreSQL จริงบน localhost:5432 และฐานข้อมูล lifebalance

## เปิดอีกครั้งหลังปิดเครื่อง

```sh
npm run db:local
npm run dev
```

คำสั่ง db:local ใช้ PostgreSQL แบบพกพาที่เตรียมไว้ใน `.local/postgresql` และข้อมูลใน `.local/postgresql-data` ของเครื่องนี้ โฟลเดอร์เหล่านี้ไม่ส่งขึ้น Git และไม่ใช่สิ่งที่เครื่องเพื่อนจะได้จากการ clone

เครื่องอื่นให้ใช้ `docker compose up -d db` ตาม docker/README.md ตั้ง DATABASE_URL ใน .env แล้วรัน `npm run db:generate` และ `npm run db:migrate` ก่อนเปิดแอป หากอัปเดตโค้ดที่มี migration ใหม่ เครื่องนี้ก็ต้องรัน db:migrate เช่นกัน

หยุดฐานข้อมูลแบบพกพาด้วย `npm run db:local:stop` หลังหยุด API ไม่ต้องลบโฟลเดอร์ข้อมูล

PostgreSQL แบบพกพาดาวน์โหลดจาก [EDB](https://www.enterprisedb.com/download-postgresql-binaries) ซึ่งเป็นแหล่ง Windows binaries ที่ [PostgreSQL แนะนำ](https://www.postgresql.org/download/windows/) และตั้งให้รับเฉพาะการเชื่อมต่อภายในเครื่อง

## การทดสอบ

- `npm test`: ชุดทดสอบปกติ ไม่ต้องมีฐานข้อมูล
- `npm run test:e2e`: เบราว์เซอร์กับ API จำลอง
- `npm run test:e2e:live`: เบราว์เซอร์กับฐานข้อมูลจริง ต้องเปิด API และเว็บบน 127.0.0.1:5173 ก่อน ชุดทดสอบสร้างบัญชีสุ่มและลบเฉพาะบัญชีนั้นเมื่อจบ
- การทดสอบฐานข้อมูลจริง: ตั้ง TEST_DATABASE_URL ให้ชี้ฐานข้อมูลทดสอบที่ลง migration แล้ว จากนั้นรัน npm test ทั้งชุด บัญชีทดสอบใช้ชื่อสุ่มและลบเฉพาะบัญชีที่ทดสอบสร้างขึ้น

อย่าเผยแพร่ .env หรือใส่ key จริงใน .env.example รูปทดสอบและผลจาก AI ที่อยู่ใน .local ไม่ถูก commit
