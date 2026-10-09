# UI polish: ตรวจเตรียมรวม branch วันที่ 10 ตุลาคม 2569

ขอบเขต: UI และคู่มือปัจจุบันจาก `feature/Chayakorn05` เตรียมรวมเข้า `life-balance-test` ก่อน `main` ไม่มี feature/route/API/schema ใหม่ และไม่มี migration

## สิ่งที่รวม

- ลดขนาดและระยะห่างของหน้าจอเดิม ปรับการ์ดประวัติอาหารและ ingredient editor ให้ compact คง action และ callbacks เดิม
- icon สารอาหารหลักขนาด 20px ในวงกลม pastel 36px และค่าจริงเมื่อเกินเป้าหมาย
- เอาข้อมูลเพิ่มเติมที่ซ้ำใน Progress ออก คงปุ่มเพิ่มอาหารด้านขวาของหัวรายการ และขอบหน้ากล้องเป็นสี่เหลี่ยม
- รองรับ desktop สองคอลัมน์ และหน้าจอมือถือโดยไม่ล้นแนวนอน
- ปรับคู่มือใช้งาน/setup/สถาปัตยกรรม/deployment/testing ให้ตรงระบบปัจจุบัน

## ผลตรวจในเครื่อง

| การตรวจ | ผล |
| --- | --- |
| `npm run build` รวม client/server typecheck | ผ่าน |
| `npm test` | 132 ผ่าน / 3 ข้าม เพราะเป็น database-dependent tests |
| `npx playwright test --workers=1` | 72 ผ่าน / 1 assertion เก่ายังจำกัด desktop 640px |
| รันข้อ desktop ที่แก้ assertion ซ้ำ | ผ่าน; จำกัดความกว้าง 1080px และตรวจไม่ล้นจอ |
| รวมข้อ browser regression ที่ตรวจผ่าน | 73 ข้อ |
| `npm run test:e2e:chunks` | 2 ผ่าน |
| Responsive | ตรวจ 320, 360, 390, 768 และ 1440px ตามแต่ละชุดทดสอบ |
| Documentation audit | 20 เอกสาร, 67 local links, 49 npm references, 61 source paths; ไม่มี error ก่อนเพิ่มรายงานนี้ |
| `git diff --check` | ผ่าน |

Independent reviewer พบ test ขนาด thumbnail ไม่ตรงโค้ดล่าสุด และ date input ซ่อนตัวเลขขณะ focus แก้แล้ว: คงรูป 80×80px ตาม working tree ล่าสุด, ให้ date input อ่านและแก้ไขได้เมื่อ focus แล้วคืนข้อความวันที่ไทยหลัง blur มี browser test ผ่าน และ reviewer ตรวจซ้ำไม่มี blocker จากสองจุดนี้

## ข้อจำกัด

GitHub CI ของ PR #67 ผ่านครบ 3 jobs หลังรวมเข้า `life-balance-test` แล้ว PR #68 พบ reminder browser test บางรอบไม่ได้รับ notification เพราะ test ใช้นาทีจากนาฬิกาจริงระหว่างกรอกและกดเปิด แก้เฉพาะ fixture ด้วย `page.clock.setFixedTime` เพื่อให้ Date คงที่ แต่ timers และ flow แจ้งเตือนจริงยังทำงาน ไม่แก้ observer หรือพฤติกรรมระบบ ชุดแก้นี้ต้องตรวจ CI ใหม่ก่อนรวมเข้า `main`

PR #69 ของ reminder fixture ผ่านครบ 3 jobs และรวมเข้า `life-balance-test` แล้ว รอบถัดไปของ PR #68 พบ assertion สี date input อ่านค่าในเฟรมแรกของ CSS transition จึงปรับเป็น Playwright assertion ที่รอสีไม่โปร่งใส โดยไม่แก้ CSS หรือพฤติกรรมช่องวันที่ ต้องตรวจ CI หัวล่าสุดอีกครั้ง

ทดสอบ browser ด้วย API จำลองและ built preview ไม่ได้เขียนฐานข้อมูล production หรือยืนยัน AI/live Render ในรอบนี้ ไม่ได้ deploy Docker image ใหม่ การ merge และ CI ต้องตรวจบน GitHub ของ PR แต่ละขั้นแยกจากหลักฐานในเครื่องนี้
