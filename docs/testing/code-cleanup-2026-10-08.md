# LifeBalance — ผลคลีนโค้ดก่อนรวมเข้า life-balance-test

ตรวจวันที่ 8 ตุลาคม 2569 บน `feature/Chayakorn05` ตามคำขอให้จัดระเบียบโค้ดและเตรียมรวมงาน โดยรักษา UI, ฟีเจอร์, API contract และกฎคำนวณเดิม

## ผลงานรอบนี้

| กลุ่มไฟล์ | สิ่งที่คลีน |
| --- | --- |
| `src/client/DashboardPanel.tsx`, `ExercisePanel.tsx`, `HealthTrendPanel.tsx`, `WeeklySummaryPanel.tsx` | ใช้ `mealHelpers.localDate` ร่วมกันแทน helper วันที่ซ้ำ เก็บรูปแบบวันที่ในเขตเวลาของเบราว์เซอร์เดิม |
| `src/client/formatDisplay.ts` | ใช้ `Intl.DateTimeFormat` ตัวเดียวร่วมกัน แทนการสร้าง formatter ใหม่ทุกครั้ง; การตรวจวันที่และ fallback เดิมยังอยู่ |
| `src/client/FoodHistoryPanel.tsx` | ลบ component เก่าที่ไม่มี import หรือเส้นทางเรียกใช้ ประวัติที่ผู้ใช้เข้าถึงยังทำงานผ่าน `DiaryPanel` |
| `src/client/styles/meal-editor-refresh.css`, `mockup-refresh.css` | รวมสไตล์ส่วนประกอบอาหารไว้ใน editor และนำ block ที่ถูก override ออก โดยย้ายคุณสมบัติที่ยังใช้อยู่ก่อนลบ |
| `src/client/styles/reference.css`, `theme-premium.css`, `mockup-refresh.css` | ลบ selector รูปส่วนประกอบและสรุป weight/height/BMI ในบัญชีที่ถูกถอดจาก UI ไปแล้ว |
| `src/client/styles/panels.css`, `mobile-overrides.css` | ลบสไตล์ของ `FoodHistoryPanel` ที่เลิกใช้ โดยรักษา selector อื่นใน rule ร่วม |
| `src/server/routes/activity.ts` | สรุปรายสัปดาห์ด้วย index วันที่ 7 วันและวนอาหาร/กิจกรรมอย่างละรอบ แทนการ filter รายการเต็มซ้ำแต่ละวัน; daily exercise โหลดข้อมูลสองชุดที่เป็นอิสระพร้อมกัน |
| `src/server/weight.ts`, `routes/activity.ts` | รวม validation วันที่น้ำหนักของการเพิ่มและแก้ไขไว้ใน `weightDateIssue`; ข้อความ, status code และขอบเขตวันที่เดิม |
| `src/tests/auth-profile.test.ts` | เพิ่ม regression ยอดรายวัน/รายสัปดาห์ที่มีหลายมื้อ หลายกิจกรรม วันว่าง และรายการนอกช่วง |
| `tsconfig.json`, `tsconfig.server.json` | เปิด `noUnusedLocals` และ `noUnusedParameters` ทั้ง client และ server เพื่อป้องกันโค้ดค้างกลับมา |
| `scripts/build-web.mjs`, `package.json`, `Dockerfile` | บังคับ release assets ใช้ `NODE_ENV=production`; Docker ใช้คำสั่ง build เดียวกับโปรเจกต์ รวม typecheck |
| `package.json`, `package-lock.json` | แพตช์เครื่องมือพัฒนา `concurrently` 10.0.5 → 10.0.6, `shell-quote` 1.9.0 → 1.12.0 และ `source-map-js` 1.2.1 → 1.2.2 โดยไม่อัปเกรด major หรือเปลี่ยน runtime dependency |
| `.gitignore`, `.dockerignore` | กันไฟล์แนบต้นฉบับ, environment, cache, config ทดสอบเฉพาะเครื่อง และ seed สำเนาที่ซ้อนอยู่ใน `prisma/prisma` ออกจาก Git/build context; เก็บไฟล์เหล่านี้ไว้ในเครื่อง |
| `docs/team-development-guide.md`, `team-work-allocation.md` | ปรับแผนที่ไฟล์ประวัติและลำดับ stylesheet ให้ตรงกับโค้ดที่เหลือ |

## ผลทดสอบ

