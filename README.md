# LifeBalance

อัปเดตเอกสารวันที่ 16 ต.ค. 2569 โดยทีม **Another (se-sec1-team-10)** รายละเอียดฟังก์ชันดูคู่มือผู้ใช้ ส่วนผลทดสอบและ deployment ดูหลักฐานของแต่ละรุ่น

LifeBalance เป็นแดชบอร์ดสำหรับติดตามสุขภาพส่วนบุคคลที่ออกแบบมาเพื่อช่วยให้ผู้ใช้งานสามารถดูแลสุขภาพได้สะดวกยิ่งขึ้น โดยเฉพาะวัยทำงานที่มีเวลาจำกัดในการวางแผนและติดตามการรับประทานอาหาร

ระบบสามารถคำนวณปริมาณแคลอรี บันทึกข้อมูลด้านสุขภาพ เช่น น้ำหนัก ส่วนสูง และข้อมูลการรับประทานอาหาร พร้อมทั้งสรุปผลและแสดงข้อมูลทั้งหมดในหน้าแดชบอร์ดเดียว ทำให้ผู้ใช้สามารถติดตามความคืบหน้าของตนเองได้อย่างง่ายดาย

LifeBalance ช่วยลดความยุ่งยากจากการคำนวณด้วยตนเองหรือการใช้งานหลายแอปพลิเคชันร่วมกัน ผู้ใช้จึงสามารถประหยัดเวลา วางแผนการรับประทานอาหารได้อย่างเหมาะสม และสร้างสมดุลในการดูแลสุขภาพในชีวิตประจำวันได้อย่างมีประสิทธิภาพ

## เว็บและสื่อนำเสนอ

