# ADR-001: Selection of Core Technology Stack

**Status:** Superseded by [ADR 0001: Modular Monolith](./0001-monolith-vs-microservices.md) on August 25, 2026
**Date:** July 21, 2026  
**Decision Makers:** LifeBalance Development Team  

**Implementation note (11 October 2026):** The following text preserves the original proposal. The current application uses React + Vite, Node.js + Express and PostgreSQL through Prisma; Python/FastAPI, Redis and separate frontend hosting described here are not the current application stack. See the [implemented technology stack](../tech_stack.md) and [C4 containers](../c4-container.md).

---

## Context (บริบท)

โปรเจกต์ **LifeBalance** เป็น Web Application สำหรับการจัดการสุขภาพและสมดุลชีวิต มุ่งเน้นผู้ใช้หลักสองกลุ่ม:

1. **กรณ์ (Korn)** - วัยทำงานที่ต้องการ Data-driven health insights และ Dashboard ที่โหลดเร็ว (< 1.5 วินาที)
2. **พิมพ์ (Pim)** - คุณแม่หลังคลอดที่ต้องการสูตรคำนวณแคลอรี่แบบพิเศษ (WHO Post-partum Formula) และระบบ Reminder

### Constraints & Requirements (ข้อจำกัดและความต้องการ):

| Category | Requirement |
|----------|-------------|
| **Timeline** | 1 Semester (ประมาณ 15 สัปดาห์) |
| **Team Size** | 3-5 นักศึกษา |
| **Team Experience** | มีความรู้พื้นฐาน HTML/CSS/JavaScript, Python ระดับกลาง |
| **Performance** | Dashboard ต้องโหลดภายใน < 1.5 วินาที (ตาม Pain Point ของ กรณ์) |
| **Data Complexity** | ข้อมูลมีโครงสร้างชัดเจน (Relational): Users → FoodLogs → WeightRecords → Goals |
| **External Integrations** | Google Fit API, Apple HealthKit, Nutrition Database, Email/Push Notifications |
| **Special Logic** | สูตรคำนวณแคลอรี่ WHO สำหรับคุณแม่ให้นม (Mathematical computation) |

---

## Decision (การตัดสินใจ)

เราได้ตัดสินใจเลือก Technology Stack ดังนี้:

### Frontend: React + Vite

| Aspect | Detail |
|--------|--------|
| **Framework** | React 18+ (with Hooks) |
| **Build Tool** | Vite 5+ |
| **State Management** | React Query (TanStack Query) + React Context |
| **Charting Library** | Chart.js / Recharts (for weight trend graphs) |
| **HTTP Client** | Axios |
| **Styling** | Tailwind CSS |

### Backend: Python + FastAPI

| Aspect | Detail |
|--------|--------|
| **Language** | Python 3.11+ |
| **Framework** | FastAPI (async support) |
| **Authentication** | JWT (jsonwebtoken) |
| **Validation** | Pydantic v2 |
| **Task Queue** | Celery + Redis (for notification scheduling) |
| **Special Libraries** | NumPy (for linear regression on weight predictions) |

### Database: PostgreSQL 15+

| Aspect | Detail |
|--------|--------|
| **Database** | PostgreSQL 15+ |
| **ORM** | SQLAlchemy 2.0 (async) |
| **Migrations** | Alembic |
| **Connection Pool** | asyncpg |

### Cache & Message Broker: Redis

| Aspect | Detail |
|--------|--------|
| **Cache** | Redis 7+ |
| **Use Cases** | Session storage, Dashboard query cache, Rate limiting |
| **Message Broker** | Redis Pub/Sub (for real-time updates) |

### Deployment Infrastructure

| Component | Platform | Reason |
|-----------|----------|--------|
| **Frontend** | Vercel | Free tier, auto-deploy from Git, CDN included |
| **Backend** | Railway / Render | Free tier supports Python + PostgreSQL |
| **Database** | Railway / Supabase (PostgreSQL) | Managed PostgreSQL, automatic backups |
| **CI/CD** | GitHub Actions | Automated testing and deployment |

---

## Justification (เหตุผลการตัดสินใจ)

### 1. เหตุผลที่เลือก React + Vite (Frontend)

**Pros:**
- **Component-based Architecture:** ช่วยให้สร้าง UI elements ที่ reusable ได้ง่าย (เช่น Progress Bar, Calorie Card, Weight Chart) - ตรงตามความต้องการของ พิมพ์ที่ต้องการ UI ที่เข้าใจง่าย
- **Vite's Fast HMR:** Hot Module Replacement ที่รวดเร็ว ช่วยลดเวลา development อย่างมาก
- **Large Ecosystem:** มี library มากมายสำหรับ Charts (Recharts), Forms (React Hook Form), State Management
- **Team Familiarity:** ทีมมีความรู้ JavaScript อยู่แล้ว  learning curve ไม่สูงมาก
- **SPA Performance:** หลังจาก load ครั้งแรก การ navigate ระหว่าง pages จะรวดเร็วมาก - ตอบโจทย์ความต้องการของ กรณ์ที่ต้องการ dashboard โหลด < 1.5 วินาที

