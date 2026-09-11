# LifeBalance - Docker

โปรเจกต์ปัจจุบันใช้ไฟล์ `compose.yaml` ที่ root เพื่อเปิด PostgreSQL สำหรับการพัฒนาในเครื่อง

```bash
docker compose up -d db
```

ตรวจสอบสถานะหรือปิดฐานข้อมูลได้ด้วยคำสั่งต่อไปนี้

```bash
docker compose ps
docker compose down
```

โฟลเดอร์ `services/stats-service` เป็น prototype จากงาน Lab เดิมที่ใช้ Python + FastAPI และไม่ได้เป็น backend หลักของระบบปัจจุบัน Backend หลักอยู่ใน `src/server` และใช้ Node.js + Express + TypeScript
