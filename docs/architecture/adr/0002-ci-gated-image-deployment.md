# ADR 0002: Deploy image ผ่าน GitHub Actions หลัง CI ผ่าน

## Status

Accepted — 16 October 2026

## Context

LifeBalance มีทั้ง workflow สำหรับ build/push Docker image และทางเลือกให้ Render build จาก GitHub โดยตรง หลังแก้ข้อจำกัด GitHub Actions และอนุมัติ Render GitHub App แล้ว ต้องเลือกวิธีหลักให้ชัดเจน [อาจารย์แนะนำแนวทาง image ผ่าน CI/CD](https://github.com/Software-Engineering-Concepts-2026/Discussions/issues/15#issuecomment-6207261908) และผู้ดูแลทีมเลือกใช้แนวทางนี้

## Decision

- ใช้ GitHub Actions → Docker Hub → Render Existing Image เป็นวิธีหลัก
- ปล่อย production เฉพาะ push เข้า `main` หลัง `lint`, `test`, `javascript`, `performance` ผ่านครบ โดยตรวจ SHA ว่ายังเป็น main ล่าสุดก่อน build และก่อน deploy
- Build พร้อม `VCS_REF=<full-sha>`, ตั้ง tag `cd-<full-sha>` และส่ง immutable digest ให้ Render
- ยืนยัน `release.json`, hash ไฟล์เว็บ และ health ก่อนนับว่า deploy สำเร็จ แล้วเก็บ artifact `deployment-proof-<sha>`
- การ deploy ด้วยมือเป็นแผนสำรอง การสลับไป source build ต้องทำอย่างชัดเจนและไม่เปิดเป็นเส้นทาง production อัตโนมัติคู่กับ CD ที่ส่ง image
- Migration/seed และ rollback เป็นงานแยกที่ต้องตรวจทาน ไม่รันอัตโนมัติใน CD นี้

## Consequences

- ระบุรุ่นที่ขอ deploy และตรวจไฟล์เว็บที่ live เทียบกับ image ได้
- หาก CI ไม่ผ่านหรือ credentials ใช้ไม่ได้ pipeline จะไม่ปล่อยรุ่นใหม่สำเร็จ
- ต้องดูแล Docker Hub credentials, Render hook และ artifacts; tag อย่างเดียวไม่รับประกันว่า image ไม่ถูกเขียนทับ
- การตรวจไฟล์เว็บและ health ไม่ได้พิสูจน์ทุก user flow, AI, database connectivity หรือรับรอง digest ของ backend ที่กำลังรันแบบ cryptographic attestation
- Render source build ที่ไม่ส่ง `VCS_REF` จะรายงาน revision เป็น `unknown` จึงใช้แทนหลักฐานการปล่อย image ที่ผ่าน CI ไม่ได้

## Evidence and operation

[CI #171 attempt 3](https://github.com/Software-Engineering-Concepts-2026/se-sec1-team-10/actions/runs/38163220860/attempts/3) ผ่านครบทั้ง CI และ CD ของ commit `bc10444` จากการ rerun ของ main push เดิม การเริ่มอัตโนมัติจาก merge ใหม่ให้ตรวจในงานจริงครั้งถัดไป ไม่ต้องสร้าง empty commit เพื่อยืนยันซ้ำ

ดูค่า configuration, SHA/digest เต็ม, ผลตรวจและวิธี rollback ใน [คู่มือ CD](../../deployment/continuous-deployment.md) และวิธี build เองใน [คู่มือ manual](../../deployment/render-docker.md)
