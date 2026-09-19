# คู่มือเริ่มพัฒนา LifeBalance สำหรับทีม

เอกสารนี้อธิบายว่าโค้ดของ LifeBalance อยู่ส่วนไหน ใครสามารถรับงานใดได้บ้าง และต้องทดสอบอะไรก่อนส่งงานต่อให้ทีม จุดประสงค์คือให้สมาชิกเริ่มพัฒนาได้โดยไม่ต้องไล่อ่านทุกไฟล์ก่อน

การแบ่งงานสามคน ข้อบกพร่องที่ควรแก้ก่อน และแนวทาง branch ส่วนตัวล่าสุด ดู [แผนแบ่งงานทีม](team-work-allocation.md)

## ภาพรวมระบบ

LifeBalance เป็นเว็บแอปสำหรับมือถือ ใช้บันทึกอาหารและกิจกรรม ดูพลังงานสุทธิ ติดตามแนวโน้มสุขภาพ และตั้งเป้าหมายส่วนบุคคล

```text
เบราว์เซอร์ (React + TypeScript)
        │ HTTP / JSON
        ▼
API (Express + TypeScript)
        ├── PostgreSQL ผ่าน Prisma
        ├── AI มหาวิทยาลัย: วิเคราะห์รูปอาหาร (ตั้งค่าได้)
        └── USDA FoodData Central: ค้นข้อมูลโภชนาการ (ตั้งค่าได้)
```

ระบบหลักเป็น Modular Monolith: หน้าเว็บและ API อยู่ใน repository เดียว แยกตามความรับผิดชอบของไฟล์ ไม่ต้องเริ่ม service หลายตัวเพื่อพัฒนาฟีเจอร์ทั่วไป

> `services/stats-service` เป็น Python/FastAPI prototype สำหรับการศึกษา ไม่ใช่ API หลักที่เว็บปัจจุบันเรียกใช้

## เริ่มต้นบนเครื่องตัวเอง

1. ติดตั้ง Node.js 22.12+ และ Docker Desktop
2. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `DATABASE_URL` และ `JWT_SECRET` ของตัวเอง
3. เปิด PostgreSQL และติดตั้ง schema

   ```bash
   docker compose up -d db
   npm install
   npm run db:generate
   npm run db:migrate
   ```

4. เปิดเว็บและ API พร้อมกัน

   ```bash
   npm run dev
   ```

เปิดเว็บที่ `http://127.0.0.1:5173` และ API ที่ `http://127.0.0.1:3000`

รายละเอียดสำหรับเครื่องนี้และการทดสอบฐานข้อมูลจริงอยู่ที่ [local-testing.md](local-testing.md) ส่วนการตั้งค่า AI อยู่ที่ [ai-setup.md](ai-setup.md)

ห้าม commit ไฟล์ `.env`, โฟลเดอร์ `.local`, `debug.log`, หรือข้อมูลทดสอบที่มี key จริง

## แผนที่โค้ด