**Why NOT Next.js?**
- Next.js เหมาะกับ SSR/SSG แต่ LifeBalance เป็น Application ที่ต้องการ Real-time interactivity มากกว่า SEO
- การใช้ React SPA ทำให้ frontend และ backend แยกกันชัดเจน ง่ายต่อการ develop และ deploy แยกกัน

---

### 2. เหตุผลที่เลือก Python + FastAPI (Backend)

**Pros:**
- **Fast Performance:** FastAPI เป็นหนึ่งใน Python framework ที่เร็วที่สุด (comparable to NodeJS) ด้วย Starlette async
- **Automatic Documentation:** Swagger UI และ ReDoc ถูก generate อัตโนมัติ - ลดเวลาเขียน docs
- **Pydantic Validation:** Data validation ที่แข็งแกร่ง ช่วย catch errors ก่อนถึง business logic
- **NumPy Integration:** สำคัญมากสำหรับการคำนวณ **Linear Regression** สำหรับ Weight Trend Prediction (ตาม requirement ของ พิมพ์)
- **WHO Formula Implementation:** Python มี readability สูง ทำให้การ implement สูตรคณิตศาสตร์ที่ซับซ้อน (Post-partum Metabolic Rate) ทำได้ง่ายและ maintain ได้สะดวก
- **Celery for Async Tasks:** การส่ง Notification/Reminder ทุก 3 ชั่วโมง (ตาม requirement ของ พิมพ์) สามารถทำได้ผ่าน background workers

**Why NOT Node.js/Express?**
- แม้ Node.js จะเร็ว แต่ Python มีข้อได้เปรียบด้าน Data Processing และ Mathematical Computation ที่ชัดเจนสำหรับ use case นี้
- ทีมมีความสามารถ Python ระดับกลาง ทำให้สามารถ focus บน business logic มากกว่า learning curve

---

### 3. เหตุผลที่เลือก PostgreSQL (Database)

**Pros:**
- **Relational Model:** ข้อมูลของ LifeBalance มี Relationships ที่ชัดเจน:
  ```
  User 1──N FoodLog
  User 1──N WeightRecord  
  User 1──1 GoalSetting
  User 1──N ActivitySync
  FoodLog N──1 FoodItem (from Nutrition DB)
  ```
- **ACID Compliance:** ความสำคัญสำหรับ Health Data - ไม่ควรมี data loss หรือ inconsistency
- **JSONB Support:** สามารถเก็บ flexible data (เช่น raw activity data from Google Fit) ได้ใน column เดียว
- **Excellent Time-series Queries:** สำหรับ queries แบบ "show me weight trend for past 12 months" ที่ กรณ์ ต้องการ
- **Mature Ecosystem:** มี tooling ที่ดี (pgAdmin, pg_stat_statements) สำหรับ monitoring

**Why NOT MongoDB/NoSQL?**
- ข้อมูลของเรามี schema ที่ชัดเจนและ relationships ที่ซับซ้อน - NoSQL จะทำให้ต้อง manage relationships เองทั้งหมด
- ACID guarantees สำคัญกว่า flexibility สำหรับ health data

---

### 4. เหตุผลที่เลือก Redis (Cache Layer)

**Pros:**
- **Session Management:** เก็บ JWT session และ user preferences ไว้ใน memory ทำให้ authenticate ได้รวดเร็ว
- **Dashboard Cache:** Cache ผลลัพธ์ query ที่ซับซ้อน (เช่น aggregate daily calories) ช่วยให้ dashboard โหลดเร็ว - ตอบโจทย์ < 1.5 วินาที ของ กรณ์
- **Rate Limiting:** ป้องกัน API abuse
- **Celery Broker:** ทำหน้าที่เป็น Message Broker สำหรับ Task Queue ด้วย

---

### 5. เหตุผลที่เลือก Vercel + Railway (Deployment)

**Pros:**
- **Free Tier:** เหมาะกับ student project ที่มีงบจำกัด
- **Git Integration:** Auto-deploy เมื่อ push ไปยัง main branch - ลดความซับซ้อนของ CI/CD
- **Managed Services:** ไม่ต้องดูแล server infrastructure เอง
- **CDN Included:** Vercel Edge Network ช่วยให้ frontend โหลดเร็วทั่วโลก

---

## Consequences (ผลกระทบ)

### ✅ Positive Consequences (ผลบวก)

1. **Aligned with Team Skills:** Stack ที่เลือกตรงกับความสามารถปัจจุบันของทีม ลด learning curve และ accelerate initial development
2. **Excellent Performance:** 
   - React SPA + Redis cache = Dashboard response < 1.5 วินาที ✅
   - FastAPI async = High throughput for concurrent users
