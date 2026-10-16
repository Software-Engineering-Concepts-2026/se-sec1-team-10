> **รายงานย้อนหลัง:** เก็บผลและขอบเขตของรอบเดิมไว้ ดูหลักฐาน CI/CD ล่าสุดที่บันทึกใน [คู่มือ CD](../deployment/continuous-deployment.md) โดยผลเก่าด้านล่างไม่ใช่การทดสอบรุ่นปัจจุบันซ้ำ

# Performance ตามเกณฑ์ Demo — 11 ตุลาคม 2569

## เกณฑ์และขอบเขต

เอกสาร Grand Finale ข้อ 2.2 ระบุ `response < 2s` โดยไม่ได้กำหนดจำนวนผู้ใช้พร้อมกันหรือ percentile รอบนี้จึงวัดผู้ใช้จำลอง **1 คน ใช้งานทีละขั้น** และทำซ้ำ 20 ครั้งต่อรายการ ไม่ทดสอบ 100 คนตามคำขอของผู้ใช้

เงื่อนไขผ่านของสคริปต์: **ทุก HTTP response และ API action ที่วัดต้องสำเร็จและใช้เวลาน้อยกว่า 2,000 ms** รวม sample แรกของแต่ละรายการ ค่า p95 เป็นข้อมูลประกอบ ไม่ใช้แทนเงื่อนไขทุกครั้ง ต้อง cleanup ทรัพยากรทดสอบสำเร็จด้วย

นี่เป็นการเลือกวิธีวัดเพื่อเทียบเป้าหมาย Demo ไม่ใช่การอ้างว่าอาจารย์กำหนดให้ใช้ค่า max หรือทดสอบ 20 ครั้ง เอกสารโปรเจกต์ [NFR-07](../requirements/nfr.md) ยังมีเกณฑ์ 100 concurrent users และไม่ถูกลบหรือพิสูจน์ใหม่ด้วยรอบนี้

## สภาพแวดล้อมและแหล่งข้อมูล

- รันจริงเมื่อ 11 ต.ค. 2569 เวลา 03:20 น. ตามเวลาไทย (`2026-10-10T20:20:41.569Z`)
- Windows x64, host รายงาน CPU parallelism 12 และหน่วยความจำ 30.9 GiB; ไม่ใช่การรับประกันทรัพยากรของ container
- Express production image `lifebalance:demo-readiness`, Prisma และ PostgreSQL 17 จริงบน loopback/Docker bridge ไม่มี database mock
- Image revision label: `58abe6f689b895177c5fac7dce283fabe456719e` เป็น image ที่มีอยู่แล้ว ไม่ใช่ image ที่ build ใหม่หรือรุ่นที่เพิ่ง deploy
- ตรวจ `git diff` เทียบ revision ข้างต้นกับ `b477cddc34c9347d21a9527a5369d57fa68a63dd` แล้วไม่มีการเปลี่ยนไฟล์ `src/client`, `src/server`, `src/shared` หรือ `prisma/schema.prisma`; `package.json` ต่างเฉพาะ tooling coverage/scripts และ devDependencies
- การ build image ใหม่ติด Docker Hub authorization (401) จึงใช้ image เดิมโดยบันทึก provenance นี้ไว้ โค้ดแอปในเครื่องผ่าน build/typecheck แยกแล้ว
- บัญชีจำลอง 1 บัญชี มีข้อมูลเริ่มต้น 1,000 records: อาหาร 500, น้ำหนัก 300, กิจกรรม 200 ครอบคลุมข้อมูลย้อนหลังหนึ่งปี
- Login/logout ทีละรอบ รวม login 20 ครั้งจาก client เดียว ใช้ password verification, session และ rate limiter เดิม ไม่ลดความปลอดภัย
- ไม่โหลด `.env`, ไม่เรียก AI, ไม่ส่งรูป, ไม่เขียน Supabase/Render/ข้อมูลผู้ใช้จริง
- HTTP timer รวมการรับและอ่าน response JSON; action timer รวมคำขอ API ที่เกี่ยวข้อง ไม่รวม browser rendering หรือ startup ก่อน service พร้อม

## ผลรันใหม่

