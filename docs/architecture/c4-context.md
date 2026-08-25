# C4 Model - Level 1: System Context Diagram

ไดอะแกรมแสดงภาพรวมบริบทของระบบ **LifeBalance** ผู้ใช้งาน และระบบภายนอกที่เกี่ยวข้อง

## Diagram
```mermaid
C4Context
    title System Context Diagram - LifeBalance System

    Person(user, "Office Worker / User", "ผู้ใช้งานทั่วไปที่ต้องการบันทึกอาหารและติดตามสุขภาพ")
    System(lifebalance, "LifeBalance System", "เว็บแอปพลิเคชันสำหรับบันทึกอาหาร คำนวณสารอาหาร และแสดง Dashboard สุขภาพ")

    Rel(user, lifebalance, "บันทึกข้อมูลอาหาร ดูรายงานสุขภาพ และจัดการโปรไฟล์", "HTTPS")