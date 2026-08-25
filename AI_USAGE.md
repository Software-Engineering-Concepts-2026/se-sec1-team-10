<<<<<<< Updated upstream
# AI Usage Log

บันทึกการใช้งาน AI ในการพัฒนาโปรเจกต์ตามเกณฑ์วิชา Software Engineering (Five S's Framework) และยืนยันสัดส่วน Human Contribution $\ge 50\%$

---

## ตารางบันทึกการใช้งาน AI (AI Usage Log)

| Lab | AI Tools | Prompts Used (Five S's) | AI-Generated Parts | Human-Edited / Written Parts ($\ge 50\%$) |
| :--- | :--- | :--- | :--- | :--- |
| **Lab 2: Sprint Zero** | *[เช่น Gemini / ChatGPT]* | *[ระบุข้อความ Prompt]* | *[สิ่งที่ AI Gen ให้]* | *[ส่วนที่เขียน/ปรับปรุงเอง]* |
**Lab 3: Requirements** | ChatGPT | 1. "ช่วยสร้าง Scenarios จาก Personas ของระบบติดตามสุขภาพ โดยให้ครอบคลุมทั้ง Happy Path และ Edge Case"<br>2. "ช่วยจัดรูปแบบ User Stories ให้เป็น As a / I want / So that พร้อม Acceptance Criteria"<br>3. "ช่วยร่าง Acceptance Criteria ที่สามารถตรวจสอบและวัดผลได้"<br>4. "ช่วยร่าง Non-functional Requirements (NFR) ที่เป็น measurable และครอบคลุม Performance, Security, Usability และ Availability"<br>5. "ช่วยตรวจสอบความสอดคล้องระหว่าง Persona, Scenario, User Story และ NFR" | ร่างและจัดโครงสร้าง Scenarios, User Stories, Acceptance Criteria และ NFR รวมถึงช่วยจัดรูปแบบเอกสาร Markdown | ตรวจสอบและปรับแก้เนื้อหาให้สอดคล้องกับ Project Proposal, Personas และ GitHub Issues ของทีม รวมถึงเป็นผู้กำหนดและตรวจสอบ Priority, Estimate, Scenario Mapping และ Scope ของระบบ
| **Lab 4: Rapid Prototype** | Gemini | 1. "สร้างโครงสร้าง Semantic HTML และ Plain CSS สำหรับหน้า Food Logging บน Mobile Web App ตาม UI แนบ มีส่วนเลือกมื้ออาหาร กล่องอัปโหลดรูป ฟอร์มสารอาหาร และเพิ่มส่วนประกอบ"<br>2. "เขียนโค้ด Vanilla JavaScript จัดการ event คำนวณแคลอรี่แบบ Real-time ((Carb+Sugar)*4 + Protein*4 + Fat*9) พรีวิวรูปภาพ และเพิ่ม/ลบ แถวส่วนประกอบ" | โครงสร้าง Layout สไตล์ Mobile Card และฟังก์ชันการคำนวณ DOM พื้นฐาน | ออกแบบและจัดวาง CSS Flexbox/Grid ให้รองรับหน้าจอมือถือ, เพิ่มระบบ Dynamic Preview รูปภาพ, เขียนระบบ Form Validation เพื่อปลดล็อกปุ่มบันทึกข้อมูล และจัดระเบียบ Semantic HTML ให้ถูกต้อง |
=======
# AI Usage

## AI Tools Used

ทีมใช้ Generative AI เป็นเครื่องมือช่วยในการจัดทำเอกสาร
Requirements สำหรับ Lab 3

## How AI Was Used

AI ถูกใช้เพื่อช่วยในงานต่อไปนี้:

1. ช่วยร่าง Scenarios จาก Persona และความต้องการของระบบ
2. ช่วยปรับรูปแบบ User Stories ให้เป็น
   "As a / I want / So that"
3. ช่วยร่าง Acceptance Criteria ให้สามารถตรวจสอบได้
4. ช่วยตรวจสอบและปรับ NFR ให้มีค่าที่วัดผลได้
5. ช่วยตรวจสอบความสอดคล้องระหว่าง Persona, Scenario,
   User Story และ NFR
6. ช่วยจัดรูปแบบเอกสาร Markdown ให้เป็นโครงสร้างเดียวกัน

## Human Review

ทีมไม่ได้ใช้ผลลัพธ์จาก AI โดยตรงโดยไม่มีการตรวจสอบ

สมาชิกในทีมตรวจสอบและแก้ไขเนื้อหาให้สอดคล้องกับ:

- Project Proposal
- Personas ของโครงการ
- Scenarios
- GitHub Issues
- User Stories
- ขอบเขตของระบบ

โดยเฉพาะ Priority และ Estimate ซึ่งเป็นการตัดสินใจของทีม
และต้องได้รับการตรวจสอบก่อนนำไปใช้ใน Sprint

## Data Privacy

ทีมไม่ได้ป้อนข้อมูลส่วนตัวที่สามารถระบุตัวบุคคลได้
เช่น รหัสนิสิต ข้อมูลบัญชี หรือข้อมูลส่วนตัวของผู้ใช้งานจริง
เข้าสู่ระบบ AI

## Final Responsibility

AI เป็นเพียงเครื่องมือช่วยในการร่างและตรวจสอบเอกสาร
การตัดสินใจขั้นสุดท้ายเกี่ยวกับ Requirements, Priority,
Estimate และ Scope เป็นความรับผิดชอบของทีม
>>>>>>> Stashed changes