| ตำแหน่ง | มีอะไรอยู่ | เหมาะกับงานแบบใด |
| --- | --- | --- |
| `src/client/App.tsx` | โครงแอป, การล็อกอิน, การสลับ 4 หน้า และ session | ประกอบหน้าใหม่หรือเปลี่ยนการนำทาง |
| `src/client/AccountPanel.tsx` | หน้าบัญชี, โปรไฟล์, เมนูตั้งค่า, เป้าหมาย และแจ้งเตือน | งานบัญชีและตั้งค่า |
| `src/client/*Panel.tsx` | ฟีเจอร์แต่ละส่วนของหน้าจอ | พัฒนาฟีเจอร์ UI แยกตาม panel |
| `src/client/MealPanel.tsx` | ถ่าย/เลือกรูป, วิเคราะห์อาหาร และ orchestration การบันทึกมื้อ | งานบันทึกอาหารและ UX ของ AI |
| `src/client/MealIngredientEditor.tsx`, `MealList.tsx`, `mealHelpers.ts` | UI ส่วนประกอบ, รายการที่บันทึก และกฎคำนวณสารอาหารบริสุทธิ์ | แก้ UI/คำนวณอาหารโดยไม่แตะ flow อื่น |
| `src/client/styles.css`, `src/client/styles/` | entry point โหลด `base.css` → `panels.css` → `mobile-overrides.css` | ปรับ UI โดยคงลำดับ import; ไฟล์ overrides ยังใช้ร่วมกันทั้งแอป |
| `src/client/FormFeedback.tsx` | ช่องกรอกข้อมูลและข้อความตอบกลับที่บัญชี/ล็อกอินใช้ร่วมกัน | ปรับฟอร์มร่วมโดยตรวจทั้งสองหน้า |
| `src/client/api.ts` | ฟังก์ชันเรียก API จากหน้าเว็บ | เพิ่มหรือปรับ client API |
| `src/server/app.ts` | สร้าง Express app, security middleware และ error handler | เพิ่ม middleware หรือเปลี่ยนการประกอบแอป |
| `src/server/routes/account.ts` | ลงทะเบียน auth, profile และ goals routes | งานบัญชีและตั้งค่า |
| `src/server/routes/meals.ts` | ลงทะเบียน meal, AI analysis และ nutrition-search routes | งานอาหาร, AI และโภชนาการ |
| `src/server/routes/activity.ts` | ลงทะเบียน exercise, health history และ weekly-summary routes | งานกิจกรรมและสุขภาพ |
| `src/server/routes/context.ts` | session middleware และ dependency context ที่ route groups ใช้ร่วมกัน | แก้ session behavior โดยตรวจทุก route group |
| `src/server/meal.ts` | คำนวณแคลอรีและแปลงข้อมูลอาหาร; routes อยู่ใน `routes/meals.ts` | งาน backend เกี่ยวกับอาหาร |
| `src/server/exercise.ts` | คำนวณแคลอรีกิจกรรม, แปลงข้อมูล, ช่วงวันที่; routes อยู่ใน `routes/activity.ts` | งาน backend กิจกรรม |
| `src/server/health.ts` | คำนวณ BMI; เป้าหมายอยู่ใน `routes/account.ts`, ประวัติ/สรุปอยู่ใน `routes/activity.ts` | งานสุขภาพและการคำนวณ |
| `src/server/ai.ts`, `nutrition.ts` | เชื่อม AI มหาวิทยาลัยและ USDA | งาน integration ภายนอก |
| `src/server/repository.ts` | การอ่าน/เขียนฐานข้อมูลผ่าน Prisma | เปลี่ยนรูปแบบข้อมูลหรือ query |
| `src/shared/contracts.ts` | ชนิดข้อมูลร่วมระหว่าง frontend/backend | เปลี่ยน payload หรือ response API |
| `prisma/schema.prisma` และ `prisma/migrations` | โครงสร้างฐานข้อมูลและ migration | เพิ่มตาราง/คอลัมน์ |
| `src/tests` | unit/API tests | ทดสอบ backend และ business rules |
| `e2e/mobile.spec.ts` | ทดสอบการใช้งานหน้าเว็บมือถือ | ทดสอบ flow ที่ผู้ใช้กดจริง |

## หน้าจอที่มีอยู่

| หน้า | หน้าที่ | ไฟล์หลัก |
| --- | --- | --- |
| วันนี้ | สรุปแคลอรีที่กิน, เผาผลาญ, Net Calories และ BMI ของวันนี้ | `DashboardPanel.tsx` |
| บันทึก | บันทึกอาหาร, รายการโปรด, กิจกรรม, ประวัติอาหาร | `MealPanel.tsx`, `FavoriteMealsPanel.tsx`, `ExercisePanel.tsx`, `FoodHistoryPanel.tsx` |
| ความคืบหน้า | กราฟสุขภาพและสรุปรายสัปดาห์ | `HealthTrendPanel.tsx`, `WeeklySummaryPanel.tsx` |
| บัญชี | ดูข้อมูลย่อ และกดเปิดหัวข้อตั้งค่าข้อมูลส่วนตัว เป้าหมาย และแจ้งเตือน | `AccountPanel.tsx`, `GoalPanel.tsx`, `ReminderPanel.tsx` |

### กติกา UX ที่ต้องรักษา

- ทุกหน้าจอใช้ mobile-first และใช้เมนูด้านล่าง 4 หน้าเดียวกัน แม้เปิดบนจอใหญ่
- หน้า “วันนี้” มีไว้สรุปผลและพาไปบันทึกอาหาร
- เป้าหมายสุขภาพและการแจ้งเตือนมื้ออาหารอยู่ใน “บัญชี”
- สารอาหารจากรูปเป็นค่าประมาณ ผู้ใช้ต้องตรวจแก้ได้โดยปรับปริมาณหรือลบส่วนประกอบ แล้วกดคำนวณใหม่ก่อนบันทึก
- อย่าใส่ API key หรือรายละเอียด backend ลงในข้อความที่ผู้ใช้เห็น

## งานที่แบ่งให้สมาชิกได้ทันที

