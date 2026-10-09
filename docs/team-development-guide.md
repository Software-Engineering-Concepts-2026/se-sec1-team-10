# คู่มือเริ่มพัฒนา LifeBalance สำหรับทีม

เอกสารนี้อธิบายว่าโค้ดของ LifeBalance อยู่ส่วนไหน ใครสามารถรับงานใดได้บ้าง และต้องทดสอบอะไรก่อนส่งงานต่อให้ทีม จุดประสงค์คือให้สมาชิกเริ่มพัฒนาได้โดยไม่ต้องไล่อ่านทุกไฟล์ก่อน

แผนแบ่งงานสามคนและแนวทาง branch ที่ทีมเคยตกลงกัน ดู [แผนแบ่งงานทีม](team-work-allocation.md) ให้ตรวจสอบข้อตกลงปัจจุบันกับทีมก่อนใช้เป็นฐานทำงาน

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

1. ติดตั้ง Node.js 22.12+ และติดตั้ง dependencies ด้วย `npm ci`
2. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `DATABASE_URL` และ `JWT_SECRET` ของตัวเอง
3. เลือกฐานข้อมูล PostgreSQL ที่ได้รับอนุญาตให้ใช้ หากเลือก PostgreSQL local ผ่าน Docker ให้เปิดฐานข้อมูลก่อน:

   ```bash
   docker compose up -d db
   ```

   จากนั้นสร้าง Prisma Client และติดตั้ง schema เฉพาะฐานข้อมูลใหม่ที่ยังไม่มี schema:

   ```bash
   npm run db:generate
   npm run db:migrate
   ```

หากใช้ฐานข้อมูลร่วมที่ทีมเตรียม schema ไว้แล้ว ให้รันเพียง `npm run db:generate` และข้าม `db:migrate` กับ `db:seed`; อย่ารัน migration หรือ seed กับฐานข้อมูลร่วมโดยไม่ได้รับมอบหมาย

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
| `src/client/DashboardPanel.tsx` | หน้าแรก: เลือกวันที่ ดูสรุปพลังงานและรายการอาหารของวันนั้น | ปรับสรุปประจำวันและกลุ่มมื้ออาหาร |
| `src/client/AccountPanel.tsx` | หน้าบัญชี, โปรไฟล์, เมนูตั้งค่า, เป้าหมาย และแจ้งเตือน | งานบัญชีและตั้งค่า |
| `src/client/*Panel.tsx` | ฟีเจอร์แต่ละส่วนของหน้าจอ | พัฒนาฟีเจอร์ UI แยกตาม panel |
| `src/client/MealPanel.tsx` | ถ่าย/เลือกรูป, วิเคราะห์อาหาร และ orchestration การบันทึกมื้อ | งานบันทึกอาหารและ UX ของ AI |
| `src/client/MealIngredientEditor.tsx`, `MealList.tsx`, `mealHelpers.ts` | UI ส่วนประกอบ, รายการที่บันทึก และกฎคำนวณสารอาหารบริสุทธิ์ | แก้ UI/คำนวณอาหารโดยไม่แตะ flow อื่น |
| `src/client/styles.css`, `src/client/styles/` | entry point โหลด base → panels → goals → mobile → reference → profile → theme → mockup; `main.tsx` โหลด meal editor overrides เป็นไฟล์สุดท้าย | ปรับ UI โดยคงลำดับ import; editor styles อยู่ใน `meal-editor-refresh.css` |
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
| `src/shared/goals.ts`, `src/shared/foodCatalog.ts` | กฎเป้าหมายสุขภาพและชนิดข้อมูลฐานอาหารที่ใช้ร่วมกัน | เปลี่ยน logic ที่ client/server ใช้ร่วมกัน |
| `prisma/schema.prisma` และ `prisma/migrations` | โครงสร้างฐานข้อมูลและ migration | เพิ่มตาราง/คอลัมน์ |
| `src/tests` | unit/API tests รวมถึง shared logic และ React client boundary | ทดสอบ logic และส่วนประกอบที่มี test ในระดับ unit |
| `e2e/`, `e2e-chunks/`, `e2e-live/` | browser tests แบบ mock, built-chunk recovery และ flow ที่ใช้ฐานข้อมูลจริง | ทดสอบ UI และ user flow ตามสภาพแวดล้อมของแต่ละชุด |

## หน้าจอที่มีอยู่

| หน้า | หน้าที่ | ไฟล์หลัก |
| --- | --- | --- |
| หน้าแรก | เลือกวันที่ดูสรุปพลังงานและสารอาหาร พร้อมเปิดรายละเอียดการออกกำลังกาย, BMI และจำนวนรายการอาหาร; อาหารจัดกลุ่มตามมื้อ รวมถึงวันที่ย้อนหลังที่เพิ่ม แก้ไข หรือลบรายการได้ | `DashboardPanel.tsx`, `MealPanel.tsx` |
| บันทึก | บันทึกอาหารหรือกิจกรรม ดูและค้นประวัติอาหาร; แก้ไข ลบ หรือนำมื้อเดิมกลับมาใช้ได้ | `DiaryPanel.tsx`, `MealPanel.tsx`, `ExercisePanel.tsx` |
| ความคืบหน้า | ดูกราฟน้ำหนัก/BMI เลือกช่วงเวลา ดูสรุปรายสัปดาห์ และเพิ่ม แก้ไข หรือลบบันทึกน้ำหนักย้อนหลัง | `HealthTrendPanel.tsx`, `WeeklySummaryPanel.tsx` |
| บัญชี | แสดงข้อมูลโปรไฟล์แบบย่อและเปิดดูรายละเอียดได้; มีหน้าข้อมูลส่วนตัว เป้าหมายสุขภาพ และแจ้งเตือนมื้ออาหาร | `AccountPanel.tsx`, `GoalPanel.tsx`, `ReminderPanel.tsx` |

