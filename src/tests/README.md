# Automated testing

โฟลเดอร์นี้เก็บ Vitest unit/API tests ของ LifeBalance รวม shared rules, server routes และโค้ด client ที่ทดสอบโดยไม่ต้องเปิดเบราว์เซอร์ รวมทั้ง Python exercises ของวิชา

- `npm test` รัน Vitest; ใช้ repository/provider จำลอง ไม่ต้องตั้งค่า PostgreSQL หรือ AI key จริง
- Browser regression อยู่ใน `e2e/` และ `e2e-chunks/` ใช้ `npm run test:e2e` และ `npm run test:e2e:chunks`
- Tests กับฐานจริงอยู่ใน `e2e-live/` ใช้ `npm run test:e2e:live` และฐานทดสอบแยกเท่านั้น
- Python tests รันตามคำสั่งใน [CI workflow](../../.github/workflows/ci.yml); ไม่ได้ถูกเรียกโดย `npm test`

ดูรายละเอียดการเตรียมระบบที่ [คู่มือทดสอบ](../../docs/local-testing.md) และ [ดัชนีรายงานผล](../../docs/testing/readme.md) ผล tests ที่ใช้ API จำลองไม่ยืนยันฐานข้อมูลหรือผู้ให้บริการ AI จริง
