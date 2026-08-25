# C4 Model - Level 2: Container Diagram

## Diagram
```mermaid
C4Container
    title Container Diagram - LifeBalance System

    Person(user, "Office Worker / User", "ผู้ใช้งานผ่านเว็บบราวเซอร์ (Mobile/Desktop)")

    Container_Boundary(c1, "LifeBalance System Boundary") {
        Container(spa, "Single-Page Application", "React, TypeScript, Tailwind CSS", "หน้าเว็บ UI แบบ Mobile-first สำหรับบันทึกอาหารและแสดงผลกราฟ")
        Container(api, "Backend API Application", "Node.js, Express, TypeScript", "จัดการ Business Logic, REST API Endpoints, และคำนวณโภชนาการ")
        ContainerDb(db, "Database", "PostgreSQL", "จัดเก็บข้อมูลบัญชีผู้ใช้ บันทึกมื้ออาหาร และค่าสารอาหาร")
    }

    Rel(user, spa, "เข้าใช้งาน", "HTTPS")
    Rel(spa, api, "รับส่งข้อมูลผ่าน REST API", "JSON/HTTPS")
    Rel(api, db, "อ่านและเขียนข้อมูล", "SQL via Prisma TCP (Port 5432)")