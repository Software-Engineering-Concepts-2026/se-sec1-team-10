# Docker ของ LifeBalance

ไฟล์ [Dockerfile](../Dockerfile) ที่ root ใช้ build และรันเว็บ React กับ API Express สำหรับ production ส่วน `services/stats-service` เป็น Python prototype แยกต่างหากและไม่ได้อยู่ใน image นี้

วิธี deploy หลักคือให้ GitHub Actions รอ CI ของ `main` ผ่าน แล้ว build image สำหรับ `linux/amd64`, push ไป Docker Hub และสั่ง Render ใช้ immutable digest พร้อมตรวจ revision, health และ hash ไฟล์เว็บ ดู [คู่มือ CD และหลักฐาน](../docs/deployment/continuous-deployment.md)

การ build/push ด้วย Docker Desktop เป็นวิธีสำรองตาม [คู่มือ manual บน Render](../docs/deployment/render-docker.md) ฐานข้อมูล PostgreSQL บน Supabase แยกจาก application container และเชื่อมผ่าน `DATABASE_URL` ตัว container ไม่รัน migration หรือ seed เอง

สำหรับพัฒนาในเครื่อง `compose.yaml` ยังเปิด PostgreSQL local ที่เลือกใช้ได้:

```bash
docker compose up -d db
docker compose ps
docker compose down
```

ถ้าใช้ Supabase ที่ทีมเตรียมไว้ ให้ใช้ค่า environment ของเครื่องและสคริปต์พัฒนาตามปกติ ห้ามสั่ง migration หรือ seed ไปยังฐานข้อมูลร่วมเป็นส่วนหนึ่งของการ build image
