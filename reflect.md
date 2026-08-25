# Architectural Reflections (Post-Quiz 5)

## B1. Apply — ADR ฉบับแรก
- **Context:** ทีม LifeBalance มีขนาดเล็กและมีเวลาพัฒนาจำกัดในแต่ละ Sprint ต้องการส่งมอบฟังก์ชัน Food Logging และ Dashboard ให้เร็วที่สุด โดยไม่ต้องการสร้างภาระด้าน Infrastructure และการจัดการ Distributed Network
- **Decision:** เลือกสถาปัตยกรรมแบบ **Modular Monolith** สำหรับการพัฒนา Backend ในช่วงแรก แทนการใช้ Microservices
- **Consequences (1+1):**
  - *(+1 ข้อดี):* การพัฒนา การทดสอบ (Testing) และการ Deploy ไม่ซับซ้อน สามารถจัดการ Database Transactions ได้แบบรวมศูนย์
  - *(-1 ข้อเสีย/ข้อจำกัด):* ไม่สามารถแยก Scale เฉพาะบางโมดูลที่มีปริมาณการใช้งานสูงได้อย่างอิสระ

---

## B2. Connect — C4 Context + Container

### 1. C4 Context (Level 1)
```mermaid
C4Context
    title System Context diagram for LifeBalance System

    Person(user, "User / Office Worker", "ผู้ใช้งานทั่วไปที่ต้องการติดตามสุขภาพและบันทึกอาหาร")
    System(lifebalance, "LifeBalance System", "ระบบสำหรับบันทึกมื้ออาหาร คำนวณแคลอรี่ และติดตามเป้าหมายสุขภาพ")

    Rel(user, lifebalance, "เข้าใช้งาน บันทึกอาหาร และดูสถิติสุขภาพ", "HTTPS")
```

### 2. C4 Container (Level 2)
```mermaid
C4Container
    title Container diagram for LifeBalance System

    Person(user, "User / Office Worker", "ผู้ใช้งานผ่านเว็บบราวเซอร์")

    Container_Boundary(c1, "LifeBalance System") {
        Container(spa, "Single-Page Application", "React, TypeScript", "หน้า UI แบบ Mobile-first สำหรับบันทึกอาหารและแสดงผลกราฟ")
        Container(api, "Backend API Application", "Node.js, Express, TypeScript", "ประมวลผล Business Logic, คำนวณสารอาหาร และจัดการ REST Endpoints")
        ContainerDb(db, "Database", "PostgreSQL", "จัดเก็บข้อมูลผู้ใช้ บันทึกอาหาร และข้อมูลโภชนาการ")
    }

    Rel(user, spa, "เข้าใช้งาน", "HTTPS")
    Rel(spa, api, "เรียกใช้งาน API และรับส่งข้อมูล", "JSON/HTTPS")
    Rel(api, db, "อ่านและเขียนข้อมูล", "SQL/Prisma TCP (Port 5432)")
```

---

## B3. Reflect — Tech Stack
- **Frontend (React + TypeScript):** เลือก React เพราะโครงสร้างแบบ Component-based ช่วยให้พัฒนาหน้า Mobile-first UI ที่มีการอัปเดต State บ่อย (เช่น การคำนวณแคลอรี่แบบ Real-time) ได้ลื่นไหลและจัดการโค้ดได้เป็นระบบ
- **Backend (Node.js + Express):** เลือก Node.js เพราะการทำงานแบบ Non-blocking I/O มีประสิทธิภาพสูงในการรับส่งข้อมูล JSON ขนาดเล็กผ่าน REST API และช่วยให้ทีมสามารถใช้ภาษา TypeScript ร่วมกันได้ทั้งหน้าบ้านและหลังบ้าน
- **Database (PostgreSQL):** เลือก PostgreSQL เพราะข้อมูลโภชนาการและบันทึกอาหารต้องการความถูกต้องของโครงสร้างและความสัมพันธ์ (Relational Integrity) สูง ป้องกันปัญหาข้อมูลสูญหายหรือไม่สอดคล้องกัน