# Deploy LifeBalance บน Render ด้วย Docker image

วิธีหลักใช้ GitHub Actions build image หลัง CI ผ่าน ส่งไป Docker Hub แล้วให้ Render รัน image ตาม digest โดยมี Supabase ให้บริการ PostgreSQL แยกจาก application container คู่มือนี้อธิบายการ build/push ด้วย Docker Desktop บนเครื่องนักพัฒนาเป็นวิธีสำรอง container ไม่ migrate หรือ seed ฐานข้อมูลตอนเริ่มทำงาน

คู่มือนี้เป็นขั้นตอน manual ที่ยังใช้เป็นแผนสำรองได้ ส่วน workflow สำหรับ build/push/deploy จาก `main` หลัง CI ผ่าน และสถานะการเปิดใช้งาน อยู่ที่ [Continuous deployment](continuous-deployment.md)

เอกสาร [รายงาน Docker วันที่ 6 ตุลาคม 2026](docker-check-2026-10-06.md), [บันทึก release วันที่ 8 ตุลาคม 2026](release-2026-10-08.md) และ [รายงาน readiness วันที่ 8 ตุลาคม 2026](readiness-2026-10-08.md) เป็นหลักฐานย้อนหลังของการตรวจและ release ในวันดังกล่าว ไม่ยืนยันสถานะ production ปัจจุบัน; ให้ตรวจสถานะ service และฐานข้อมูลจริงก่อนดำเนินการ deploy ครั้งใหม่

## 1. Build และ push image

เปิด PowerShell หรือ terminal ที่ใช้คำสั่ง `docker` ได้ แล้วเลือก tag ใหม่ทุกครั้ง เช่นเลขเวอร์ชันหรือ Git commit สั้น ๆ:

```powershell
docker login
$releaseRevision = git rev-parse HEAD
docker buildx build --platform linux/amd64 --build-arg VCS_REF=$releaseRevision -t docker.io/chayakorn7777/lifebalance:<version> --push .
```

แทน `<version>` ด้วย tag ของ release เช่น `0.2.0` หรือ `a1b2c3d` โดย tag ช่วยระบุรุ่นที่ต้องการ แต่ Docker Hub อาจอนุญาตให้เขียนทับ tag ได้ ให้เก็บ tag รุ่นก่อนหน้าที่ยังใช้งานได้ หรือบันทึก image digest ไว้สำหรับ rollback

ใช้ working tree ที่สะอาดและ commit ที่ผ่านการตรวจแล้วก่อน build เพื่อให้ `VCS_REF` ตรงกับโค้ดใน image การใส่ SHA ไม่ได้ทดแทน CI และไม่ทำให้โค้ดที่ยังไม่ commit กลายเป็นส่วนของ commit นั้น หากไม่ส่ง `VCS_REF` ค่า `/release.json` จะเป็น `unknown` และใช้ยืนยันรุ่นแบบ CD ไม่ได้

Dockerfile ใช้ Node 22 บน Debian, ติดตั้ง OpenSSL สำหรับ Prisma, build หน้าเว็บและ API พร้อมสร้าง Prisma engine สำหรับ Linux จากนั้นรันด้วย user ที่ไม่มีสิทธิ์ root ตัวแอปรับ traffic ที่ `0.0.0.0:10000` และ health check เรียก `/api/health`

## 2. ตั้งค่า Render

สร้าง Web Service โดยเลือกใช้ image ที่มีอยู่ (Existing Image) แล้วใส่ image reference:

```text
docker.io/chayakorn7777/lifebalance:<version>
```

สำหรับบริการ LifeBalance เดิม ไม่ต้องสร้าง service ใหม่: เปิด **Settings → Build → Source → Edit → Existing Image** และตรวจว่าใช้ repository `chayakorn7777/lifebalance` เดิม ให้ CD ระบุ digest ของ release หลัง CI ผ่าน; การกด Manual Deploy ไม่ได้รัน CI

สำหรับ private image ให้เพิ่ม Docker registry credential บน Render โดยใช้ Docker Hub username `chayakorn7777` และ Docker Hub personal access token ที่มีสิทธิ์อ่าน image ส่วนตัว Token นี้ผูกกับบัญชี Docker Hub และอาจให้สิทธิ์กับ repository อื่นตามสิทธิ์ของบัญชีด้วย ให้เก็บ token ในหน้าตั้งค่า credential ของ Render เท่านั้น ห้ามใส่ใน Git, Dockerfile, image หรือคำสั่งที่บันทึกไว้ใน shell history

เลือก Instance Type เป็น **Free** และเลือก region ใกล้กับ Supabase ที่ใช้งานอยู่ ไม่ต้องสร้าง PostgreSQL บน Render เพิ่ม แผน Free อาจพักบริการเมื่อไม่มีการใช้งาน ทำให้คำขอแรกหลังพักตอบช้ากว่าปกติ

กำหนด environment variables ต่อไปนี้ใน Render:

| ชื่อ | ค่า |
| --- | --- |
| `DATABASE_URL` | connection string ของ Supabase PostgreSQL สำหรับ database role ของแอป |
| `JWT_SECRET` | secret ที่สุ่มขึ้นมา ความยาวอย่างน้อย 32 ตัวอักษร |
| `APP_ORIGIN` | origin HTTPS จริงที่ผู้ใช้จะเปิด เช่น `https://lifebalance.example.com` |
| `NODE_ENV` | `production` |
| `HOST` | `0.0.0.0` |
| `PORT` | `10000` |
| `TRUST_PROXY_HOPS` | `1` (Render Web Service proxy) |