### กติกา UX ที่ต้องรักษา

- ทุกหน้าจอใช้ mobile-first และใช้เมนูด้านล่าง 4 หน้าเดียวกัน แม้เปิดบนจอใหญ่
- หน้าแรกเลือกดูวันย้อนหลังได้ด้วย; เมื่อแก้วันย้อนหลัง การเพิ่ม แก้ไข หรือลบอาหารต้องคงวันที่เลือกไว้
- เมื่อบันทึกสำเร็จ แบบฟอร์มกลับไปยังหน้าที่เปิดแบบฟอร์มและแสดงผลอัปเดต; เมื่อบันทึกไม่สำเร็จให้คงข้อมูลในแบบฟอร์มพร้อมข้อความผิดพลาด
- หน้า “ความคืบหน้า” ใช้จัดการบันทึกน้ำหนักย้อนหลัง; ข้อมูลโปรไฟล์สรุปในหน้า “บัญชี” ถูกซ่อนไว้จนกว่าจะกดเปิด
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

1. เอกสารแผนทีมเดิมบันทึก `life-balance-test` และ commit `9deb855` เป็นฐานในเวลานั้น ข้อมูลนี้เป็นประวัติ ไม่ยืนยันว่าเป็น branch หรือ release ปัจจุบัน ให้ตรวจ branch และ commit ที่ทีมกำหนดก่อนเริ่มงาน
2. ใช้ branch ส่วนตัวที่ทีมตกลง เก็บงานเดิมก่อนอัปเดตฐาน ทุก branch มีโค้ดทั้งระบบ ส่วนงานที่รับผิดชอบคือการเปลี่ยนแปลงต่อจากฐาน อ่านวิธีเตรียม branch และตรวจงานใน [แผนแบ่งงาน](team-work-allocation.md)
3. ทำงานให้เป็นชุดเล็ก ๆ และ commit ที่อธิบายผลลัพธ์ เช่น `feat: add meal history filter`
4. ก่อนส่งงาน รันอย่างน้อย

   ```bash
   npm test
   npm run build
   npm run test:e2e
   npm run test:e2e:chunks
   ```

5. แจ้งทีมว่าแก้ไฟล์ใด ทดสอบอะไร และมีสิ่งใดที่ต้องตั้งค่าเพิ่ม

เอกสารแผนทีมเดิมระบุ `life-balance-test` เป็นพื้นที่รวมและทดลองงานในเวลานั้น; ตรวจสอบกับทีมก่อนใช้ branch นี้ในปัจจุบัน การรวมงานจากสาขาของเพื่อนควรทำโดยผู้รับผิดชอบสาขาที่ทีมกำหนดหลังตรวจผลทดสอบแล้ว อย่า push หรือ merge ไป `main` โดยไม่ได้ตกลงร่วมกัน

## เมื่อต้องแก้ฐานข้อมูล

1. แก้ `prisma/schema.prisma`
2. สร้าง migration ด้วย `npm run db:dev -- --name ชื่อที่สื่อความหมาย`
3. ตรวจ migration ที่เกิดใน `prisma/migrations`
4. เพิ่มหรือปรับ test ของ repository/API
5. ให้ผู้รับผิดชอบฐานข้อมูลตรวจและ deploy migration ที่เพิ่มใหม่ด้วย `npm run db:migrate` ทั้งฐานใหม่และฐานเดิมที่ยังขาด migration นั้น; ผู้ใช้ฐานร่วมที่ schema ครบแล้วไม่ต้องรันซ้ำ ให้รัน `npm run db:generate` เพื่อสร้าง Prisma Client ของเครื่องแทน

อย่าแก้ข้อมูลในฐานข้อมูลของคนอื่นเพื่อทดสอบ และอย่าแก้ migration เก่าที่ถูกส่งขึ้น repository แล้ว

## เช็กลิสต์ก่อนส่งงาน

- [ ] ฟีเจอร์ทำงานบนมือถือกว้าง 320px และ 390px โดยไม่มี scroll แนวนอน
- [ ] ปุ่มและ input มีข้อความ/label ที่อธิบายได้
- [ ] API ส่ง error ที่ผู้ใช้เข้าใจได้ และไม่เปิดเผย key หรือรายละเอียดภายใน
- [ ] เพิ่มหรือปรับ test ที่ครอบคลุมพฤติกรรมใหม่
- [ ] `npm test`, `npm run build`, `npm run test:e2e`, และ `npm run test:e2e:chunks` ผ่าน
- [ ] ไม่ได้ใส่ `.env`, `node_modules`, `.local`, `dist`, `debug.log` หรือผลทดสอบเข้า commit
- [ ] commit message อธิบายสิ่งที่เปลี่ยนอย่างชัดเจน

## เอกสารอ้างอิงอื่น

- [ภาพรวมสถาปัตยกรรม](architecture/README.md)
- [ข้อกำหนดผู้ใช้](requirements/user-stories.md)
- [ขอบเขตงานที่เสร็จ](definition-of-done.md)
- [แนวทางทดสอบ](testing/readme.md)
- [รายงานทดสอบหน้าเว็บมือถือ](test-report-mobile.md)
