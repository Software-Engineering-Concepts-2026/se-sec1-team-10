# ตรวจและปรับเอกสาร LifeBalance — 9 ต.ค. 2569

ตรวจตาม working tree ของ branch `feature/Chayakorn05` ไม่ใช่การตรวจรุ่นบน Render และไม่เปลี่ยนโค้ดแอป/ฐานข้อมูลในรอบนี้

## สิ่งที่พบและแก้

| กลุ่ม | ไฟล์ | ข้อมูลที่ปรับ |
| --- | --- | --- |
| จุดเริ่มต้น | `README.md` | ชื่อแท็บ หน้าแรก, ฟังก์ชันวันที่ย้อนหลัง/น้ำหนัก, Prisma generate และลิงก์ requirements ที่เสีย |
| ผู้ใช้ | `docs/user-guide.md` | เพิ่มคู่มือ 4 แท็บ จากพฤติกรรมที่มีจริง รวมตรวจ/บันทึกอาหาร การใช้ซ้ำ น้ำหนัก เป้าหมายและเตือน |
| พัฒนาและทดสอบ | `docs/team-development-guide.md`, `docs/local-testing.md` | แยกฐานใหม่/ฐานร่วมที่เตรียมแล้ว, code map และคำสั่งทดสอบแต่ละ environment |
| UI | `docs/ui/lifebalance-ui-design-brief.md` | รวมเป็นข้อกำหนดปัจจุบัน ลดข้อความเก่าที่ขัดกัน: วันย้อนหลัง, กลุ่มมื้อ, การ์ดประวัติ, icon pastel, ส่วนประกอบไม่มีรูป, desktop และบัญชี |
| โปรไฟล์/รูป | `docs/ui/profile-photo-and-brand.md` | ใช้ Prisma migrations เป็นขั้นตอนหลัก; การแก้ผ่าน SQL Editor เดิมเป็นเหตุการณ์ย้อนหลัง, โลโก้หน้าแรกและรายละเอียดโปรไฟล์กดขยาย |
| โภชนาการ/catalog | `docs/goals.md`, `docs/food-catalog.md` | ชื่อหน้าและ save/weight flow; แยก setup ฐานใหม่จากฐานร่วม ไม่เปลี่ยนสูตรหรือแหล่งอ้างอิงเดิม |
| AI/Deploy | `docs/ai-setup.md`, `docs/deployment/render-docker.md` | กรอกชื่อไม่ได้หมายถึงกรอกสารอาหารเอง; catalog ก่อน AI, รายงาน deployment มีวันที่เป็นประวัติ |
| สถาปัตยกรรม | `docs/architecture/README.md`, `tech_stack.md`, `c4-context.md`, `c4-container.md` | React/Express แทน FastAPI/Redis เดิม, integrations ที่มีจริง, Mermaid fence และแยก logical C4 containers จาก Docker image ที่รวมเว็บ/API |
| ดัชนี/CI/source | `docs/testing/readme.md`, `.github/workflows/readme.md`, `src/readme.md`, `src/tests/README.md` | workflow ที่มีอยู่จริง, หมวด tests และลิงก์ไปคู่มือที่เกี่ยวข้อง |

## วิธีตรวจ

เทียบข้อความกับ `package.json`, Vite/Playwright configs, CI workflow, Dockerfile/compose, client panels/styles, shared goals/contracts, server routes/repository และ Prisma migration paths ไม่อ่าน `.env` จริงหรือเปิดเผย credential

- ตรวจ relative Markdown links ของคู่มือที่แก้และ `docker/README.md`
- ตรวจ code fences ว่าปิดครบ
- ตรวจชื่อ `npm run` scripts เทียบกับ `package.json`
- ตรวจ path ของไฟล์โค้ดที่คู่มืออ้างถึง
- ตรวจ diff ของเอกสารและ `git diff --check`

ผลตรวจสุดท้าย:

| ตรวจ | ผล |
| --- | --- |
| คู่มือที่ตรวจ | 20 ไฟล์: ปรับ/เพิ่ม 19 ไฟล์ และ Docker README เดิมไม่ต้องแก้ |
| Relative Markdown links | 67 จุด ปลายทางมีอยู่ครบ |
| npm script references | 49 จุด ชื่อตรงกับ `package.json` |
| Source paths ในคู่มือ | 61 จุด มีไฟล์/โฟลเดอร์จริง |
| Code fences | ปิดครบทุกไฟล์ที่ตรวจ |
| ข้อมูลประกอบ | 4 ชื่อแท็บ, breakpoint desktop 1024px, badge icon 36px และ catalog seed 25 รายการตรงกับโค้ด |
| Diff review / `git diff --check` | ผ่าน ไม่มีการแก้ไฟล์แอปเพิ่มเติมจากงาน UI ที่ค้างก่อนรอบนี้ |

ตัวตรวจและผลลัพธ์ในเครื่อง: `.local/doc-audit-20261009/check-docs.mjs` และ `result.json` ไม่มีการตรวจ URL ภายนอกหรือ provider สด

## ขอบเขตและข้อจำกัด

- `docker/README.md` ตรงกับ Dockerfile ปัจจุบันแล้ว จึงไม่แก้
- ไม่เขียนผลทดสอบเก่าย้อนหลังให้เหมือนทดสอบใหม่: รายงาน deploy/test ที่มีวันที่, ADR, proposal, personas และ draw.io diagrams เดิมคงเป็นประวัติ/แนวคิดช่วงนั้น README สถาปัตยกรรมชี้ไป Mermaid ปัจจุบันแทน
- การตรวจนี้ตรวจเอกสารและโค้ดในเครื่อง ไม่ยืนยันสถานะ hosting, image tag, migration history หรือข้อมูลในฐานจริง
- ไม่รัน app tests/build ซ้ำ เพราะเปลี่ยนเฉพาะ Markdown; ไม่เรียก AI, migrate, seed, commit, push, merge หรือ deploy ในรอบนี้

เริ่มอ่านที่ [คู่มือใช้งาน](../user-guide.md), [คู่มือพัฒนา](../team-development-guide.md) หรือ [Deploy](../deployment/render-docker.md)