| ตรวจ | ผล |
| --- | --- |
| Build และ typecheck client/server พร้อมตรวจ unused | ผ่านทั้ง Windows และ Linux ใน Docker |
| Vitest unit/regression | 122 ผ่าน; 3 database tests ข้ามในชุดปกติ แล้วรันแยกตามแถวถัดไป |
| PostgreSQL integration | 3 ผ่าน บน PostgreSQL 17 ชั่วคราวที่แยกจาก Supabase; ลบ container หลังจบ |
| Playwright ทั้งชุดหลังแพตช์ dependency | 71 ผ่าน รวม 4 แท็บหลัก, save/error/retry, อาหารย้อนหลัง, กิจกรรม, goals, น้ำหนัก, รูปโปรไฟล์ และ camera fallback |
| UI หน้าแก้ไขอาหาร ก่อน/หลัง | PNG ตรงกันแบบ byte-for-byte ทั้ง 320, 360, 390, 533 และ 1440px |
| Docker runtime smoke | 13 กลุ่มผ่าน รวม auth/cookie/origin, persistence, Prisma JSONB, กรัมและ calories, weekly summary, restart และ healthcheck |
| npm audit | ไม่พบช่องโหว่ที่รายงาน หลังแพตช์ ณ เวลาตรวจ |
| Local command runner | กระบวนการทดสอบสองตัวจบด้วย exit code 0 หลังอัปเดต concurrently |
| Python ตามคำสั่ง CI | 57 ผ่าน, branch coverage 100% (เกณฑ์ 90%); Ruff ผ่าน ใช้ Python 3.12 และ tools ใน `.local` |
| Git whitespace | `git diff --check` ผ่าน |

Docker ที่ใช้ตรวจอยู่ในเครื่องชื่อ `lifebalance:cleanup-20261008` เท่านั้น ไม่มีการ push image หรือเปลี่ยน Render ในรอบนี้ การทดสอบ runtime ไม่เรียก AI ภายนอกและไม่ใช้ฐานข้อมูลทีม

พบ build warning จาก annotation ใน Zod ที่ Rollup นำออกอัตโนมัติ และ Python warning จาก alias ที่จะเลิกใช้ใน Starlette/AnyIO แต่ทั้งสองชุดผ่าน ไม่แก้ไฟล์ภายใน dependency

ไฟล์หลัก JavaScript ของ release build ในเครื่องลดจากประมาณ 515.49 KB เป็น 268.99 KB หลังบังคับ production mode (82.93 KB เมื่อ gzip) เพราะ `.env` เดิมตั้งโหมด development ข้อนี้แก้ความสม่ำเสมอของ build ในเครื่อง ไม่ใช่คำกล่าวว่าเว็บจริงเร็วขึ้นเท่าตัว; Docker production เดิมใช้ production mode อยู่แล้ว

หลักฐานเฉพาะเครื่องอยู่ใน `.local/cleanup-20261008/`, ภาพ editor อยู่ใน `.local/meal-editor-reference-20261008/` และผล runtime อยู่ใน `.local/cleanup-20261008/runtime-result.json` โฟลเดอร์เหล่านี้ไม่ต้อง commit

## สถานะก่อนรวมงาน

- ปลายทางที่ผู้ใช้ยืนยันคือ `life-balance-test` ไม่ใช่ branch ชื่อ `lblt`
- ตอนตรวจ remote ปลายทางและ HEAD ของสาขาปัจจุบันอยู่ที่ `a0c2f3b20022e2f9fc5059c9fc7411bebd703aaa` เหมือนกัน การเปลี่ยนแปลง UI/ฟีเจอร์ก่อนหน้าและงานคลีนทั้งหมดจึงยังอยู่ใน working tree
- เก็บการเปลี่ยนแปลงเดิมของผู้ใช้ไว้ ไม่มี reset, stash, commit, push, PR, merge หรือ deployment
- ก่อน commit ต้องรวมไฟล์ใหม่ที่ระบบใช้จริงด้วย เช่น stylesheet/component, `src/shared/goals.ts`, `src/server/weight.ts`, brand/fonts, migrations, Dockerfile, build script, tests และเอกสาร อย่า commit เฉพาะ tracked files
- เมื่อต้องรวมงานจริง ให้ตรวจหัวสาขาปลายทางใหม่และตรวจ diff ของทั้งชุดอีกครั้ง เพราะเพื่อนอาจ push งานเพิ่มหลังการตรวจครั้งนี้
- ผลนี้ยืนยัน code/build/local regression; ไม่ใช่ผล CI บน GitHub หรือการตรวจ production หลัง deploy ชุดคลีน

## ขอบเขตที่รักษาไว้

ยังมี 4 แท็บเดิม ไม่มี feature หรือ route ใหม่ ไม่มีการเปลี่ยน schema/migration, สูตรโภชนาการ, save/recalculation flow หรือสิทธิ์ข้อมูลในงานคลีนนี้ CSS cascade ส่วนที่ยังใช้ไม่ได้ถูกรื้อทั้งหมด เพราะต้องรักษาภาพและพฤติกรรมที่ทดสอบแล้ว