| รายการ | ลิงก์ / สถานะ |
|---|---|
| เว็บ LifeBalance | [เปิดระบบ](https://lifebalance-8btj.onrender.com/) |
| สไลด์นำเสนอและวิดีโอการใช้งาน | [เปิดสไลด์พร้อมวิดีโอใน Canva](https://canva.link/42frmidv71h2tk7) |
| คู่มือใช้งาน | [วิธีใช้ทั้ง 4 หน้าหลัก](docs/user-guide.md) |
| หลักฐาน CI/CD ที่บันทึกไว้ | [ผล workflow และ deployment proof](docs/deployment/continuous-deployment.md#latest-recorded-verification--16-october-2026) |

## สารบัญเอกสาร

เลือกเอกสารตามเรื่องที่ต้องการอ่าน ส่วนภาพรวม สมาชิก และขั้นตอนเปิดระบบอยู่ใน README นี้

| ต้องการดูเรื่องอะไร | เอกสาร | เนื้อหา |
|---|---|---|
| วิธีใช้งานระบบ | [คู่มือผู้ใช้](docs/user-guide.md) | เริ่มใช้งาน บันทึกและแก้อาหาร ติดตามความคืบหน้า และตั้งค่าบัญชี |
| วิธีติดตั้งและทดสอบในเครื่อง | [คู่มือทดสอบในเครื่อง](docs/local-testing.md) | เตรียมฐานข้อมูล เปิดเว็บและ API และเลือกวิธีทดสอบ |
| เริ่มพัฒนาและตำแหน่งโค้ด | [คู่มือสมาชิกทีม](docs/team-development-guide.md) | โครงสร้างโค้ด ขั้นตอนพัฒนา และเช็กลิสต์ก่อนส่งงาน |
| สถาปัตยกรรมและเหตุผลการตัดสินใจ | [สถาปัตยกรรม / ADR](docs/architecture/README.md) | ภาพรวมระบบและดัชนีบันทึกการตัดสินใจด้านสถาปัตยกรรม |
| แผนภาพระบบ C4 | [System Context](docs/architecture/c4-context.md) · [Container](docs/architecture/c4-container.md) | ผู้ใช้ บริการภายนอก และส่วนประกอบของระบบ |
| แบบจำลองการใช้งานและข้อมูล | [Use cases / UML](docs/architecture/uml_models.md) | กรณีใช้งานหลักและความสัมพันธ์ของ Prisma models |
| Requirements และสถานะการตรวจ | [User Stories](docs/requirements/user-stories.md) · [NFR](docs/requirements/nfr.md) | ข้อกำหนดตั้งต้นและขอบเขตหลักฐานที่มี |
| เครื่องมือที่ใช้ | [Technology stack](docs/architecture/tech_stack.md) | เทคโนโลยีและหน้าที่ของแต่ละส่วน |
| ตั้งค่า AI วิเคราะห์อาหาร | [คู่มือตั้งค่า AI](docs/ai-setup.md) | การตั้งค่าบริการ AI และการเชื่อมต่อ |
| CI/CD และ deploy อัตโนมัติ | [คู่มือ CD](docs/deployment/continuous-deployment.md) | เงื่อนไขการปล่อยรุ่นและขั้นตอนตรวจสอบ |
| Deploy ด้วยตนเอง | [Docker / Render](docs/deployment/render-docker.md) | ขั้นตอนนำระบบขึ้นออนไลน์แบบ manual |
| ผลทดสอบและหลักฐานทางเทคนิค | [ดัชนีรายงานทดสอบ](docs/testing/readme.md) | ลิงก์รายงานและหลักฐานของแต่ละรอบทดสอบ |
| บันทึกการใช้ AI ช่วยพัฒนา | [AI Usage](AI_USAGE.md) | เครื่องมือ AI ที่ใช้ งานที่ช่วยร่าง และส่วนที่ผู้เขียนทบทวน |

## Team: Another

| สมาชิก | GitHub |
|---|---|
| จิตตินี สุดตา | [@JJ08039](https://github.com/JJ08039) |
| ชยากร เตชะพัฒนาวงศ์ | [@Chayakorn05](https://github.com/Chayakorn05) |
| ภัทรพล รัชนิกรเพ็ญ | [@Pattarapol01](https://github.com/Pattarapol01) |

---

## 🚀 Getting Started

โปรเจกต์ปัจจุบันเป็นเว็บแอปแบบ Modular Monolith โดยใช้ React + TypeScript สำหรับหน้าเว็บ, Node.js + Express สำหรับ API และ PostgreSQL + Prisma สำหรับฐานข้อมูล

### Prerequisites

- Git
- Node.js 22.12+
- PostgreSQL ที่ตั้งค่าใช้งานได้ (หรือ Docker Desktop/Engine พร้อม Compose เพื่อเปิดฐานข้อมูลในเครื่อง)

### Running the Application

เตรียม `.env` ให้ชี้ไปยัง PostgreSQL ที่ใช้ และเก็บ connection string กับ secret ไว้ในไฟล์นี้เท่านั้น หากใช้ฐานข้อมูลร่วมของทีมที่เตรียม schema แล้ว ไม่ต้องรัน migration หรือ seed ซ้ำ หากใช้ PostgreSQL ใหม่ในเครื่อง สามารถเปิดด้วย Docker Compose ได้ ดู [วิธีเปิดและทดสอบในเครื่อง](docs/local-testing.md)

1. **ติดตั้ง dependencies:**
    ```bash
    npm ci
    ```

2. **สร้างไฟล์ environment จากตัวอย่าง:**
    ```powershell
    Copy-Item .env.example .env
    ```
    จากนั้นตั้ง `DATABASE_URL` ของฐานที่ได้รับอนุญาตให้ใช้ และแก้ `JWT_SECRET` ใน `.env` เป็นค่าสุ่มที่มีความยาวอย่างน้อย 32 ตัวอักษร แล้วสร้าง Prisma Client:
    ```bash
    npm run db:generate
    ```

3. **ถ้าใช้ PostgreSQL ในเครื่อง ให้เปิดฐานข้อมูลและเตรียม schema:**
    ```bash
    docker compose up -d db
    npm run db:migrate
    ```

4. **เปิดระบบสำหรับพัฒนา:**
    ```bash
    npm run dev
    ```

หน้าเว็บอยู่ที่ `http://localhost:5173` และ API อยู่ที่ `http://localhost:3000`

### Verification

```bash
npm test
npm run build
```

### เว็บแอปมือถือและ AI วิเคราะห์รูป

ทุกขนาดจอใช้หน้าแอปเดียวกัน: หน้าแรก / บันทึก / ความคืบหน้า / บัญชี หน้าอาหารรองรับถ่ายรูปหรือเลือกรูป → วิเคราะห์ → ตรวจแก้ → ยืนยันบันทึก ค่าสารอาหารจาก AI เป็นค่าประมาณ ไม่ใช่ผลวัดจริง

หน้าแรกเลือกวันย้อนหลังและเพิ่ม/แก้/ลบอาหารของวันนั้นได้ โดยแยกรายการตามมื้อ หน้า “ความคืบหน้า” บันทึกน้ำหนักและแก้ประวัติได้โดยไม่ต้องเปิดข้อมูลส่วนตัว ดูขั้นตอนใน [คู่มือใช้งาน](docs/user-guide.md)

ใส่ค่าจริงใน `.env` เท่านั้น (`.env.example` เป็นตัวอย่างสาธารณะ):

```dotenv
AI_BASE_URL=https://gen.ai.kku.ac.th/upacth/api/v1
AI_API_KEY=
AI_MODEL=
AI_DAILY_SCAN_LIMIT=50
NUTRITION_API_KEY=
```

`AI_MODEL` ใช้ชื่อโมเดลที่มหาวิทยาลัยเปิดให้และรองรับภาพ ส่วน `NUTRITION_API_KEY` เป็น key ของ USDA/data.gov อีกบริการหนึ่ง ใช้เฉพาะการค้นข้อมูลสารอาหาร หากเว้นว่างยังใช้ AI ได้ อ่านรายละเอียดที่ [คู่มือตั้งค่า AI](docs/ai-setup.md)

หลังแก้ `.env` ให้บันทึกไฟล์และเริ่ม API ใหม่ ต้องมี PostgreSQL และ schema พร้อมใช้งาน สำหรับฐานใหม่ให้ผู้รับผิดชอบรัน migration ก่อน ส่วนฐานร่วมที่เตรียมไว้แล้วไม่ต้องรัน migration/seed ซ้ำ หน้าเว็บทดสอบกับ API จำลองไม่ยืนยันการบันทึกฐานข้อมูลจริง

ทดสอบ UI ด้วย Edge ที่ติดตั้งในเครื่อง:

```bash
npm run test:e2e
```

ชุดทดสอบ UI เปิดเว็บชั่วคราวที่ port 5174 และจำลอง API จึงไม่ใช้ฐานข้อมูล, key หรือโควตา AI ชุด browser tests นี้และ unit/build checks ทำงานใน CI ด้วย ส่วนการทดสอบแบบ live ใช้ฐานข้อมูลจริงและไม่ทำงานใน CI จึงควรใช้ฐานข้อมูลทดสอบแยก ดูรายละเอียดที่ [คู่มือทดสอบในเครื่อง](docs/local-testing.md) และ [รายงานทดสอบ](docs/test-report-mobile.md)

ขณะนี้ระบบรองรับการสมัครสมาชิก, เข้าสู่ระบบ, ออกจากระบบ, แก้ไขข้อมูลสุขภาพส่วนตัว, บันทึกอาหารพร้อมส่วนประกอบและรูปประกอบ, และบันทึกการออกกำลังกาย ระบบคำนวณ BMI, แคลอรีจากสารอาหาร, แคลอรีที่เผาผลาญ และ Net Calories รายวันให้อัตโนมัติ

---

## 🏛️ Architecture & Design

เอกสารปัจจุบันสำหรับอ่านระบบและประกอบ Demo:

- **[คู่มือใช้งาน (USER_GUIDE)](./docs/user-guide.md)** — ขั้นตอนใช้ทั้ง 4 หน้าหลักและตรวจแก้อาหาร
- **[C4 System Context](./docs/architecture/c4-context.md)** และ **[C4 Container](./docs/architecture/c4-container.md)** — ใช้แผนภาพ Mermaid ปัจจุบัน; รูปเก่าใน `diagrams/` เป็นประวัติ
- **[สถาปัตยกรรมและดัชนี ADR](./docs/architecture/README.md)** — แยกการตัดสินใจที่ใช้อยู่กับแนวทางที่ถูกแทนที่
- **[Technology stack](./docs/architecture/tech_stack.md)** และ **[Use cases / UML](./docs/architecture/uml_models.md)**

### CI/CD และหลักฐาน

CI ตรวจ Python lint/tests, TypeScript build/tests/coverage และ performance กับ PostgreSQL ชั่วคราว การวัดปกติใช้ผู้ใช้จำลอง 1 คน ทำซ้ำ 20 รอบ โดยทุก response/action ที่วัดต้องน้อยกว่า 2 วินาที ผลนี้ไม่รวมเวลา Render เริ่มบริการ, browser rendering หรือ AI และไม่ใช่การพิสูจน์รองรับผู้ใช้พร้อมกัน

เมื่อ push เข้า `main` และ CI ผ่านครบ พร้อมตั้ง `CD_ENABLED=true` และ secrets ที่จำเป็น CD จะ build/push image ไป Docker Hub แล้ว deploy image ตาม digest ไป Render พร้อมตรวจ revision, health และไฟล์เว็บ PR และ branch อื่นไม่ deploy production กระบวนการนี้ไม่รัน migration/seed กับฐาน production

วิธีนี้เป็นแนวทาง deploy หลัก โดย Render ใช้ Existing Image; วิธี build/deploy เองเป็นแผนสำรอง ตาม [ADR 0002](docs/architecture/adr/0002-ci-gated-image-deployment.md) หลักฐานที่ตรวจวันที่ 16 ต.ค. 2569 คือ [CI #171 attempt 3](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38163220860/attempts/3) ของ commit `bc10444` ผ่านครบ 5 jobs และมี deployment proof รอบนี้เป็นการ rerun ของ main push เดิม ไม่ใช่ผลจาก push ใหม่

ดู [คู่มือ CD](./docs/deployment/continuous-deployment.md), [วิธี deploy แบบ manual สำรอง](./docs/deployment/render-docker.md) และ [ดัชนีรายงานทดสอบ](./docs/testing/readme.md) รายงานที่มีวันที่เป็นหลักฐานของรอบนั้น ไม่ใช่การยืนยันสถานะเว็บล่าสุด

## 👩‍💻 คู่มือสำหรับสมาชิกทีม

เริ่มอ่าน [คู่มือเริ่มพัฒนา LifeBalance สำหรับทีม](./docs/team-development-guide.md) เพื่อดูตำแหน่งของโค้ด หน้าจอที่มีอยู่ วิธีเปิดระบบ และเช็กลิสต์ก่อนส่งงาน

ดู [แผนแบ่งงานเดิม](./docs/team-work-allocation.md) สำหรับบริบทการแบ่งขอบเขตไฟล์ ส่วนสถานะงานปัจจุบันให้ตรวจ Issue และ PR ของงานนั้น

## 👥 Requirements

ข้อกำหนดและ persona เก็บบริบทการออกแบบตั้งต้นไว้ ฟังก์ชันที่ใช้งานได้ในปัจจุบันอ้างอิง [คู่มือผู้ใช้](docs/user-guide.md) และผลตรวจรายข้ออยู่ใน [NFR](docs/requirements/nfr.md)

- **[User Personas](./docs/requirements/personas.md)**
- **[User Scenarios](./docs/requirements/scenarios.md)**

## แนวทางทำงานร่วมกัน

- ตกลงขอบเขตงานและผู้รับผิดชอบใน Issue หรือ PR ก่อนแก้ไฟล์ร่วมกัน
- ใช้ branch ที่ตกลงกับเจ้าของงาน ส่งการเปลี่ยนแปลงเข้า `life-balance-test` ก่อน แล้วจึงเปิด PR เข้า `main`
- เขียน commit ให้บอกสิ่งที่เปลี่ยน เช่น `fix: handle expired session on goal save` และอธิบายปัญหา การแก้ และผลตรวจใน PR
- ก่อนรวมเข้า `main` ต้องผ่าน checks ที่กำหนดและมีผู้ review กด Approve อย่างน้อย 1 คน ไม่ข้ามกฎ protected branch
- ทดสอบส่วนที่ได้รับผลกระทบ บันทึกผลพร้อม revision และแยกผลทดสอบในเครื่องออกจากผลบนระบบจริง
- บันทึกเหตุผลของการตัดสินใจด้านสถาปัตยกรรมใน ADR และอัปเดตคู่มือเมื่อพฤติกรรมระบบเปลี่ยน

ช่องทางสื่อสารและตารางนัดหมายให้สมาชิกตกลงร่วมกันตามช่วงงาน