3. **Strong Data Integrity:** PostgreSQL ACID = ไม่มี data loss สำหรับ health records
4. **Mathematical Capability:** Python + NumPy = สามารถ implement Linear Regression และ WHO formulas ได้ง่าย
5. **Scalability:** แต่ละ component แยกกันชัดเจน สามารถ scale อิสระกันได้
6. **Developer Experience:** 
   - FastAPI auto-docs = ลดเวลาเขียน API documentation
   - Vite HMR = ลดเวลารอ development build
   - TypeScript (optional) = Type safety สำหรับ larger codebase

### ⚠️ Negative Consequences / Trade-offs (ผลลบ / การแลกเปลี่ยน)

1. **Separate Deployments:** ต้องจัดการ Frontend (Vercel) และ Backend (Railway) แยกกัน - เพิ่มความซับซ้อนใน deployment pipeline เมื่อเทียบกับ monolithic solution เช่น Next.js หรือ Django
2. **Cold Start Issues:** 
   - Railway free tier อาจมี cold start latency (10-30 วินาที) เมื่อไม่มีการใช้งานนาน
   - อาจส่งผลต่อ demo หรือ presentation ถ้าไม่มี traffic มากพอ
3. **Infrastructure Complexity:** ต้อง manage 4 components (Frontend, Backend, PostgreSQL, Redis) แทนที่จะเป็น single service
4. **Cost at Scale:** 
   - Free tiers มี limits (เช่น Railway 500 hours/month, Vercel bandwidth limits)
   - ถ้าโปรเจกต์โต จำเป็นต้อง upgrade จ่ายเงิน
5. **Python Async Learning Curve:** แม้ FastAPI จะง่าย แต่ async/await pattern ใน Python อาจต้องศึกษาเพิ่มสำหรับทีมที่เคยใช้ synchronous Python มาก่อน
6. **No Real-time Built-in:** ต้องเพิ่ม WebSocket library (เช่น Socket.io) เอง ถ้าต้องการ real-time features ในอนาคต

---

## Alternatives Considered (ทางเลือกอื่นที่พิจารณา)

| Technology | Why Considered | Why Rejected |
|------------|----------------|--------------|
| **Next.js (Full-stack)** | Single deployment, SSR support | Overkill for this use case; tighter coupling between FE/BE |
| **Node.js + Express** | Same language as frontend (JavaScript) | Weaker math/data processing ecosystem for WHO formulas |
| **MongoDB** | Flexible schema, easy to start | Poor fit for relational health data; no ACID by default |
| **Django** | Batteries-included, admin panel | Heavier than needed; slower for pure API backend |
| **Supabase (BaaS)** | Auth, DB, Real-time included | Vendor lock-in risk; less control over architecture |
| **AWS Free Tier** | Industry standard, more services | Complex setup; steep learning curve for students |

---

## Implementation Notes (หมายเหตุการนำไปใช้)

### Recommended Project Structure:

```
lifebalance/
├── frontend/                 # React + Vite
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── dashboard/
│   │   │   ├── charts/
│   │   │   └── forms/
│   │   ├── pages/            # Route pages
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client (Axios)
│   │   └── utils/            # Helper functions
│   └── package.json
├── backend/                  # Python + FastAPI
│   ├── app/
│   │   ├── api/              # Route handlers
│   │   ├── models/           # SQLAlchemy models
│   │   ├── schemas/          # Pydantic schemas
│   │   ├── services/         # Business logic
│   │   │   ├── calorie_calc.py    # WHO formula implementation
│   │   │   └── prediction.py      # Linear regression for weight
│   │   ├── core/             # Config, security
│   │   └── tasks/            # Celery tasks (notifications)
│   └── requirements.txt
├── docker-compose.yml        # Local development setup
└── README.md
```

### Key Dependencies:

**Frontend (package.json):**
```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@tanstack/react-query": "^5.45.0",
    "axios": "^1.7.0",
    "recharts": "^2.12.0",
    "react-hook-form": "^7.52.0",
    "zod": "^3.23.0",
    "date-fns": "^3.6.0"
  },
  "devDependencies": {
    "vite": "^5.3.0",
    "typescript": "^5.5.0",
    "@types/react": "^18.3.0",
    "tailwindcss": "^3.4.0"
  }
}
```

**Backend (requirements.txt):**
```
fastapi==0.111.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.30
asyncpg==0.29.0
alembic==1.13.0
pydantic==2.7.0
pydantic-settings==2.3.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
redis==5.0.0
celery==5.3.6
httpx==0.27.0
numpy==1.26.0
scipy==1.13.0
python-multipart==0.0.9
```

---

## References (อ้างอิง)

1. **C4 Model Reference:** https://c4model.com/
2. **FastAPI Documentation:** https://fastapi.tiangolo.com/
3. **WHO Obesity Guidelines:** https://www.who.int/publications/i/item/9789241500884
4. **ADR Template:** https://adr.github.io/madr/

---

*This ADR follows the [Architecture Decision Record](https://adr.github.io/) format.*
