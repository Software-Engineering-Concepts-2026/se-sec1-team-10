# Non-Functional Requirements (NFR)

เอกสารนี้กำหนดข้อกำหนดด้านคุณภาพของระบบติดตามและจัดการสุขภาพ โดยเน้นข้อกำหนดที่สามารถวัดผลและตรวจสอบได้ ครอบคลุมด้าน Performance, Security, Usability, Availability, Scalability และ Maintainability

ค่าเป้าหมายด้านล่างเป็นข้อกำหนดตั้งต้น ไม่ใช่ผลทดสอบว่าผ่านครบ ดูผลและขอบเขตหลักฐานรายข้อในตาราง “สถานะหลักฐานการตรวจสอบ” ท้ายเอกสาร

---

## NFR-01: Performance — Dashboard Response Time

**Requirement:**  
ระบบต้องแสดง Dashboard ข้อมูลสุขภาพย้อนหลัง 1 ปีภายในเวลาไม่เกิน **1.5 วินาที** เมื่อมีข้อมูลสุขภาพไม่เกิน **1,000 records** ต่อผู้ใช้ ภายใต้สภาพแวดล้อมการทดสอบที่กำหนด

**Metric:**
- Response time ≤ 1.5 seconds
- Dataset ≤ 1,000 records/user

**Verification:**  
ทดสอบโดยโหลด Dashboard ซ้ำอย่างน้อย 20 ครั้ง และบันทึกเวลา response ของแต่ละครั้ง โดยต้องผ่านเกณฑ์อย่างน้อย 95% ของการทดสอบ

**Related User Story:** US-13 / Issue #30

---

## NFR-02: Performance — Data Update Response

**Requirement:**  
เมื่อผู้ใช้บันทึกหรือแก้ไขข้อมูลอาหาร น้ำหนัก หรือกิจกรรม ระบบต้องอัปเดตข้อมูลบน Dashboard ภายใน **2 วินาที** หลังจากการบันทึกสำเร็จ

**Metric:**
- Data update response time ≤ 2 seconds

**Verification:**  
วัดระยะเวลาตั้งแต่ระบบยืนยันการบันทึกข้อมูลจนถึงข้อมูลใหม่ปรากฏบน Dashboard จำนวนอย่างน้อย 20 ครั้ง

**Related User Stories:** US-02, US-03, US-04, US-14

---

## NFR-03: Security — Authentication and Session

**Requirement:**  
ระบบต้องป้องกันการเข้าถึงข้อมูลสุขภาพของผู้ใช้โดยไม่ได้รับอนุญาต โดยผู้ใช้ต้องเข้าสู่ระบบก่อนเข้าถึงข้อมูลส่วนตัว และ Session ต้องหมดอายุหลังไม่มีการใช้งานต่อเนื่อง **30 นาที**

**Metric:**
- Authentication required = 100% สำหรับหน้าข้อมูลส่วนตัว
- Session timeout = 30 minutes

**Verification:**  
ทดสอบการเข้าถึงหน้าข้อมูลสุขภาพโดยไม่เข้าสู่ระบบ และทดสอบ Session หลังไม่มีการใช้งานครบ 30 นาที ระบบต้องปฏิเสธการเข้าถึงและให้เข้าสู่ระบบใหม่

**Related User Stories:** US-01, US-11

---

## NFR-04: Security — Password Protection

**Requirement:**  
ระบบต้องกำหนดให้รหัสผ่านของผู้ใช้มีความยาวอย่างน้อย **8 ตัวอักษร** และข้อมูลรหัสผ่านต้องไม่ถูกจัดเก็บในรูปแบบ Plain Text

**Metric:**
- Minimum password length ≥ 8 characters
- Plain-text password storage = 0

**Verification:**  
ทดสอบการสมัครสมาชิกด้วยรหัสผ่านที่มีความยาวน้อยกว่า 8 ตัวอักษร และตรวจสอบข้อมูลที่จัดเก็บในฐานข้อมูลว่ารหัสผ่านไม่ได้ถูกเก็บเป็น Plain Text

**Related User Story:** US-01 / US-11

---

## NFR-05: Usability — Core Task Completion

**Requirement:**  
ผู้ใช้ใหม่ที่ไม่เคยใช้งานระบบมาก่อนต้องสามารถทำภารกิจหลัก ได้แก่ **บันทึกอาหารและตรวจสอบ Calories ที่เหลือใน Dashboard** ได้สำเร็จภายใน **3 นาที**

