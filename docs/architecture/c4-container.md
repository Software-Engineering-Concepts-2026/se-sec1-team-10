# C4 Model - Level 2: Container Diagram

ไดอะแกรมแสดงสถาปัตยกรรมระดับ Container ของระบบ **LifeBalance** รวมถึงเทคโนโลยีและโปรโตคอลที่ใช้สื่อสาร

```mermaid
C4Container
    title Container diagram for LifeBalance System

    Person(user, "User / Office Worker", "ผู้ใช้งานผ่านเว็บบราวเซอร์บนมือถือหรือคอมพิวเตอร์")

    Container_Boundary(c1, "LifeBalance System") {
        Container(spa, "Single-Page Application", "React, TypeScript, Vite", "ให้บริการ UI แบบ Mobile-first เพื่อให้ผู้ใช้กรอกข้อมูลอาหารและดู Dashboard")
        Container(api, "Backend API Application", "Node.js, Express, TypeScript", "จัดการ Business Logic, การคำนวณสารอาหาร, การยืนยันตัวตน และ REST Endpoints")
        ContainerDb(db, "Database", "PostgreSQL", "จัดเก็บข้อมูลผู้ใช้ (Users), บันทึกมื้ออาหาร (Food Logs), และวัตถุดิบ (Ingredients)")
    }

    System_Ext(oauth, "Google OAuth", "บริการยืนยันตัวตนผู้ใช้งาน")

    Rel(user, spa, "เข้าใช้งาน", "HTTPS")
    Rel(spa, api, "เรียกใช้งาน API และรับส่งข้อมูล", "JSON/HTTPS")
    Rel(api, db, "อ่านและเขียนข้อมูล", "SQL/Prisma TCP (Port 5432)")
    Rel(api, oauth, "ตรวจสอบ Token ผู้ใช้งาน", "HTTPS/REST")