| งาน | ขอบเขตไฟล์หลัก | สิ่งที่ควรส่งพร้อมงาน |
| --- | --- | --- |
| ปรับหน้าและการเข้าถึงบนมือถือ | panel ที่เกี่ยวข้อง, `styles.css`, `e2e/mobile.spec.ts` | ภาพ/ผลทดสอบที่จอ 320px และ 390px |
| เชื่อม AI วิเคราะห์รูปอาหาร | `ai.ts`, `meal.ts`, `MealPanel.tsx`, `ai-setup.md` | ทดสอบรูปอาหารและกรณี AI ล้มเหลว |
| เพิ่มข้อมูล/ค้นหาโภชนาการ | `nutrition.ts`, `meal.ts`, `FoodSearchPanel.tsx` | ระบุแหล่งข้อมูลและการจัดการค่าว่าง |
| เป้าหมายและกราฟความคืบหน้า | `health.ts`, panel กราฟ, Prisma เมื่อจำเป็น | unit test ของการคำนวณและ e2e flow |
| คุณภาพและเอกสาร | `src/tests`, `e2e`, `docs` | คำสั่งทดสอบและผลที่ตรวจสอบได้ |

ก่อนเริ่มงานให้เลือกไฟล์หลักของตัวเองในทีมก่อน โดยเฉพาะ `App.tsx` และ `styles.css` ซึ่งแก้พร้อมกันหลายคนแล้วเกิด conflict ได้ง่าย

## วิธีทำงานด้วย Git

1. อัปเดต branch ที่ใช้เป็นฐานตามที่ทีมตกลง
2. ใช้ branch ส่วนตัวที่ทีมตกลง เก็บงานเดิมก่อนเปลี่ยนฐาน อ่านข้อแตกต่างระหว่างฐานร่วมกับ branch ที่มีเฉพาะงานตัวเองใน [แผนแบ่งงาน](team-work-allocation.md)
3. ทำงานให้เป็นชุดเล็ก ๆ และ commit ที่อธิบายผลลัพธ์ เช่น `feat: add meal history filter`
4. ก่อนส่งงาน รันอย่างน้อย

   ```bash
   npm test
   npm run build
   npm run test:e2e
   ```

5. แจ้งทีมว่าแก้ไฟล์ใด ทดสอบอะไร และมีสิ่งใดที่ต้องตั้งค่าเพิ่ม

สาขา `life-balance-test` ใช้เป็นพื้นที่รวมและทดลองงานตามข้อตกลงปัจจุบันของทีม การรวมงานจากสาขาของเพื่อนควรทำโดยผู้รับผิดชอบสาขานี้หลังตรวจผลทดสอบแล้ว อย่า push หรือ merge ไป `main` โดยไม่ได้ตกลงร่วมกัน

## เมื่อต้องแก้ฐานข้อมูล

1. แก้ `prisma/schema.prisma`
2. สร้าง migration ด้วย `npm run db:dev -- --name ชื่อที่สื่อความหมาย`
3. ตรวจ migration ที่เกิดใน `prisma/migrations`
4. เพิ่มหรือปรับ test ของ repository/API
5. เพื่อนที่ดึงงานไปต้องรัน `npm run db:migrate`

อย่าแก้ข้อมูลในฐานข้อมูลของคนอื่นเพื่อทดสอบ และอย่าแก้ migration เก่าที่ถูกส่งขึ้น repository แล้ว

## เช็กลิสต์ก่อนส่งงาน

- [ ] ฟีเจอร์ทำงานบนมือถือกว้าง 320px และ 390px โดยไม่มี scroll แนวนอน
- [ ] ปุ่มและ input มีข้อความ/label ที่อธิบายได้
- [ ] API ส่ง error ที่ผู้ใช้เข้าใจได้ และไม่เปิดเผย key หรือรายละเอียดภายใน
- [ ] เพิ่มหรือปรับ test ที่ครอบคลุมพฤติกรรมใหม่
- [ ] `npm test`, `npm run build`, และ `npm run test:e2e` ผ่าน
- [ ] ไม่ได้ใส่ `.env`, `node_modules`, `.local`, `dist`, `debug.log` หรือผลทดสอบเข้า commit
- [ ] commit message อธิบายสิ่งที่เปลี่ยนอย่างชัดเจน

## เอกสารอ้างอิงอื่น

- [ภาพรวมสถาปัตยกรรม](architecture/README.md)
- [ข้อกำหนดผู้ใช้](requirements/user-stories.md)
- [ขอบเขตงานที่เสร็จ](definition-of-done.md)
- [แนวทางทดสอบ](testing/readme.md)
- [รายงานทดสอบหน้าเว็บมือถือ](test-report-mobile.md)