**Metric:**
- Task completion time ≤ 3 minutes
- Task completion rate ≥ 90% ของผู้ทดสอบ

**Verification:**  
ทดสอบกับผู้ใช้ใหม่อย่างน้อย 10 คน โดยให้ทำภารกิจโดยไม่รับความช่วยเหลือจากผู้พัฒนา และบันทึกเวลาและผลสำเร็จของแต่ละคน

**Related User Stories:** US-03, US-06, US-12

---

## NFR-06: Availability — System Availability

**Requirement:**  
ระบบต้องพร้อมให้บริการไม่น้อยกว่า **99%** ในช่วงเวลา **08:00–22:00 น.** ของแต่ละวัน ยกเว้นช่วงเวลาที่ประกาศปิดปรับปรุงระบบล่วงหน้า

**Metric:**
- Availability ≥ 99%
- Monitoring period: 08:00–22:00 น.

**Verification:**  
ตรวจสอบสถานะระบบจากระบบ Monitoring และคำนวณ Availability จากระยะเวลาที่ระบบสามารถให้บริการได้เทียบกับเวลาที่กำหนด

**Related User Stories:** US-03, US-12, US-13

---

## NFR-07: Scalability — Concurrent Users

**Requirement:**  
ระบบต้องรองรับผู้ใช้งานพร้อมกันอย่างน้อย **100 คน** โดยผู้ใช้สามารถเข้าสู่ระบบ ดู Dashboard และบันทึกข้อมูลอาหารได้โดยไม่เกิดข้อผิดพลาดจากจำนวนผู้ใช้งาน

**Metric:**
- Concurrent users ≥ 100
- Request error rate < 1%
- Dashboard response time ≤ 3 seconds ภายใต้การทดสอบ

**Verification:**  
ทำ Load Test ด้วยผู้ใช้จำลองอย่างน้อย 100 concurrent users และตรวจสอบ response time กับ error rate

**Related User Stories:** US-03, US-11, US-12, US-13

---

## NFR-08: Maintainability — Automated Testing

**Requirement:**  
ฟังก์ชันหลักของระบบ ได้แก่ การคำนวณ BMI, การคำนวณ Net Calories และการคำนวณ Calories จากอาหาร ต้องมี Automated Tests ครอบคลุมอย่างน้อย **80% ของ code coverage** ในส่วนของ Business Logic

**Metric:**
- Business Logic test coverage ≥ 80%

**Verification:**  
รัน Automated Test Suite และตรวจสอบรายงาน Code Coverage ก่อน Merge Code เข้าสู่ Main Branch

**Related User Stories:** US-03, US-04, US-14, US-15

---

# NFR Summary

| ID | Type | Requirement | Metric |
|---|---|---|---|
| NFR-01 | Performance | Dashboard ย้อนหลัง 1 ปี | ≤ 1.5 sec |
| NFR-02 | Performance | อัปเดตข้อมูลบน Dashboard | ≤ 2 sec |
| NFR-03 | Security | Authentication / Session | Timeout 30 min |
| NFR-04 | Security | Password Protection | ≥ 8 characters |
| NFR-05 | Usability | ทำภารกิจหลัก | ≤ 3 min / ≥ 90% |
| NFR-06 | Availability | System Availability | ≥ 99% |
| NFR-07 | Scalability | Concurrent Users | ≥ 100 users |
| NFR-08 | Maintainability | Automated Testing | ≥ 80% coverage |

---

# Quality Verification

NFR แต่ละข้อจะต้องสามารถตรวจสอบได้ด้วย Metric ที่ระบุไว้ โดยทีมสามารถใช้การทดสอบ Performance Test, Security Test, Usability Test, Availability Monitoring, Load Test และ Automated Test เพื่อยืนยันว่าระบบผ่านข้อกำหนด

ข้อกำหนด NFR-01 ถึง NFR-08 ถูกกำหนดให้เป็นค่าที่วัดผลได้ เพื่อหลีกเลี่ยงคำอธิบายที่คลุมเครือ เช่น "ระบบต้องเร็ว", "ระบบต้องปลอดภัย" หรือ "ระบบต้องใช้งานง่าย"

## สถานะหลักฐานการตรวจสอบ (ณ 16 ตุลาคม 2026)

