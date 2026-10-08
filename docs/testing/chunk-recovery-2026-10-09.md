# LifeBalance — รับมือหน้าโหลดไม่สำเร็จหลัง deploy

ตรวจและแก้วันที่ 9 ตุลาคม 2569 บน `feature/Chayakorn05` ซึ่ง sync แบบ fast-forward กับ `life-balance-test` (`9fbc341`) ก่อนเริ่มงาน

## ปัญหาและพฤติกรรมหลังแก้

แท็บที่เปิดก่อน deploy อาจยังใช้ entry JavaScript รุ่นเก่า แล้วขอไฟล์หน้าอาหารที่ชื่อ hash เปลี่ยนไปและไม่มีใน image ใหม่ การ reject ของ dynamic import เดิมทำให้ React ไม่มี Error Boundary รับข้อผิดพลาด จึงกลายเป็นหน้าว่าง

เพิ่ม `LazyPanelBoundary` รอบส่วนที่โหลดด้วย `React.lazy` ของอาหาร, กิจกรรม, ความคืบหน้า, เป้าหมายและแจ้งเตือน โดยคงเมนูหลักและส่วนของหน้าอื่นไว้

- เมื่อข้อความ error ตรงกับ dynamic import/chunk load failure แสดงข้อความว่าเครือข่ายอาจขัดข้องหรือแท็บอาจใช้แอปรุ่นเก่า พร้อมปุ่ม **โหลดเวอร์ชันล่าสุด** ไม่สรุปว่าเกิดจาก deploy เสมอไป
- Render error อื่นใช้ข้อความ **ส่วนนี้แสดงผลไม่ได้** และปุ่ม **โหลดหน้าใหม่** แยกจากกรณีไฟล์โหลดไม่สำเร็จ
- ทั้งสองกรณีแสดงคำเตือนว่า reload อาจทำให้ข้อมูลที่ยังไม่บันทึกหาย และ reload เฉพาะเมื่อผู้ใช้กดปุ่ม ไม่มี auto reload หรือ timer
- Boundary รับ error ที่เป็นค่า falsy ได้ และรักษากฎแสดง/ซ่อนแท็บบนมือถือเมื่อ fallback อยู่ใน App
- ไม่เปลี่ยน route, API, database, สูตรโภชนาการ, save/recalculation behavior หรือเพิ่ม draft persistence

เอกสารอ้างอิง: [Vite load error handling](https://vite.dev/guide/build#load-error-handling), [React lazy](https://react.dev/reference/react/lazy)

## ไฟล์และการทดสอบ

| กลุ่ม | ไฟล์ |
| --- | --- |
| Boundary และ classifier | `src/client/LazyPanelBoundary.tsx` |
| ตำแหน่ง lazy panels | `App.tsx`, `DashboardPanel.tsx`, `DiaryPanel.tsx`, `AccountPanel.tsx` ใน `src/client` |
| Recovery presentation | `src/client/styles/panels.css` |
| Unit cases | `src/tests/lazy-panel-boundary.test.ts` |
| Browser regression ของ production build | `e2e-chunks/lazy-chunk-recovery.spec.ts`, `playwright.lazy-chunk.config.ts` |
| Script และ CI | `package.json`, `.github/workflows/ci.yml` |

| ตรวจ | ผลในเครื่อง |
| --- | --- |
| `npm run build` | ผ่าน รวม client/server typecheck และ production assets |
| Focused Vitest suite | 10 ผ่าน: browser import error variants, unrelated errors, warning/copy และ falsy failure |
| `npm run test:e2e:chunks` | 2 ผ่าน บน Edge และ Vite production preview; API ทั้งหมดเป็น mock |
| Missing hashed MealPanel asset | intercept request ของ `/assets/MealPanel-*.js` ให้ล้มเหลว; แสดง fallback, ไม่ reload เอง, เปลี่ยนแท็บได้, กด reload แล้วเปิด editor ใหม่ได้ |
| Unrelated render error | ส่ง module ที่ export MealPanel และ throw render fault; แสดง generic fallback และ warning แทนข้อความ stale-version |
| Responsive | Missing-chunk fallback ที่ 360×780px ไม่มี horizontal overflow; ตรวจภาพมือถือและ generic fallback บนคอมด้วยสายตา |

เทส production preview อยู่ใน `e2e-chunks/` แยกจาก `e2e/` เพราะ dev server ไม่ใช้ hashed asset URLs เดียวกัน CI รันชุดเดิมก่อน แล้วรัน `test:e2e:chunks` โดยใช้ build และ Chromium ที่ติดตั้งไว้แล้ว

ภาพเฉพาะเครื่องอยู่ใน `test-results/.../missing-chunk-mobile.png` และ `render-error-desktop.png` ไม่ commit รูปหรือผลทดสอบลง repository

## ข้อจำกัดและขั้นตอนรวมงาน

- ข้อแก้นี้อยู่ใน bundle ใหม่ จึงไม่สามารถเพิ่ม boundary ให้แท็บที่ยังรัน bundle เก่าอยู่แล้วได้ หลัง deploy patch ผู้ใช้แท็บเก่าต้อง reload หนึ่งครั้งเพื่อรับโค้ดใหม่ จากนั้นการโหลด chunk ไม่สำเร็จในอนาคตจะมี fallback
- การ reload โหลดแอปใหม่และล้าง state ที่ไม่ได้บันทึกของหน้า ไม่มีการรับประกันว่าจะกู้ draft ที่ component เกิด render fault กลับมาได้
- Browser regression mock `/api/auth/me` หลัง reload ยืนยัน flow ฝั่ง client เท่านั้น ไม่ใช่การทดสอบ cookie/session จริงบน production
- ไม่เรียก Supabase, AI หรือรัน migration/seed และยังไม่ได้ deploy patch นี้
- เปิด PR แก้ไขจากสาขาผู้ใช้เข้า `life-balance-test`; หลังเพื่อนรวมแล้ว ให้ตรวจ CI และ diff ที่อัปเดตของ PR release #65 เข้า `main` ใหม่ ไม่ merge หรือ bypass branch protection อัตโนมัติ
