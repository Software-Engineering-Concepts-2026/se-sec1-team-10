# 0001. Architecture Pattern: Modular Monolith vs. Microservices

- **Status:** Accepted
- **Date:** 2026-08-07
- **Deciders:** ทีมพัฒนา LifeBalance

## 1. Context
ระบบ LifeBalance อยู่ในช่วงเริ่มต้นของการพัฒนา (Sprint 1-2) โดยมีฟีเจอร์หลักคือ Food Logging และ Health Dashboard ทีมพัฒนาเป็นทีมขนาดเล็ก ทรัพยากรและเวลาในการพัฒนาจำกัด การเลือก Architecture ต้องเอื้อต่อการส่งมอบฟังก์ชันที่รวดเร็ว ไม่เพิ่มความซับซ้อนด้าน Network, Service Discovery และ Infrastructure

## 2. Decision
เราตัดสินใจเลือกสถาปัตยกรรมแบบ **Modular Monolith** (Single Backend Application ที่แบ่งโครงสร้างโฟลเดอร์ตาม Domain/Feature โมดูลอย่างชัดเจน) แทนการใช้ Microservices

## 3. Consequences
### ข้อดี (Positive Consequences):
- ลดความซับซ้อนในการ Setup, Development, Testing และ CI/CD Pipeline
- การสื่อสารระหว่างโมดูลเกิดขึ้นภายใน Memory เดียวกัน (In-process call) รวดเร็วและไม่มี Network latency
- รองรับการทำ Database Transactions (ACID) ได้สมบูรณ์ในก้อนเดียว
- สามารถ Migrate ไปเป็น Microservices ในอนาคตได้ง่าย หากแต่ละโมดูลถูกออกแบบให้ Loose-coupling ไว้ตั้งแต่แรก

### ข้อจำกัดและผลกระทบ (Negative Consequences):
- ไม่สามารถ Scale แยกเฉพาะบางโมดูลที่มี Traffic สูงได้
- หากส่วนใดส่วนหนึ่งของ Application ล่ม อาจส่งผลกระทบต่อทั้งระบบ

## 4. Alternatives Considered
- **Microservices Architecture:** ถูกปฏิเสธเนื่องจากสร้าง Overhead ด้าน DevOps สูงเกินไป และมีความเสี่ยงเรื่อง Data Consistency (Distributed Transactions) ในขณะที่ทีมยังมีขนาดเล็ก
- **Serverless Functions:** ถูกปฏิเสธเนื่องจากปัญหา Cold Start และการจัดการ Context ของ Database Connection ค่อนข้างซับซ้อนสำหรับระบบที่ใช้ Relational Database