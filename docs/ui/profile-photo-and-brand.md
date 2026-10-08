# รูปโปรไฟล์และโลโก้ LifeBalance

## การใช้งาน

ในหน้าบัญชี เลือกเพิ่มหรือเปลี่ยนรูป แล้วตรวจตัวอย่างก่อนกดบันทึกรูปโปรไฟล์ รูปจะถูกครอปตรงกลางเป็นสี่เหลี่ยมและย่อให้เหมาะกับไอคอนผู้ใช้ รองรับ JPEG, PNG และ WebP ขนาดไฟล์ต้นฉบับไม่เกิน 5 MB การลบรูปไม่ลบบัญชีหรือข้อมูลสุขภาพ และกลับไปใช้ตัวอักษรแรกของชื่อแทน

รูปบันทึกกับบัญชีผ่าน `PUT /api/profile/avatar` ผู้ใช้แก้ได้เฉพาะรูปของตนเอง ข้อมูลเก็บใน `User.avatarImageData` เป็น data URL ขนาดจำกัด ไม่ใช่ไฟล์ใน Supabase Storage การแก้รูปไม่สร้างรายการน้ำหนักใหม่

ชื่อ อายุ น้ำหนัก และส่วนสูงยังแก้และบันทึกได้ในเมนูข้อมูลส่วนตัวตามเดิม

## ฐานข้อมูลก่อนใช้งานจริง

มี migration เพิ่มคอลัมน์ nullable เพียงคอลัมน์เดียว: `prisma/migrations/20261007100000_add_profile_avatar/migration.sql` บัญชีเดิมจะไม่มีรูปจนกว่าจะเพิ่มเอง

ต้องตรวจและใช้ migration นี้กับฐานข้อมูลปลายทางก่อนเริ่ม server ที่ generate Prisma Client รุ่นใหม่ โดยใช้บัญชีที่มีสิทธิ์แก้ schema การ build Docker ไม่รัน migration ให้อัตโนมัติ ห้าม seed ซ้ำบนฐานข้อมูลร่วมเพื่อเปิดใช้ฟีเจอร์นี้

วันที่ 7 ตุลาคม 2026 ผู้ใช้เพิ่ม `avatarImageData` และ `goalSettings` ผ่าน Supabase SQL Editor แล้ว ตรวจแบบอ่านอย่างเดียวจากบัญชีแอปใน `.env` ยืนยันว่าทั้งสองคอลัมน์มีอยู่จริง และมีสิทธิ์ SELECT/UPDATE ครบ ใน database postgres, schema public ของ Project ahhfiwqhfutaxeulgxnd ยังต้องตรวจว่า Render ใช้ฐานข้อมูลเดียวกันก่อนนำผลนี้ไปอ้างกับ production

เจ้าของฐานข้อมูลสามารถใช้ SQL Editor ใน Supabase เพิ่มคอลัมน์นี้โดยไม่ลบหรือ seed ข้อมูลเดิม:

```sql
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "avatarImageData" TEXT;
ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "goalSettings" JSONB;
```

สำหรับฐานข้อมูลที่ใช้ Prisma migrations อยู่แล้ว ให้เจ้าของตรวจรายการ migration ค้างก่อนใช้คำสั่งต่อไปนี้ และอย่ารัน SQL ข้างต้นซ้ำกับ migration ที่ยังไม่ได้บันทึกสถานะ:

```sh
npm run db:migrate
npm run db:generate
```

เอกสารนี้ไม่ยืนยันว่า migration ถูกใช้กับ Supabase หรือว่า Render ถูก deploy แล้ว ผลทดสอบด้วยฐานข้อมูลจำลองไม่แทนการตรวจฐานข้อมูลจริง

หาก `prisma generate` แจ้ง `EPERM` ที่ไฟล์ `query_engine-windows.dll.node` บน Windows ให้ปิด dev server ของโปรเจกต์ก่อน แล้ว generate และเปิด server ใหม่ มีไฟล์ที่โปรแกรมเดิมใช้งานอยู่ ไม่ใช่ปัญหารหัสผ่านฐานข้อมูล

Dockerfile สร้าง Prisma Client สำหรับ Linux ใน image เอง ปัญหา DLL ใน Windows จึงไม่ใช่ตัวขวาง Render หาก build image ใหม่ผ่านแล้ว แต่ฐานข้อมูลปลายทางยังต้องมีทั้งสองคอลัมน์ก่อนเปลี่ยน image

## โลโก้

`public/brand/lifebalance-mark.svg` วาดเป็นเวกเตอร์ตามภาพอ้างอิงของผู้ใช้: รูปคนในวงแหวนสีเขียวและจุดรอบวง พื้นหลังโปร่งใส ใช้ในหน้าล็อกอิน สมัครสมาชิก หน้ารอเชื่อมต่อ และ favicon ส่วนชื่อแบรนด์ใช้ Life สีเขียวและ Balance สีเข้ม รูปต้นฉบับไม่ถูกแก้หรือเขียนทับ
