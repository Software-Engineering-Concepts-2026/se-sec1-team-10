# Saboteur Testing Journal

> Historical FizzBuzz evidence below is retained as recorded. The Lab 9 chapter-exercise evidence added on 2026-09-21 appears after it.

## Bug ที่ตั้งใจสร้าง

สร้างสำเนาชั่วคราวของ `src/fizzbuzz.py` นอก repository แล้วแก้เงื่อนไขจาก

`number % 15 == 0`

เป็น

`number % 15 != 0`

เป็นเงื่อนไขที่ผิด เพื่อจำลองการเกิด Bug โดยไม่ได้แก้หรือ commit production code

## ผลการทดสอบ

รัน assertion ต่อสำเนา mutant ด้วย input `15`:

```powershell
python -c "... assert fizzbuzz(15) == 'FizzBuzz'"
```

ผลจริง: `AssertionError` เพราะ mutant คืนค่า `'15'` แทน `'FizzBuzz'`.

สำหรับหลักฐานการย่อกรณีทดสอบ (shrinking) ใช้ Hypothesis สร้างเฉพาะ multiple ของ 15 ในช่วง 15–990 ให้กับ mutant เดียวกัน:

```text
Failed example: number=15
assert '15' == 'FizzBuzz'
```

Hypothesis ย่อไปที่ `15` ซึ่งเป็นกรณีเล็กสุดของ partition นี้ที่ทำให้ assertion ล้มเหลว

ลบสำเนาชั่วคราวแล้วรันชุดจริงอีกครั้ง:

```powershell
python -m pytest src/tests -v --cov=src.fizzbuzz --cov=app --cov-branch --cov-report=term-missing --cov-fail-under=90
```

ผลจริงในขณะบันทึก: `24 passed`, statement/branch coverage `100%` สำหรับ production modules ใน scope ณ เวลานั้น.

## สรุป

Test ที่เขียนไว้สามารถตรวจจับ Bug ที่เกิดจากการแก้เงื่อนไขของ FizzBuzz ได้ โดย mutation อยู่ในสำเนาชั่วคราวเท่านั้น

## Chapter-exercise mutants (2026-09-21)

สร้างไฟล์ mutant ชั่วคราวแล้วลบทิ้งก่อนการรันชุดจริงสุดท้าย โดยไม่มี mutant ใดถูก commit:

1. เปลี่ยนสูตร discount จากลบ percentage เป็นบวก percentage. Assertion สำหรับ `calculate_discount(80, 25)` ล้มเหลวจริง: mutant คืน `100.0` แทน `60`.
2. ผ่อนเงื่อนไข TLD จากอย่างน้อย 2 ตัวอักษรเป็นอย่างน้อย 1 ตัวอักษร. Hypothesis รัน 100 ตัวอย่างและย่อ failing case เป็น `0@0.A`; mutant คืน `True` ทั้งที่ test คาด `False`.

หลังลบไฟล์ชั่วคราวแล้ว ชุดจริงสุดท้ายใช้ coverage เฉพาะ `src.fizzbuzz`, `src.lab9_exercises`, และ `services/stats-service/app.py`.