ตารางนี้แยกค่าเป้าหมายเดิมออกจากหลักฐานที่มีจริงในปัจจุบัน ผล CI ล่าสุดที่บันทึกคือ [main workflow #171, attempt 3](../deployment/continuous-deployment.md) สำหรับ revision `bc104442166307fac5defcbf318f1bd9ec890a60` (run `38163220860`) ซึ่งทั้ง 5 jobs ผ่าน การผ่าน CI ไม่ได้ยืนยัน NFR ที่ไม่ได้วัดด้วยวิธีตรงตาม metric ของข้อกำหนด

| NFR | เป้าหมายเดิม | หลักฐานที่ยืนยันได้ | สถานะ/สิ่งที่ยังไม่ยืนยัน |
| --- | --- | --- | --- |
| NFR-01 | Dashboard ย้อนหลัง 1 ปี ≤ 1.5 วินาที | CI ล่าสุดมี performance job แบบ `--demo` ผู้ใช้จำลอง 1 คน 20 รอบ | ยังไม่มีหลักฐานวัดเวลา Dashboard ใน browser ตามเงื่อนไขข้อมูลย้อนหลัง 1 ปี/1,000 records และเกณฑ์ 95% |
| NFR-02 | หลังบันทึกข้อมูล Dashboard อัปเดต ≤ 2 วินาที | CI benchmark เป็นการทดสอบ performance แบบผู้ใช้เดี่ยว | ยังไม่มีหลักฐานวัด end-to-end ใน browser ตั้งแต่บันทึกสำเร็จจนข้อมูลใหม่แสดงครบ 20 ครั้ง |
| NFR-03 | ต้องยืนยันตัวตนและ session timeout 30 นาที | มี code และ unit/API test ที่เกี่ยวข้องใน CI | ยังไม่มีหลักฐานทดสอบครบทุกอุปกรณ์หรือการรับรองความปลอดภัยของระบบทั้งหมด รวมถึงการยืนยัน timeout 30 นาทีตาม metric นี้ |
| NFR-04 | รหัสผ่าน ≥ 8 ตัวอักษรและไม่เก็บ plain text | มี code และ unit/API test ที่เกี่ยวข้องใน CI | ยังไม่มีการรับรองความปลอดภัยครบทุกอุปกรณ์หรือหลักฐานตรวจฐานข้อมูลจริงในสภาพแวดล้อม production ตามวิธี verification เดิม |
| NFR-05 | ผู้ใช้ใหม่ 10 คน ทำงานหลัก ≤ 3 นาที และสำเร็จ ≥ 90% | ไม่มีผลศึกษากับผู้ใช้ใหม่ 10 คนแนบอยู่ในหลักฐาน CI ที่ระบุ | ยังไม่มีหลักฐานเวลาและอัตราความสำเร็จจากการทดสอบ usability ตามจำนวนผู้ใช้และเกณฑ์ที่กำหนด |
| NFR-06 | Availability ≥ 99% ช่วง 08:00–22:00 | หลักฐาน deploy proof ตรวจ revision สาธารณะและ health endpoint ณ เวลาที่ deploy | ไม่ใช่การเฝ้าระวัง uptime ต่อเนื่อง จึงยังไม่มีหลักฐานคำนวณ availability 99% |
| NFR-07 | ผู้ใช้พร้อมกัน ≥ 100, error < 1%, Dashboard ≤ 3 วินาที | เอกสาร performance ระบุว่า CI ล่าสุดใช้ benchmark `--demo` ผู้ใช้เดียว 20 รอบ | มีรายงาน load test 100 users รุ่นเก่า แต่ไม่ใช่ผลจาก CI ล่าสุด; ยังไม่มีผล load test ใหม่ตาม metric นี้ |
| NFR-08 | Business Logic coverage ≥ 80% | recorded CI ผ่าน coverage gate โดยวัดเฉพาะ logic ที่กำหนด: `src/server/health.ts`, `src/server/meal.ts`, `src/server/routes/activity.ts`, `src/shared/contracts.ts`; รายละเอียดและขอบเขตอยู่ใน [TypeScript coverage](../testing/typescript-coverage.md) | หลักฐานนี้ยืนยันเฉพาะขอบเขต Business Logic ของ NFR-08 ไม่ได้หมายความว่า source ทั้งหมดมี coverage ≥ 80% |

NFR-01 ถึง NFR-07 ยังคงเป็นเป้าหมายจากเอกสารวางแผน จนกว่าจะมีผลวัดที่ตรงตามวิธี verification ของแต่ละข้อ NFR-08 ผ่าน gate เฉพาะขอบเขตที่อธิบายในเอกสาร coverage แล้ว
