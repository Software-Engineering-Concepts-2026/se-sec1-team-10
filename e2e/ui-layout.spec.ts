import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const user = {
  id: 'layout-user', email: 'layout@example.com', displayName: 'ทดสอบหน้าจอ', age: 30,
  weightKg: 68, heightCm: 165, bmi: 25,
  dailyCalorieTarget: 1900,
};

async function useMockedDashboard(page: Page) {
  let loggedIn = false;
  await page.route('**/api/**', async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (pathname === '/api/auth/login') { loggedIn = true; return json({ user }); }
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [], caloriesConsumed: 420, caloriesBurned: 0, netCalories: 420 });
    if (pathname === '/api/meals/daily') return json({ date: searchParams.get('date'), caloriesConsumed: 420, meals: [{
      id: 'meal-no-image', name: 'ข้าวผัดจานกลางที่ไม่มีรูป', imageData: null, totalCalories: 420,
      ingredients: [{ name: 'ข้าวสวย', amount: 180, unit: 'g', caloriesKcal: 420 }],
    }] });
    return json({ message: 'not found' }, 404);
  });
}

async function useMockedFormApi(page: Page) {
  const user = { id: 'layout-user', email: 'layout@example.com', displayName: 'ทดสอบหน้าจอ', age: 30, weightKg: 68, heightCm: 165, bmi: 25, dailyCalorieTarget: null, targetWeightKg: null, goalSettings: null };
  let loggedIn = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (pathname === '/api/auth/login') { loggedIn = true; return json({ user }); }
    if (pathname === '/api/auth/logout') return route.fulfill({ status: 204 });
    if (pathname === '/api/meals/daily') return json({ date: searchParams.get('date'), meals: [], caloriesConsumed: 0 });
    if (pathname === '/api/meals/history') return json({ meals: [{ id: 'history-no-image', activityDate: '2026-10-07', mealType: 'lunch', name: 'ข้าวผัดรายการเก่าที่ยาวเพื่อทดสอบชื่ออาหาร', imageData: null, totalCalories: 420, ingredients: [{ name: 'ข้าวสวย', amount: 180, unit: 'g', caloriesKcal: 420 }] }], hasMore: false });
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    if (pathname === '/api/foods/estimate') return json({ ingredient: { name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0.1, proteinGrams: 3, fatGrams: 0.3 } } });
    if (pathname === '/api/meals' && request.method() === 'POST') return json({ meal: { id: 'layout-meal', ...request.postDataJSON(), totalCalories: 130 } }, 201);
    if (pathname === '/api/goals' && request.method() === 'PUT') return json({ user: { ...user, dailyCalorieTarget: 2000, targetWeightKg: 65, goalSettings: request.postDataJSON() } });
    if (pathname === '/api/summary/weekly') return json({ startDate: '2026-10-01', endDate: '2026-10-07', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (pathname === '/api/weight-logs') return json({ logs: [] });
    return json({ message: `unexpected ${request.method()} ${pathname}` }, 404);
  });
  await page.goto('/');
  await page.getByLabel('อีเมล').fill(user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('LayoutTest123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
}

async function expectVisibleAboveNav(page: Page, button: import('@playwright/test').Locator) {
  await button.scrollIntoViewIfNeeded();
  const [buttonBox, navBox] = await Promise.all([button.boundingBox(), page.locator('.ref-nav').boundingBox()]);
  expect(buttonBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  expect(buttonBox!.y + buttonBox!.height).toBeLessThanOrEqual(navBox!.y);
  const center = { x: buttonBox!.x + buttonBox!.width / 2, y: buttonBox!.y + buttonBox!.height / 2 };
  expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent, center)).toContain((await button.textContent())!.trim());
}

test('dashboard fits mobile widths and presents summary beside meals on desktop', async ({ page }) => {
  const screenshotDirectory = '.local/ui-cleanup-check-20261007';
  mkdirSync(screenshotDirectory, { recursive: true });
  await useMockedDashboard(page);
  await page.goto('/');
  await page.getByLabel('อีเมล').fill('layout@example.com');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('LayoutTest123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  await expect(page.getByText('ข้าวผัดจานกลางที่ไม่มีรูป')).toBeVisible();

  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await expect(page.getByRole('button', { name: 'หน้าแรก', exact: true })).toBeVisible();
    await page.screenshot({ path: `${screenshotDirectory}/today-${width}.png`, fullPage: true });
    const quickLog = page.getByRole('button', { name: /บันทึกอาหารของวันนี้/ });
    // Playwright's visibility check doesn't account for the fixed bottom nav.
    await quickLog.evaluate(element => element.scrollIntoView({ block: 'end' }));
    const [quickLogBox, navBox] = await Promise.all([quickLog.boundingBox(), page.locator('.ref-nav').boundingBox()]);
    expect(quickLogBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(quickLogBox!.y + quickLogBox!.height).toBeLessThanOrEqual(navBox!.y);
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1440);
  const summary = page.locator('.ref-today-summary');
  const meals = page.locator('.ref-today-meals');
  await expect(summary).toBeVisible();
  await expect(meals).toBeVisible();
  const [summaryBox, mealsBox] = await Promise.all([summary.boundingBox(), meals.boundingBox()]);
  expect(summaryBox).not.toBeNull();
  expect(mealsBox).not.toBeNull();
  expect(mealsBox!.x).toBeGreaterThanOrEqual(summaryBox!.x + summaryBox!.width);
  expect(Math.abs(mealsBox!.y - summaryBox!.y)).toBeLessThan(2);
  expect(summaryBox!.width).toBeGreaterThan(400);
  await page.screenshot({ path: `${screenshotDirectory}/today-1440.png`, fullPage: true });
});

test('meal and goal save controls stay reachable above navigation on phone widths', async ({ page }) => {
  const screenshotDirectory = '.local/ui-cleanup-check-20261007';
  mkdirSync(screenshotDirectory, { recursive: true });
  await useMockedFormApi(page);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    const history = page.locator('.diary-meal-history');
    await expect(history.getByText('ข้าวผัดรายการเก่าที่ยาวเพื่อทดสอบชื่ออาหาร')).toBeVisible();
    await expect(history.getByRole('button', { name: /แก้ไข ข้าวผัดรายการเก่าที่ยาว/ })).toBeVisible();
    await expect(history.getByRole('button', { name: /บันทึกมื้อนี้อีกครั้ง: ข้าวผัดรายการเก่าที่ยาว/ })).toBeVisible();
    await page.screenshot({ path: `${screenshotDirectory}/history-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อทดสอบ');
    await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
    await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
    await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
    await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
    await expect(page.getByText('ข้าวสวย', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    const mealSave = page.locator('.meal-actions .primary');
    await expect(mealSave).toBeVisible();
    await expectVisibleAboveNav(page, mealSave);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${screenshotDirectory}/meal-${width}.png`, fullPage: true });

    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByRole('button', { name: 'เป้าหมายสุขภาพ ตั้งเป้าพลังงานและน้ำหนัก' }).click();
    await page.getByLabel('เพศที่ใช้ในสูตรคำนวณ').selectOption('male');
    const goalSave = page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true });
    await expect(goalSave).toBeEnabled();
    await expectVisibleAboveNav(page, goalSave);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `${screenshotDirectory}/goal-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'ย้อนกลับ', exact: true }).click();
    await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('button', { name: 'กลับไปบันทึก', exact: true }).click();
  }
});
