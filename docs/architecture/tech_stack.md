# Tech Stack Decision Matrix

| Layer | Technology Choice | Context-Driven Rationale | Alternatives Considered |
| :--- | :--- | :--- | :--- |
| **Frontend** | React + TypeScript + Tailwind CSS | โครงสร้าง Component-based ช่วยให้จัดการ Real-time State และกราฟ Dashboard ได้อย่างมีประสิทธิภาพ | Vue.js, Angular, Svelte |
| **Backend** | Node.js + Express + TypeScript | ทำงานแบบ Non-blocking I/O ได้ดีกับ REST API ที่รับส่งข้อมูล JSON ขนาดเล็กบ่อยครั้ง และแชร์ Type ข้ามกับ Frontend ได้ | Python (FastAPI), Go, Java Spring Boot |
| **Database** | PostgreSQL + Prisma ORM | ต้องการ Data Integrity และ Relational Constraints สูงสำหรับข้อมูลมื้ออาหารและโภชนาการ | MongoDB, MySQL, SQLite |
| **Authentication** | JWT (JSON Web Tokens) with HttpOnly Cookies | Stateless Authentication ที่ปลอดภัยและใช้งานร่วมกับ REST API ได้อย่างราบรื่น | Session-based (Redis), OAuth2-only |
| **Hosting & Infra** | Docker Container | ทำให้สภาพแวดล้อมระหว่าง Development และ Deployment ตรงกัน 100% รองรับการขยายระบบในอนาคต | VM Deployment, Bare-metal |