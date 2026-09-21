# Saboteur Testing Journal

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

ผลจริง: `24 passed`, statement/branch coverage `100%`.

## สรุป

Test ที่เขียนไว้สามารถตรวจจับ Bug ที่เกิดจากการแก้เงื่อนไขของ FizzBuzz ได้ โดย mutation อยู่ในสำเนาชั่วคราวเท่านั้น
