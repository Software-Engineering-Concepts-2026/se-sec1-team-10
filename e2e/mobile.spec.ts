import { expect, test, type Page, type Route } from '@playwright/test';

const user = { id: 'u1', email: 'food@example.com', displayName: 'Food tester', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function mockApi(page: Page, options: { aiConfigured?: boolean } = {}) {
  let loggedIn = false;
  let meals: unknown[] = [];
  let analyzeCalls = 0;
  let mealSaveCalls = 0;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me' && method === 'GET') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (path === '/api/auth/login' && method === 'POST') { loggedIn = true; return json({ user }); }
    if (path === '/api/auth/logout' && method === 'POST') { loggedIn = false; return route.fulfill({ status: 204 }); }
    if (path === '/api/meals/daily' && method === 'GET') return json({ date: url.searchParams.get('date'), meals, caloriesConsumed: meals.length * 238 });
    if (path === '/api/meals/analyze' && method === 'POST') {
      analyzeCalls += 1;
      if (!options.aiConfigured) return json({ message: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร' }, 503);
      return json({ analysis: { name: 'ข้าวมันไก่', mealType: 'lunch', ingredients: [{ name: 'ข้าว', carbsGrams: 50, sugarGrams: 1, proteinGrams: 5, fatGrams: 2 }], portionDescription: 'หนึ่งจาน', source: 'ai-estimate', notes: ['Estimated from the image only; confirm ingredients and portions before saving.'] } });
    }
    if (path === '/api/meals' && method === 'POST') {
      mealSaveCalls += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      const meal = { id: `m${mealSaveCalls}`, ...body, totalCalories: 238 };
      meals = [meal];
      return json({ meal }, 201);
    }
    if (path === '/api/exercises/daily' && method === 'GET') return json({ date: url.searchParams.get('date'), exercises: [], caloriesConsumed: meals.length * 238, caloriesBurned: 0, netCalories: meals.length * 238 });
    if (path === '/api/summary/weekly' && method === 'GET') return json({ startDate: '2026-09-08', endDate: '2026-09-14', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (path === '/api/health-history' && method === 'GET') return json({ points: [], rangeDays: 365, performanceTargetMs: 1500 });
    if (path === '/api/meals/history' && method === 'GET') return json({ meals });
    if (path === '/api/profile' && method === 'PUT') return json({ user });
    if (path === '/api/goals' && method === 'PUT') return json({ user });
    return json({ message: `unmocked ${method} ${path}` }, 404);
  });
  return { get analyzeCalls() { return analyzeCalls; }, get mealSaveCalls() { return mealSaveCalls; } };
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('อีเมล').fill('food@example.com');
  await page.getByLabel('รหัสผ่าน').fill('ValidPassword123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
}

test.describe('mobile navigation and food logging', () => {
  test('switches every mobile tab without horizontal overflow at 390px', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const tab of ['วันนี้', 'บันทึก', 'ความคืบหน้า', 'บัญชี']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.locator('.mobile-page.is-active')).toBeVisible();
    }
    await page.getByRole('button', { name: 'วันนี้', exact: true }).click();
    await page.screenshot({ path: 'test-results/mobile-today.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  });

  test('supports a 320px viewport without horizontal overflow', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await login(page);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.screenshot({ path: 'test-results/mobile-food.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  });

  test('analyzes an uploaded photo as a preview and saves only after confirmation', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.setInputFiles('#meal-upload', { name: 'food.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'วิเคราะห์รูป' })).toBeVisible();
    await page.getByRole('button', { name: 'วิเคราะห์รูป' }).click();
    await expect(page.getByText('ค่าประมาณจาก AI')).toBeVisible();
    expect(mock.analyzeCalls).toBe(1);
    expect(mock.mealSaveCalls).toBe(0);
    await page.getByRole('button', { name: 'บันทึกข้อมูล' }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();
    expect(mock.mealSaveCalls).toBe(1);
    await page.getByRole('button', { name: 'วันนี้', exact: true }).click();
    await expect(page.locator('.energy-ring strong')).toHaveText('238');
    await expect(page.locator('.macro-summary')).toContainText('50');
  });

  test('shows a usable fallback when analysis is unavailable', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.setInputFiles('#meal-upload', { name: 'food.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'วิเคราะห์รูป' }).click();
    await expect(page.getByRole('alert')).toContainText('คุณยังกรอกข้อมูลเองแล้วบันทึกได้');
    await page.getByLabel('ชื่ออาหาร').fill('อาหารกรอกเอง');
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('อาหารกรอกเอง');
    await page.getByRole('button', { name: 'กรอกสารอาหารเอง' }).click();
    await page.getByLabel('ชื่อส่วนประกอบ 1', { exact: true }).fill('ข้าว');
    await page.getByLabel('carbsGrams 1', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();
    expect(mock.mealSaveCalls).toBe(1);
  });

  test('renders the same authenticated app at desktop width', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.mobile-page:visible')).toHaveCount(1);
    const bounds = await page.locator('.profile-layout').boundingBox();
    expect(bounds!.width).toBeLessThanOrEqual(480);
    await page.screenshot({ path: 'test-results/desktop-same-app.png', fullPage: true });
  });
});