Set `TRUST_PROXY_HOPS=1` for this Render Web Service so Express can safely use the client IP forwarded by Render (including for rate limits). The app leaves proxy trust disabled when this variable is absent; do not set it to `true`, and adjust the hop count only when the actual proxy chain is known.

ตั้ง health check path เป็น `/api/health` หาก Render แสดงช่องให้กำหนด เพิ่ม `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TIMEOUT_MS`, `AI_DAILY_SCAN_LIMIT` และ `NUTRITION_API_KEY` เฉพาะเมื่อเปิดใช้บริการเหล่านั้น แล้วเก็บ credential ใน environment settings ของ Render

`APP_ORIGIN` ต้องเป็น HTTPS origin จริง ไม่มี path เช่น `/app` ให้ตั้งให้ตรงกับ URL ที่ผู้ใช้เปิด ตัว server จะไม่เริ่มทำงานใน production หากค่านี้ไม่ใช่ HTTPS origin

ถ้า URL ของ Render ยังไม่ปรากฏก่อนสร้าง service ให้ใส่ placeholder HTTPS origin ชั่วคราวเพื่อบันทึก/สร้าง service ก่อน เมื่อ Render แสดง URL จริงแล้ว ให้กลับมาเปลี่ยน `APP_ORIGIN` เป็น URL นั้นและ deploy ใหม่ก่อนทดสอบการใช้งาน อย่าทดสอบ login หรือประกาศว่า deploy พร้อมใช้งานขณะที่ยังเป็น placeholder หากจะใช้ custom domain ให้ตั้งค่า domain และ HTTPS บน Render ก่อน แล้วใส่ origin ของ domain นั้น

## 3. เตรียมฐานข้อมูล

Render เชื่อม Supabase ผ่าน `DATABASE_URL` ตรวจให้แน่ใจว่า schema ที่ release นี้ต้องใช้มีอยู่แล้วก่อนเปลี่ยน image ขั้นตอนนี้ไม่รัน `prisma migrate deploy` หรือ seed ให้อัตโนมัติ ให้ตรวจทานและทำ migration แยกเป็นการเปลี่ยนแปลงฐานข้อมูลโดยชัดเจน ห้ามใช้ฐานข้อมูลร่วมของทีมเป็นฐานข้อมูลทดสอบ Docker

## 4. ทดสอบ image ในเครื่อง

เปิด Docker Desktop แล้ว build โดยไม่ push ขึ้น registry:

```powershell
docker buildx build --platform linux/amd64 -t lifebalance:local --load .
```

เตรียมค่า environment สำหรับทดสอบโดยใช้ฐานข้อมูล PostgreSQL ชั่วคราวที่ลบทิ้งได้และ `JWT_SECRET` สำหรับทดสอบ ห้ามใช้ credential ของ Supabase ที่ใช้ร่วมกัน คำสั่งรัน image คือ:

```powershell
docker run --rm --env-file .local/docker-test.env -p 127.0.0.1:10000:10000 lifebalance:local
```

ไฟล์ `.local/docker-test.env` เป็นไฟล์ค่าทดสอบในเครื่อง ให้ผู้ทดสอบสร้างและเก็บไว้ใน `.local` เอง อย่า commit หรือส่งไฟล์นี้ให้ผู้อื่น ตรวจ health endpoint ได้ที่ `http://localhost:10000/api/health` คำสั่งนี้เผยพอร์ตให้เข้าถึงได้เฉพาะเครื่องตัวเอง

การทดสอบผ่าน HTTP ในเครื่องเหมาะกับ health endpoint และ API smoke check เท่านั้น Cookie สำหรับ session ตั้งค่า `Secure` ใน production ดังนั้นการทดสอบ login ผ่าน browser ต้องใช้ HTTPS จึงจะยืนยันการทำงานของ cookie ได้

## 5. ปล่อยรุ่นใหม่และ rollback

สำหรับรุ่นใหม่ ให้ build และ push ด้วย tag ใหม่ แล้วเปลี่ยน image ที่ Render ใช้เป็น tag นั้นก่อน deploy เก็บ tag หรือ digest ของรุ่นก่อนหน้าไว้ หากต้อง rollback ให้ตั้ง Render กลับไปใช้ image รุ่นก่อนหน้าแล้ว deploy ใหม่ หลัง deploy ตรวจสถานะ health และ logs ของ Render รวมทั้งหน้าเว็บและ `/api/health` การตอบกลับของ health check ยืนยันเพียงว่า HTTP endpoint ตอบได้ ยังไม่ยืนยันการเชื่อมต่อ Supabase หรือ user flow ใน production

ใช้การ deploy จาก existing image ตามคู่มือนี้ เพื่อให้ compile และสร้าง Prisma engine ใน Docker build ฝั่งเครื่องนักพัฒนา ไม่ต้องตั้ง Render source build หรือ cloud build เพิ่ม หากเพิ่งติดตั้ง Docker Desktop แล้ว terminal ยังไม่รู้จักคำสั่ง `docker` ให้เปิด terminal ใหม่เพื่อลองใช้ PATH ที่ติดตั้งเพิ่ม
