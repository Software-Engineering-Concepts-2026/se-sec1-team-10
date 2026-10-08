# Docker ของ LifeBalance

ไฟล์ [Dockerfile](../Dockerfile) ที่ root ใช้ build และรันเว็บ React กับ API Express สำหรับ production ส่วน `services/stats-service` เป็น Python prototype แยกต่างหากและไม่ได้อยู่ใน image นี้

แนวทาง deploy คือ build image สำหรับ `linux/amd64` บน Docker Desktop, push tag ไปยัง Docker Hub repository แบบ private, แล้วให้ Render รัน image โดยเชื่อมฐานข้อมูล PostgreSQL ที่มีอยู่บน Supabase ผ่าน `DATABASE_URL` ตัว container ไม่ได้เปิดฐานข้อมูล ไม่รัน migration และไม่ seed ข้อมูลเอง ดูขั้นตอนที่ [คู่มือ deploy บน Render](../docs/deployment/render-docker.md)

สำหรับพัฒนาในเครื่อง `compose.yaml` ยังเปิด PostgreSQL local ที่เลือกใช้ได้:

```bash
docker compose up -d db
docker compose ps
docker compose down
```

ถ้าใช้ Supabase ที่ทีมเตรียมไว้ ให้ใช้ค่า environment ของเครื่องและสคริปต์พัฒนาตามปกติ ห้ามสั่ง migration หรือ seed ไปยังฐานข้อมูลร่วมเป็นส่วนหนึ่งของการ build image
