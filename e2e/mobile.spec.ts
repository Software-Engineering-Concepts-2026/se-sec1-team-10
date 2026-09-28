import { expect, test, type Page, type Route } from '@playwright/test';

const user = { id: 'u1', email: 'food@example.com', displayName: 'Food tester', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function mockApi(page: Page, options: { aiConfigured?: boolean } = {}) {
  let loggedIn = false;
  let meals: unknown[] = [];
  let nextMealId = 1;
  let analyzeCalls = 0;
  let mealSaveCalls = 0;
  let lastSavedIngredients: unknown[] = [];
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me' && method === 'GET') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (path === '/api/auth/login' && method === 'POST') { loggedIn = true; return json({ user }); }
    if (path === '/api/auth/logout' && method === 'POST') { loggedIn = false; return route.fulfill({ status: 204 }); }
    const caloriesConsumed = () => (meals as { totalCalories: number }[]).reduce((total, meal) => total + meal.totalCalories, 0);
    const calculateMeal = (body: Record<string, unknown>, id: string) => {
      const ingredients = (body.ingredients as { amount: number; referenceAmount: number; referenceNutrients: Record<string, number | null>; [key: string]: unknown }[]).map(ingredient => {
        const nutrients = Object.fromEntries(Object.entries(ingredient.referenceNutrients).map(([key, value]) => [key, value === null ? null : Math.round(value * ingredient.amount / ingredient.referenceAmount * 100) / 100]));
        return { ...ingredient, ...nutrients };
      });
      const totalCalories = Math.round(ingredients.reduce((total, ingredient) => total + (typeof ingredient.caloriesKcal === 'number' ? ingredient.caloriesKcal : 0), 0));
      return { id, ...body, ingredients, totalCalories };
    };
    if (path === '/api/meals/daily' && method === 'GET') return json({ date: url.searchParams.get('date'), meals, caloriesConsumed: caloriesConsumed() });
    if (path === '/api/meals/analyze' && method === 'POST') {
      analyzeCalls += 1;
      if (!options.aiConfigured) return json({ message: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร' }, 503);
      return json({ analysis: { name: 'ข้าวมันไก่', mealType: 'lunch', ingredients: [{ name: 'ข้าว', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 462, carbsGrams: 50, sugarGrams: 4, proteinGrams: 25, fatGrams: 18 } }], portionDescription: 'หนึ่งจาน', source: 'ai-estimate', notes: ['Estimated from the image only; confirm ingredients and portions before saving.'] } });
    }
    if (path === '/api/meals' && method === 'POST') {
      mealSaveCalls += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      lastSavedIngredients = body.ingredients as unknown[];
      const meal = calculateMeal(body, `m${nextMealId++}`);
      meals = [meal];
      return json({ meal }, 201);
    }
    if (/^\/api\/meals\/[^/]+$/.test(path) && method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const id = path.split('/').at(-1);
      const current = (meals as Record<string, unknown>[]).find(meal => meal.id === id);
      if (!current) return json({ message: 'not found' }, 404);
      lastSavedIngredients = body.ingredients as unknown[];
      const meal = calculateMeal(body, id ?? 'missing');
      meals = (meals as Record<string, unknown>[]).map(item => item.id === id ? meal : item);
      return json({ meal });
    }
    if (/^\/api\/meals\/[^/]+$/.test(path) && method === 'DELETE') {
      const id = path.split('/').at(-1);
      meals = (meals as Record<string, unknown>[]).filter(meal => meal.id !== id);
      return route.fulfill({ status: 204 });
    }
    if (path === '/api/foods/search' && method === 'GET') return json({ foods: [{ fdcId: 123, name: 'Rice', dataType: 'Foundation', nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, proteinGrams: 3, fatGrams: 0.3, sugarGrams: 0.1 }, source: 'usda-fdc', url: 'https://fdc.nal.usda.gov/food-details/123/nutrients' }] });
    if (path === '/api/exercises/daily' && method === 'GET') return json({ date: url.searchParams.get('date'), exercises: [], caloriesConsumed: caloriesConsumed(), caloriesBurned: 0, netCalories: caloriesConsumed() });
    if (path === '/api/summary/weekly' && method === 'GET') return json({ startDate: '2026-09-08', endDate: '2026-09-14', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (path === '/api/health-history' && method === 'GET') return json({ points: [], rangeDays: 365, performanceTargetMs: 1500 });
    if (path === '/api/meals/history' && method === 'GET') return json({ meals });
    if (path === '/api/profile' && method === 'PUT') return json({ user });
    if (path === '/api/goals' && method === 'PUT') return json({ user });
    return json({ message: `unmocked ${method} ${path}` }, 404);
  });
  return { get analyzeCalls() { return analyzeCalls; }, get mealSaveCalls() { return mealSaveCalls; }, get lastSavedIngredients() { return lastSavedIngredients; } };
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('อีเมล').fill('food@example.com');
  await page.getByLabel('รหัสผ่าน').fill('ValidPassword123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
}

async function openFoodSearch(page: Page) {
  await page.getByRole('button', { name: 'เพิ่มรายการเอง', exact: true }).click();
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByRole('button', { name: 'ค้นหาจากฐานข้อมูลอาหาร', exact: true }).click();
  return page.getByRole('region', { name: 'เพิ่มส่วนประกอบจากฐานข้อมูล' });
}

test.describe('mobile navigation and food logging', () => {
  test('keeps logout disabled until a profile save completes', async ({ page }) => {
    await mockApi(page);
    let releaseSave!: () => void;
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve; });
    await page.route('**/api/profile', async route => {
      await saveGate;
      await route.fulfill({ json: { user } });
    });
    await login(page);
    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByRole('button', { name: 'ข้อมูลส่วนตัว' }).click();
    const logout = page.getByRole('button', { name: 'ออกจากระบบ ↗' });
    try {
      await page.getByRole('button', { name: 'บันทึกข้อมูลส่วนตัว →' }).click();
      await expect(page.getByRole('button', { name: 'กำลังบันทึก…' })).toBeDisabled();
      await expect(logout).toBeDisabled();
    } finally {
      releaseSave();
    }
    await expect(page.getByText('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')).toBeVisible();
    await expect(logout).toBeEnabled();
    await logout.click();
    await expect(page.getByRole('heading', { name: 'ยินดีต้อนรับกลับมา', exact: true })).toBeVisible();
  });

  test('opens account profile details only when requested', async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();

    await expect(page.getByText('ข้อมูลล่าสุด', { exact: true })).not.toBeVisible();
    await page.getByRole('button', { name: 'ดูข้อมูลโปรไฟล์', exact: true }).click();
    await expect(page.getByText('ข้อมูลล่าสุด', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ซ่อนข้อมูลโปรไฟล์', exact: true }).click();
    await expect(page.getByText('ข้อมูลล่าสุด', { exact: true })).not.toBeVisible();
  });

  test('opts into account-scoped reminders and delivers a due notification once', async ({ page }) => {
    await page.addInitScript(() => {
      const calls: unknown[] = [];
      Object.assign(window, { notificationCalls: calls });
      class FakeNotification {
        static permission = 'granted';
        static async requestPermission() { return 'granted'; }
      }
      Object.defineProperty(window, 'Notification', { value: FakeNotification, configurable: true });
      const registration = { showNotification: async (title: string, options: unknown) => { calls.push({ title, options }); } };
      Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => registration, ready: Promise.resolve(registration) } });
      if (!localStorage.getItem('lifebalance-reminders:u1')) localStorage.setItem('lifebalance-reminders:u1', 'malformed');
    });
    await mockApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByRole('button', { name: 'แจ้งเตือนมื้ออาหาร' }).click();
    const time = await page.evaluate(() => new Date().toTimeString().slice(0, 5));
    await page.getByLabel('มื้อที่ 1', { exact: true }).fill(time);
    await page.getByRole('button', { name: 'เปิดแจ้งเตือนมื้ออาหาร', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ปิดแจ้งเตือนมื้ออาหาร' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { notificationCalls: unknown[] }).notificationCalls.length)).toBe(1);
    await page.getByRole('button', { name: 'วันนี้', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('reminder-settings-changed')));
    expect(await page.evaluate(() => (window as unknown as { notificationCalls: unknown[] }).notificationCalls.length)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifebalance-reminders:u1')!).enabled)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('lifebalance-reminders:u2'))).toBeNull();
  });
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
    await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('50');
    const saveButton = page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true });
    await expect(saveButton).toBeDisabled();
    expect(mock.mealSaveCalls).toBe(0);
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await expect(page.getByText('คำนวณสารอาหารใหม่แล้ว ตรวจสอบผลรวมก่อนบันทึก')).toBeVisible();
    await expect(page.locator('.meal-total-calories')).toContainText('231');
    await expect(page.locator('.nutrition-summary-grid')).toContainText('25');
    await expect(page.locator('.nutrition-summary-grid')).toContainText('12.5');
    await expect(page.locator('.nutrition-summary-grid')).toContainText('9');
    await page.getByRole('button', { name: 'บันทึกข้อมูล' }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();
    expect(mock.mealSaveCalls).toBe(1);
    expect(mock.lastSavedIngredients).toMatchObject([{ amount: 50 }]);
    await page.getByRole('button', { name: 'วันนี้', exact: true }).click();
    await expect(page.locator('.energy-ring strong')).toHaveText('231');
    await expect(page.locator('.macro-summary')).toContainText('13');
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
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (ก.)').fill('100');
    await foodSearch.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await foodSearch.getByRole('button', { name: /Rice/ }).click();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
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

  test('searches USDA food, applies a 200g portion, and marks the source', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (ก.)').fill('200');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await page.getByRole('button', { name: /Rice/ }).click();
    await expect(page.getByText('USDA FoodData Central', { exact: true })).toBeVisible();
    await expect(page.locator('.portion-row strong').first()).toHaveText('Rice');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('200');
  });

  test('edits, deletes, and finds a saved meal in history', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (ก.)').fill('100');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await page.getByRole('button', { name: /Rice/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อทดสอบ');
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByText('มื้อทดสอบ')).toBeVisible();
    await page.getByRole('button', { name: 'แก้ไข', exact: true }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อแก้ไข');
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.getByText('มื้อแก้ไข')).toBeVisible();
    await page.getByRole('tab', { name: 'ประวัติ', exact: true }).click();
    await expect(page.locator('.history-panel').getByText('มื้อแก้ไข')).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('tab', { name: 'อาหาร', exact: true }).click();
    await page.getByRole('button', { name: 'ลบ', exact: true }).click();
    await expect(page.getByText('ยังไม่มีรายการอาหารในวันนี้')).toBeVisible();
    await page.getByRole('tab', { name: 'ประวัติ', exact: true }).click();
    await expect(page.getByText('ไม่พบรายการในช่วงวันที่เลือก')).toBeVisible();
  });
});
