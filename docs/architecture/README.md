# LifeBalance Platform - Architecture Documentation

## โภมาลักษณะ (Overview)

**LifeBalance** เป็นแพลตฟอร์มเว็บแอปพลิเคชันสำหรับการจัดการสุขภาพและสมดุลชีวิต ออกแบบมาเพื่อรองรับผู้ใช้หลักสองกลุ่ม (Personas):

| Persona | ชื่อ | อายุ | อาชีพ | เป้าหมายหลัก |
|---------|------|------|--------|---------------|
| **Corporate Worker** | กรณ์ (Korn) | 32 ปี | Senior Product Manager | ควบคุม BMI 18.5-24.9, ติดตาม Net Calories, Data-driven insights |
| **Postpartum Mother** | พิมพ์ (Pim) | 34 ปี | Freelance Translator / คุณแม่ | ลดน้ำหนักอย่างปลอดภัย (≥0.5 kg/week), สูตร WHO สำหรับคุณแม่ให้นม |

---

## C4 Model Diagrams

### Level 1: System Context Diagram (C1)

แผนภามระดับสูงสุด แสดง **LifeBalance Platform** ในฐานะระบบหลัก พร้อมผู้ใช้และระบบภายนอกที่เกี่ยวข้อง

![C1 System Context](./diagrams/c1-system-context.svg)

**ส่วนประกอบหลัก:**
- **Users (Actors):** กรณ์ (Corporate Worker), พิมพ์ (Postpartum Mother)
- **Our System:** LifeBalance Platform
- **External Systems:** 
  - Health Data APIs (Google Fit / Apple HealthKit)
  - Nutrition Database API (USDA / Open Food Facts)
  - Notification Service (SendGrid / FCM)

#### วิธีการดูไฟล์:
- เปิดไฟล์ `diagrams/c1-system-context.xml` ด้วย [draw.io](https://app.diagrams.net/) (File → Open from → Device)
- หรือ Export เป็น PNG/SVG จาก draw.io

---

### Level 2: Container Diagram (C2)

แผนภามระดับถัดไป ซูมเข้าไปดู **ส่วนประกอบภายใน** ของ LifeBalance Platform

![C2 Container](./diagrams/c2-containers.svg)

**Containers หลักภายในระบบ:**

| Container | Technology | หน้าที่หลัก |
|-----------|------------|--------------|
| **Web Application** | React + Vite | Single-page application สำหรับ User Interface ทั้งหมด |
| **Backend API** | Python / FastAPI | RESTful API สำหรับ Business Logic และ Data Processing |
| **Primary Database** | PostgreSQL | เก็บข้อมูลผู้ใช้, บันทึกอาหาร, ประวัติน้ำหนัก |
| **Cache Layer** | Redis | In-memory cache สำหรับ Session และ Query Optimization |

#### วิธีการดูไฟล์:
- เปิดไฟล์ `diagrams/c2-containers.xml` ด้วย [draw.io](https://app.diagrams.net/) (File → Open from → Device)
- หรือ Export เป็น PNG/SVG จาก draw.io

---

## Architecture Decision Records (ADRs)

บันทึกการตัดสินใจทางสถาปัตยกรรมถูกเก็บไว้ใน `adr/` directory:

| ADR # | Title | Status |
|-------|-------|--------|
| [ADR-001](./adr/0001-tech-stack-selection.md) | Selection of Core Technology Stack | ✅ Accepted |

---

## Directory Structure

```
docs/
└── architecture/
    ├── README.md                 # You are here
    ├── diagrams/
    │   ├── c1-system-context.xml # C4 Level 1: System Context
    │   └── c2-containers.xml     # C4 Level 2: Container View
    └── adr/
        └── 0001-tech-stack-selection.md
```

---

## Quick Start with draw.io

1. เปิด [draw.io](https://app.diagrams.net/)
2. เลือก **File → Open From → Device**
3. เลือกไฟล์ `.xml` ที่ต้องการดู
4. แก้ไขและ Export เป็นรูปแบบที่ต้องการ (PNG, SVG, PDF)

---

*Last Updated: July 21, 2026*
*Project: LifeBalance Platform*
