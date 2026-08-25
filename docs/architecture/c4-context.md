# C4 Model - Level 1: System Context Diagram

ไดอะแกรมแสดงภาพรวมบริบทของระบบ **LifeBalance** ผู้ใช้งาน และระบบภายนอกที่เกี่ยวข้อง

```mermaid
C4Context
    title System Context diagram for LifeBalance System

    Person(user, "User / Office Worker", "ผู้ใช้งานทั่วไปที่ต้องการติดตามสุขภาพและบันทึกการรับประทานอาหาร")

    System(lifebalance, "LifeBalance System", "ระบบเว็บแอปพลิเคชันสำหรับบันทึกอาหาร คำนวณแคลอรี่ และติดตามเป้าหมายสุขภาพประจำวัน")

    System_Ext(notification, "Notification Service", "ระบบส่งข้อความแจ้งเตือนเตือนมื้ออาหาร (เช่น LINE Notify / Push Notification)")
    System_Ext(oauth, "OAuth Provider", "ระบบยืนยันตัวตนภายนอก (เช่น Google Sign-In)")

    Rel(user, lifebalance, "ใช้งาน บันทึกอาหาร และดูสถิติสุขภาพ", "HTTPS/Web Browser")
    Rel(lifebalance, oauth, "ตรวจสอบและยืนยันตัวตนผู้ใช้", "HTTPS/REST")
    Rel(lifebalance, notification, "ส่งคำแจ้งเตือนบันทึกมื้ออาหาร", "HTTPS/API")