# ADR 0001: เริ่มต้นด้วย Modular Monolith สำหรับระบบ LifeBalance

## Status
Accepted — 2026-08-25

## Context
- ทีมขนาดเล็ก (4 คน), มีเวลาจำกัดตาม Sprint (~8 สัปดาห์)
- ปริมาณผู้ใช้งานเริ่มต้นเป็นกลุ่มผู้ใช้งานทั่วไปและคนทำงานออฟฟิศ (~100 users/day)
- ต้องการส่งมอบฟังก์ชันหลัก (Food Logging, Dashboard สรุปแคลอรี่) ให้พร้อม Demo ภายใน Sprint 2
- ไม่มี DevOps / Ops Engineer ประจำทีม
- ขอบเขต Requirement อยู่ในช่วงเริ่มต้นและอาจมีการปรับเปลี่ยนตาม Feedback

## Decision
เลือกใช้สถาปัตยกรรมแบบ **Modular Monolith** บน Node.js + Express
- รวมโมดูลทางธุรกิจ (Auth, Meal Logging, Nutrition Analytics) ไว้ใน Codebase และ Deployment Unit เดียวกัน
- แยกโครงสร้างโค้ดภายในตามขอบเขตหน้าที่อย่างชัดเจน (Clear Module Boundaries)
- หากในอนาคตมีผู้ใช้งานเกิน 1,000 คน/วัน หรือมีภาระการคำนวณด้านโภชนาการ/AI สูง → ค่อยพิจารณาแยกโมดูลนั้นออกเป็น Service อิสระ

## Consequences
- ✅ Deploy ง่าย เป็น Single Deployment Unit ไม่ซับซ้อน
- ✅ ลดภาระด้าน Infrastructure และ Network Latency
- ✅ จัดการ Database Transactions และ Data Consistency ของข้อมูลโภชนาการได้ง่าย
- ✅ ทีมพัฒนาสามารถแชร์ TypeScript ร่วมกันได้รวดเร็ว
- ❌ ไม่สามารถแยก Scale เฉพาะบางโมดูลที่มีปริมาณการใช้งานสูงได้อย่างอิสระ
- ❌ หากโมดูลใดเกิด Failure รุนแรง อาจส่งผลกระทบต่อระบบส่วนอื่นได้

## Alternatives Considered
- **Microservices (3+ services)** — Rejected: DevOps overhead สูงเกินไป และเสี่ยงต่อปัญหา Data Consistency ข้าม Service ในช่วงเริ่มต้น
- **Serverless Architecture** — Rejected: เสี่ยงต่อปัญหา Cold Start และจัดการ Local Development/State ได้ยากกว่า
- **Full Monolith (ไม่มีการแยก Module)** — Rejected: ทำให้ยากต่อการ Refactor หรือแยก Service ในอนาคต