| รายการ | จำนวน | p95 (ms) | ช้าที่สุด (ms) | ข้อผิดพลาด |
| --- | ---: | ---: | ---: | ---: |
| Login | 20 | 65.94 | 85.85 | 0 |
| ข้อมูลหน้าแรก + ประวัติสุขภาพหนึ่งปี + น้ำหนัก + สรุปสัปดาห์ | 20 | 32.90 | 56.83 | 0 |
| ประวัติอาหารแบบแบ่งหน้า 20 รายการ | 20 | 11.40 | 16.91 | 0 |
| บัญชี `/auth/me` | 20 | 7.89 | 8.46 | 0 |
| บันทึกอาหารแล้วตรวจยอดพลังงานใหม่ | 20 | 35.79 | 36.80 | 0 |
| อ่านยอดใหม่หลังระบบยืนยันการบันทึก | 20 | 21.63 | 22.09 | 0 |
| ข้อมูล Dashboard รายวัน | 20 | 16.63 | 17.88 | 0 |
| ดูข้อมูล → บันทึก → อ่านข้อมูลใหม่ | 20 | 45.53 | 47.97 | 0 |
| HTTP responses ทั้งหมด รวม logout และคำขอประกอบ action | 379 | 40.26 | 85.73 | 0 |

**ผล: ผ่านเกณฑ์ API ของรอบนี้ (`passed: true`) และ cleanup สำเร็จ (`cleanup: true`)** ไม่มี sample ที่ถูกตัดออกเพราะช้า

Raw result: `.local/performance/demo-result.json`; stdout จริง: `.local/performance/demo-execution-20261011.log` ทั้งสองไฟล์เป็นผลในเครื่องและถูก ignore ไม่ใช่ผล GitHub Actions รุ่นใหม่

รอบแรกไม่ผ่านเพราะสคริปต์ทดสอบประวัติอาหารส่ง `from/to` ไม่ครบตาม API เดิม มี errors 20/20 แก้เฉพาะคำขอในสคริปต์แล้วรันชุดใหม่ทั้งหมด เก็บรอบแรกไว้ใน `.local/performance/demo-result-first-attempt-20261011.json` และ log ชื่อเดียวกัน ไม่แก้ API ของแอปเพื่อให้ test ผ่าน

## รันซ้ำและ CI

หลังติดตั้ง dependencies และ `npm run build` ให้เตรียม production image ในเครื่องแล้วรัน:

```sh
node scripts/performance-check.mjs <locally-built-image> --demo
```

`--demo` เป็นค่าเริ่มต้นและเก็บผลใน `.local/performance/demo-result.json` สคริปต์สร้างฐานข้อมูลและ network ใหม่ ใช้ Prisma migrations เดิมกับฐานนี้เท่านั้น แล้วลบทรัพยากรที่ตนสร้างท้ายรอบ

Workflow performance เปลี่ยนเป็น `--demo` และเก็บ `demo-result.json` เป็น artifact ผล local ในรายงานนี้เก็บก่อนเผยแพร่การเปลี่ยนแปลงดังกล่าว ไม่ใช่ผล CI ใหม่ ผล GitHub run `38076002736` เดิมยังเป็นการทดสอบ 100 คน ห้ามนำรูปของ run เดิมมาอ้างว่าเป็นผล single-user; ต้องใช้ผล artifact/log จาก workflow รุ่นใหม่ที่รันสำเร็จแล้วเท่านั้น

การทดสอบโหลดเดิมยังรันแยกได้ด้วย `--load` และเก็บ `load-result.json` แต่ไม่รันรอบนี้ และไม่รันใน performance job แบบปกติ

## ข้อจำกัดของหลักฐาน

ผล CI แบบ `--demo` ที่เผยแพร่ภายหลังอยู่ใน [workflow #171 attempt 3 และ deployment proof](../deployment/continuous-deployment.md#latest-recorded-verification--16-october-2026) ของ revision `bc10444`; ตารางตัวเลขในรายงานนี้ยังเป็นผล local วันที่ 11 ตุลาคม

ผลนี้พิสูจน์ API บนสภาพแวดล้อมในเครื่องตามขอบเขตข้างต้น ไม่ยืนยันเวลาที่ผู้ใช้เห็นข้อมูลบน browser/Render, network อินเทอร์เน็ต, cold start, รูปอาหาร, AI หรือความสามารถรองรับผู้ใช้พร้อมกัน ห้ามนำผลนี้ไปกล่าวว่าเว็บ production ทุก flow ต่ำกว่า 2 วินาที หรือ NFR-01/02/07 ผ่านครบทั้งข้อ

## การตรวจที่ทำ

- `node --check scripts/performance-check.mjs`: ผ่าน
- `npm run build` รวม typecheck client/server: ผ่าน (มี warning annotation ของ Zod/Rollup เดิม)
- รันสคริปต์ `--demo` จริงกับ Docker/PostgreSQL: ผ่านในรอบหลังแก้คำขอช่วงวันที่
- ไม่เปลี่ยน business logic, API, authentication หรือ database schema; migrations เดิมรันเฉพาะฐานทดสอบชั่วคราว
