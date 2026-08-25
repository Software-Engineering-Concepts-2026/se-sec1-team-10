# Tech Stack Decisions

เอกสารสรุปการตัดสินใจเลือกเทคโนโลยีสำหรับระบบ LifeBalance ครอบคลุมทั้ง 5 Layers หลัก โดยพิจารณาจากบริบทของทีม, Non-Functional Requirements (NFR), และความเหมาะสมในการพัฒนา

| Layer | Choice | Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + Vite + TailwindCSS | รองรับ Component-based UI และการพัฒนาแบบ Mobile-first ได้รวดเร็ว มี Build time ที่ไว เหมาะกับ SPA | Next.js (ซับซ้อนเกินไปสำหรับเฟสแรก), Vue.js (ทีมมีความเชี่ยวชาญ React มากกว่า) |
| **Backend** | Node.js + Express.js (TypeScript) | พัฒนา REST API ได้รวดเร็ว ทำงานแบบ Non-blocking I/O รองรับ Real-time JSON communication ได้ดี และใช้ Type safety | Python/FastAPI (ทีมมีทักษะ TS/JS เป็นหลัก), Java Spring Boot (Overhead สูงเกินความจำเป็น) |
| **Database** | PostgreSQL + Prisma ORM | เป็น Relational Database ที่มี Data Integrity สูง รองรับโครงสร้างข้อมูลสุขภาพและโภชนาการที่ชัดเจน พร้อม ORM ที่ช่วย Type checking | MongoDB (การจัดการ Relations ข้อมูลซับซ้อนกว่า), MySQL (PostgreSQL รองรับ JSONB และการขยายระบบได้ยืดหยุ่นกว่า) |
| **Authentication** | JWT (JSON Web Tokens) + bcrypt | ไร้สถานะ (Stateless), Scale ง่าย, สามารถแนบ Payload สิทธิ์การใช้งาน และตรวจสอบสิทธิ์ผ่าน Authorization Header ได้รวดเร็ว | Session-based Auth (มีปัญหาเรื่องการ Scale ข้าม Server), Firebase Auth (ต้องการจัดการ User Database ภายในเอง) |
| **Hosting & Deployment** | Vercel (Frontend) + Render / Docker (Backend & DB) | Deploy ง่ายผ่าน Git, มี Free Tier สำหรับทดสอบระบบ, และรองรับ Environment Variables แยกตามระดับ Production | AWS EC2/ECS (ค่าใช้จ่ายและการตั้งค่าโครงสร้างพื้นฐานซับซ้อนเกินไปสำหรับระยะเริ่มต้น) |