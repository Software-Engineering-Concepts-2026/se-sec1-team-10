# Continuous integration

[ci.yml](ci.yml) ทำงานเมื่อเปิด/อัปเดต pull request และเมื่อ push เข้า `main` โดยแบ่งเป็นสาม jobs:

- `lint`: Python 3.12 และ Ruff
- `test`: Python tests พร้อม branch coverage ขั้นต่ำ 90% เฉพาะโมดูลที่ workflow ระบุ และเก็บ coverage report
- `javascript`: Node.js 22.12, `npm ci`, `npm run build`, `npm test`, Playwright Chromium, `npm run test:e2e` และ `npm run test:e2e:chunks`

Browser tests ใช้ API จำลอง ไม่ใช้ฐานข้อมูลหรือโควตา AI จริง ชุด `test:e2e:live` ไม่รันใน CI

Workflow นี้ตรวจคุณภาพโค้ดเท่านั้น ไม่มี job build/push Docker image หรือ deploy Render การเผยแพร่ทำตาม [คู่มือ Docker/Render](../../docs/deployment/render-docker.md)
