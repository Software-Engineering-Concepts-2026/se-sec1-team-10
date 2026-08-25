
# AI Usage Log

บันทึกการใช้งาน AI ในการพัฒนาโปรเจกต์ตามเกณฑ์วิชา Software Engineering (Five S's Framework) และยืนยันสัดส่วน Human Contribution $\ge 50\%$

---

## ตารางบันทึกการใช้งาน AI (AI Usage Log)

| Lab | AI Tools | Prompts Used (Five S's) | AI-Generated Parts | Human-Edited / Written Parts ($\ge 50\%$) |
| :--- | :--- | :--- | :--- | :--- |

| **Lab 2: Sprint Zero** | ChatGPT | 1."ตรวจสอบ MoSCoW ที่จัดวางไปว่าเหมาะสมหรือไม่ ถ้าไม่เป็นเพราะอะไร" | "MoSCoW ที่จัดมาถือว่าเหมาะสมโดยรวม เนื่องจาก Must Have เป็นฟังก์ชันหลักที่จำเป็นต่อการทำงานของระบบ LifeBalance ส่วน Should Have และ Could Have เป็นฟังก์ชันที่ช่วยเพิ่มความสะดวกและประสบการณ์การใช้งาน อย่างไรก็ตาม Issue #19 การค้นหาประวัติการรับประทานอาหารย้อนหลังอาจพิจารณาย้ายจาก Should Have เป็น Must Have เพราะเป็นฟังก์ชันสำคัญสำหรับการติดตามและตรวจสอบพฤติกรรมการรับประทานอาหารของผู้ใช้ นอกจากนี้ควรมี Won't Have เพื่อระบุฟังก์ชันที่ตั้งใจจะไม่นำมาพัฒนาใน Sprint หรือ Release นี้ เพื่อควบคุมขอบเขตของงานไม่ให้ใหญ่เกินไป" | มีการตรวจสอบอีกครั้งและได้มีการปรับเปลี่ยนตามความเหมาะสม
| **Lab 3: Requirements** | ChatGPT | 1. "ช่วยสร้าง Scenarios จาก Personas ของระบบติดตามสุขภาพ โดยให้ครอบคลุมทั้ง Happy Path และ Edge Case"<br>2. "ช่วยจัดรูปแบบ User Stories ให้เป็น As a / I want / So that พร้อม Acceptance Criteria"<br>3. "ช่วยร่าง Acceptance Criteria ที่สามารถตรวจสอบและวัดผลได้"<br>4. "ช่วยร่าง Non-functional Requirements (NFR) ที่เป็น measurable และครอบคลุม Performance, Security, Usability และ Availability"<br>5. "ช่วยตรวจสอบความสอดคล้องระหว่าง Persona, Scenario, User Story และ NFR" | ร่างและจัดโครงสร้าง Scenarios, User Stories, Acceptance Criteria และ NFR รวมถึงช่วยจัดรูปแบบเอกสาร Markdown | ตรวจสอบและปรับแก้เนื้อหาให้สอดคล้องกับ Project Proposal, Personas และ GitHub Issues ของทีม รวมถึงเป็นผู้กำหนดและตรวจสอบ Priority, Estimate, Scenario Mapping และ Scope ของระบบ
| **Lab 4: Rapid Prototype** | Gemini | 1. "สร้างโครงสร้าง Semantic HTML และ Plain CSS สำหรับหน้า Food Logging บน Mobile Web App ตาม UI แนบ มีส่วนเลือกมื้ออาหาร กล่องอัปโหลดรูป ฟอร์มสารอาหาร และเพิ่มส่วนประกอบ"<br>2. "เขียนโค้ด Vanilla JavaScript จัดการ event คำนวณแคลอรี่แบบ Real-time ((Carb+Sugar)*4 + Protein*4 + Fat*9) พรีวิวรูปภาพ และเพิ่ม/ลบ แถวส่วนประกอบ" | โครงสร้าง Layout สไตล์ Mobile Card และฟังก์ชันการคำนวณ DOM พื้นฐาน | ออกแบบและจัดวาง CSS Flexbox/Grid ให้รองรับหน้าจอมือถือ, เพิ่มระบบ Dynamic Preview รูปภาพ, เขียนระบบ Form Validation เพื่อปลดล็อกปุ่มบันทึกข้อมูล และจัดระเบียบ Semantic HTML ให้ถูกต้อง |
| **Lab 5: Architecture** | Gemini | 1. "วิเคราะห์ Tech Stack 5 Layers สำหรับ LifeBalance App พร้อม Rationale และ Alternatives"<br>2. "เขียน C4 Context และ Container ด้วยโค้ด Mermaid.js"<br>3. "ร่าง ADR-0001 เปรียบเทียบ Monolith vs Microservices ตาม Nygard format" | โครงสร้างตาราง Tech Stack, โค้ด Mermaid C4 diagrams และ Template ADR-0001 | ปรับแต่ง Rationale ให้สอดคล้องกับ NFR ประจำโปรเจกต์, ระบุ Protocols การเชื่อมต่อของ Container ให้ชัดเจน, และเขียนบทวิเคราะห์ลงใน reflect.md |

