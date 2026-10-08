import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const directory = '.local/system-ui-audit-20261008';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const user = { id: 'ui-audit', email: 'audit@example.com', displayName: 'ผู้ทดสอบหน้าจอชื่อยาวสำหรับตรวจหน้าบัญชี', age: 30, weightKg: 68, heightCm: 165, bmi: 25, dailyCalorieTarget: 1900, targetWeightKg: 64, goalSettings: null };
const meal = { id: 'fixture-meal', activityDate: today(), mealType: 'lunch', name: 'ข้าวผัดผักรวมและอกไก่ชื่ออาหารยาวสำหรับทดสอบการตัดบรรทัด', imageData: null, totalCalories: 420, ingredients: [{ id: 'i1', name: 'ข้าวสวย', amount: 180, unit: 'g', source: 'food-catalog', referenceAmount: 100, referenceUnit: 'g', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 }, caloriesKcal: 234, carbsGrams: 50, sugarGrams: 0, proteinGrams: 5, fatGrams: 0.5 }] };

async function capture(page: Page, name: string) {
  const width = page.viewportSize()!.width;
  const base = `${directory}/${name}-${width}`;
  await page.screenshot({ path: `${base}.png`, fullPage: true, animations: 'disabled' });
  const metrics = await page.evaluate(() => {
    const visible = (element: Element) => { const rect = element.getBoundingClientRect(); const style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'; };
    const controls = Array.from(document.querySelectorAll('button, input, select, textarea, a[role="button"]')).filter(visible).map(element => {
      const rect = element.getBoundingClientRect(); const style = getComputedStyle(element);
      return { tag: element.tagName.toLowerCase(), name: (element.getAttribute('aria-label') || element.textContent || (element as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 60), width: Math.round(rect.width), height: Math.round(rect.height), fontSize: style.fontSize };
    });
    const text = Array.from(document.querySelectorAll('h1,h2,h3,p,label,button,input')).filter(visible).slice(0, 100).map(element => ({ text: (element.textContent || (element as HTMLInputElement).placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 48), fontSize: getComputedStyle(element).fontSize }));
    return { scrollWidth: document.documentElement.scrollWidth, clientWidth: innerWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth, bodyFont: getComputedStyle(document.body).fontSize, controls, text };
  });
  writeFileSync(`${base}.json`, JSON.stringify({ name, width, ...metrics }, null, 2));
}

test('captures current auth, tab and accessible subpage UI with fixture APIs', async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(directory, { recursive: true });
  let loggedIn = false;
  let failLogin = true;
  let releaseInitialAuth = false;
  let releaseAuthMe!: () => void;
  const initialAuthWait = new Promise<void>(resolve => { releaseAuthMe = resolve; });
  let meals = [meal];
  const food = { id: 'rice', name: 'ข้าวสวย', source: 'food-catalog', sourceName: 'ฐานข้อมูลตัวอย่าง', url: null, imageUrl: null, nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } };
  await page.addInitScript(() => Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); } } }));
  await page.route('**/api/**', async route => {
    const request = route.request(); const { pathname, searchParams } = new URL(request.url()); const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') { if (!releaseInitialAuth) await initialAuthWait; return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401); }
    if (pathname === '/api/auth/login' && method === 'POST') { if (failLogin) return json({ message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' }, 401); loggedIn = true; return json({ user }); }
    if (pathname === '/api/auth/register' && method === 'POST') return json({ message: 'ตรวจสอบข้อมูลแล้วลองอีกครั้ง' }, 400);
    if (pathname === '/api/auth/logout') { loggedIn = false; return route.fulfill({ status: 204 }); }
    if (pathname === '/api/meals/daily') { const date = searchParams.get('date') || today(); const rows = meals.filter(item => item.activityDate === date); return json({ date, meals: rows, caloriesConsumed: rows.reduce((sum, item) => sum + item.totalCalories, 0) }); }
    if (pathname === '/api/meals/history') { const q = (searchParams.get('q') || '').toLowerCase(); return json({ meals: meals.filter(item => item.name.toLowerCase().includes(q) || q === 'ข้าว'), hasMore: false }); }
    if (pathname === '/api/meals' && method === 'POST') { const body = request.postDataJSON() as Record<string, unknown>; const saved = { ...meal, ...body, id: `saved-${meals.length + 1}`, totalCalories: 420 }; meals = [...meals, saved]; return json({ meal: saved }, 201); }
    if (pathname.startsWith('/api/meals/') && method === 'DELETE') return route.fulfill({ status: 204 });
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [{ id: 'walk', activityDate: today(), activityType: 'walking', durationMinutes: 30, caloriesBurned: 119 }], caloriesConsumed: 420, caloriesBurned: 119, netCalories: 301 });
    if (pathname === '/api/foods/catalog') { const q = (searchParams.get('q') || '').toLowerCase(); return json({ foods: q ? [food] : [] }); }
    if (pathname === '/api/foods/estimate') return json({ ingredient: { name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } } });
    if (pathname === '/api/health-history' || pathname === '/api/weight-logs') return json({ points: [{ date: today(), weightKg: 68, bmi: 25 }], logs: [{ id: 'w1', date: today(), weightKg: 68, heightCm: 165, bmi: 25 }] });
    if (pathname === '/api/summary/weekly') return json({ startDate: today(), endDate: today(), days: [{ date: today(), caloriesConsumed: 420, caloriesBurned: 119, netCalories: 301, mealCount: 1 }], caloriesConsumed: 420, caloriesBurned: 119 });
    if (pathname === '/api/account/profile' && method === 'PUT') return json({ user });
    if ((pathname === '/api/account/goals' || pathname === '/api/goals') && method === 'PUT') return json({ user });
    return json({ message: `fixture: ${method} ${pathname}` });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('status')).toContainText('กำลังเชื่อมต่อ');
  await capture(page, 'boot-loading');
  releaseInitialAuth = true; releaseAuthMe();
  await expect(page.getByLabel('อีเมล')).toBeVisible();
  await capture(page, 'login');
  await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
  await expect(page.getByLabel('ชื่อที่ใช้แสดง')).toBeVisible();
  await capture(page, 'register');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ', exact: true }).click();
  await page.getByLabel('อีเมล').fill(user.email); await page.locator('input[name="password"]').fill('AuditFixture123!');
  await page.getByRole('button', { name: /เข้าสู่ระบบ/ }).click();
  await expect(page.getByRole('alert')).toContainText('ไม่ถูกต้อง');
  await capture(page, 'login-error');
  failLogin = false;
  await page.getByRole('button', { name: /เข้าสู่ระบบ/ }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  await capture(page, 'home');

  const nav = (label: string) => page.locator('.ref-nav').getByRole('button', { name: label, exact: true }).click();
  await nav('บันทึก'); await expect(page.getByRole('heading', { name: 'บันทึกอาหาร' })).toBeVisible();
  await expect(page.locator('.diary-meal-history article')).toHaveCount(1);
  await expect(page.locator('.meal-list article')).toHaveCount(0);
  await capture(page, 'diary');
  await page.getByLabel('ค้นหาประวัติอาหาร').fill('ข้าว'); await expect(page.locator('.diary-catalog-results')).toBeVisible(); await capture(page, 'diary-search');
  await page.getByLabel('ค้นหาประวัติอาหาร').fill('');
  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click(); await expect(page.getByRole('heading', { name: 'ประวัติอาหาร' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เสร็จสิ้น', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ดูทั้งหมด', exact: true })).toHaveCount(0);
  await capture(page, 'diary-history');
  await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
  await page.getByRole('button', { name: /บันทึกอาหาร/ }).click(); await expect(page.getByLabel('ชื่ออาหาร', { exact: true })).toBeVisible(); await capture(page, 'manual-meal');
  await page.setViewportSize({ width: 320, height: 760 }); await capture(page, 'manual-meal-critical');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'manual-meal-desktop');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click(); await capture(page, 'ingredient-entry');
  await page.getByRole('button', { name: 'ค้นหาจากฐานข้อมูลอาหาร', exact: true }).click(); await expect(page.getByRole('heading', { name: 'เพิ่มส่วนประกอบจากฐานข้อมูล' })).toBeVisible(); await capture(page, 'ingredient-catalog');
  await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
  await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click(); await expect(page.getByRole('button', { name: 'เลือกจากอัลบั้ม' })).toBeVisible(); await capture(page, 'camera-denied');
  await page.getByRole('button', { name: /กลับไปบันทึก/ }).click(); await page.getByRole('button', { name: /บันทึกกิจกรรม/ }).click(); await expect(page.getByLabel(/กิจกรรม/).first()).toBeVisible().catch(() => undefined); await capture(page, 'activity');

  await nav('ความคืบหน้า'); await expect(page.getByRole('heading', { name: /ความคืบหน้า/ })).toBeVisible(); await capture(page, 'progress-weight');
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก', exact: true }).click(); await expect(page.locator('.ref-weight-form')).toBeVisible(); await capture(page, 'weight-form');
  await page.setViewportSize({ width: 320, height: 760 }); await capture(page, 'weight-form-critical');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'weight-form-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'ยกเลิก', exact: true }).click();
  await page.getByRole('button', { name: 'BMI', exact: true }).click(); await capture(page, 'progress-bmi-weekly');

  await nav('บัญชี'); await expect(page.getByRole('heading', { name: 'บัญชี', exact: true })).toBeVisible(); await capture(page, 'account');
  await page.getByRole('button', { name: /ข้อมูลส่วนตัว/ }).click(); await capture(page, 'profile');
  await page.getByRole('button', { name: /กลับ/ }).first().click(); await page.getByRole('button', { name: /เป้าหมายสุขภาพ/ }).click(); await expect(page.getByRole('radiogroup', { name: 'เลือกแนวทางเป้าหมาย' })).toBeVisible(); await capture(page, 'goals');
  await page.setViewportSize({ width: 320, height: 760 }); await capture(page, 'goals-critical');
  await page.setViewportSize({ width: 1440, height: 1000 }); await capture(page, 'goals-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: /กลับ/ }).first().click(); await page.getByRole('button', { name: /แจ้งเตือนมื้ออาหาร/ }).click(); await expect(page.locator('.ref-reminder-times')).toBeVisible();
  for (const width of [390, 533]) { await page.setViewportSize({ width, height: 844 }); await capture(page, 'reminders'); }
});
