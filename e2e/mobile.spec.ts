import { expect, test, type Page, type Route } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { formatDisplayDate } from '../src/client/formatDisplay';

const user = { id: 'u1', email: 'food@example.com', displayName: 'Food tester', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9 };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function mockApi(page: Page, options: { aiConfigured?: boolean; historyMeals?: Record<string, unknown>[] } = {}) {
  let loggedIn = false;
  let meals: unknown[] = options.historyMeals ?? [];
  let nextMealId = 1;
  let analyzeCalls = 0;
  let mealSaveCalls = 0;
  let lastSavedIngredients: unknown[] = [];
  const createdMealBodies: Record<string, unknown>[] = [];
  const updatedMealIds: string[] = [];
  const historyCalls: { q: string; limit: number; offset: number }[] = [];
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
    if (path === '/api/meals/daily' && method === 'GET') {
      const date = url.searchParams.get('date');
      const daily = (meals as { activityDate: string; totalCalories: number }[]).filter(meal => meal.activityDate === date);
      return json({ date, meals: daily, caloriesConsumed: daily.reduce((total, meal) => total + meal.totalCalories, 0) });
    }
    if (path === '/api/meals/analyze' && method === 'POST') {
      analyzeCalls += 1;
      if (!options.aiConfigured) return json({ message: 'ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร' }, 503);
      return json({ analysis: { name: 'ข้าวมันไก่', mealType: 'lunch', ingredients: [{ name: 'ข้าว', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 462, carbsGrams: 50, sugarGrams: 4, proteinGrams: 25, fatGrams: 18 } }], portionDescription: 'หนึ่งจาน', source: 'ai-estimate', notes: ['Estimated from the image only; confirm ingredients and portions before saving.'] } });
    }
    if (path === '/api/meals' && method === 'POST') {
      mealSaveCalls += 1;
      const body = request.postDataJSON() as Record<string, unknown>;
      createdMealBodies.push(body);
      lastSavedIngredients = body.ingredients as unknown[];
      const meal = calculateMeal(body, `m${nextMealId++}`);
      meals = [...meals, meal];
      return json({ meal }, 201);
    }
    if (/^\/api\/meals\/[^/]+$/.test(path) && method === 'PUT') {
      const body = request.postDataJSON() as Record<string, unknown>;
      const id = path.split('/').at(-1);
      updatedMealIds.push(id ?? '');
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
    if (path === '/api/foods/catalog' && method === 'GET') return json({ foods: url.searchParams.get('q')?.toLowerCase().includes('rice') ? [{ id: 'rice', name: 'Rice', nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, proteinGrams: 3, fatGrams: 0.3, sugarGrams: 0.1 }, source: 'food-catalog', sourceName: 'USDA FoodData Central', imageUrl: null, url: 'https://fdc.nal.usda.gov/food-details/123/nutrients' }] : [] });
    if (path === '/api/exercises/daily' && method === 'GET') return json({ date: url.searchParams.get('date'), exercises: [], caloriesConsumed: caloriesConsumed(), caloriesBurned: 0, netCalories: caloriesConsumed() });
    if (path === '/api/summary/weekly' && method === 'GET') return json({ startDate: '2026-09-08', endDate: '2026-09-14', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (path === '/api/health-history' && method === 'GET') return json({ points: [], rangeDays: 365, performanceTargetMs: 1500 });
    if (path === '/api/meals/history' && method === 'GET') {
      const q = (url.searchParams.get('q') ?? '').trim();
      const limit = Number(url.searchParams.get('limit') ?? 20);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      historyCalls.push({ q, limit, offset });
      const filtered = (meals as Record<string, unknown>[]).filter(meal => {
        const activityDate = String(meal.activityDate ?? '');
        return (!q || String(meal.name ?? '').toLocaleLowerCase().includes(q.toLocaleLowerCase()))
          && (!url.searchParams.get('from') || activityDate >= String(url.searchParams.get('from')))
          && (!url.searchParams.get('to') || activityDate <= String(url.searchParams.get('to')));
      });
      const pageMeals = filtered.slice(offset, offset + limit);
      return json({ meals: pageMeals, hasMore: offset + pageMeals.length < filtered.length });
    }
    if (path === '/api/profile' && method === 'PUT') return json({ user });
    if (path === '/api/goals' && method === 'PUT') return json({ user });
    return json({ message: `unmocked ${method} ${path}` }, 404);
  });
  return { get analyzeCalls() { return analyzeCalls; }, get mealSaveCalls() { return mealSaveCalls; }, get lastSavedIngredients() { return lastSavedIngredients; }, createdMealBodies, updatedMealIds, historyCalls };
}

async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('อีเมล').fill('food@example.com');
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('ValidPassword123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
}

async function openDiary(page: Page) {
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
}

async function openManualMeal(page: Page) {
  await openDiary(page);
  await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
  await expect(page.getByLabel('ชื่ออาหาร')).toBeVisible();
}

async function openFoodSearch(page: Page) {
  const manualAction = page.getByRole('button', { name: /บันทึกอาหาร/ });
  if (await manualAction.isVisible().catch(() => false)) await manualAction.click();
  await expect(page.getByLabel('ชื่ออาหาร')).toBeVisible();
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByRole('button', { name: 'ค้นหาจากฐานข้อมูลอาหาร', exact: true }).click();
  return page.getByRole('region', { name: 'เพิ่มส่วนประกอบจากฐานข้อมูล' });
}

test.describe('mobile navigation and food logging', () => {
  test('reveals a password only when requested and keeps the entered value', async ({ page }) => {
    await mockApi(page);
    await page.goto('/');
    const password = page.getByLabel('รหัสผ่าน', { exact: true });
    await password.fill('ui-test-only-password');
    await expect(password).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'แสดงรหัสผ่าน', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(password).toHaveValue('ui-test-only-password');
    await page.getByRole('button', { name: 'ซ่อนรหัสผ่าน', exact: true }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });

  test('shows elapsed analysis time, preserves failed drafts, and retries only on a manual click', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    const requests: { imageData: string; correctedMealName?: string }[] = [];
    let release!: () => void;
    let gate = new Promise<void>(resolve => { release = resolve; });
    const ingredient = { name: 'ข้าว', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } };
    await page.route('**/api/meals/analyze', async route => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 1 || requests.length === 3) {
        await gate;
        return route.fulfill({ status: 504, json: { error: 'timeout', message: 'การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองใหม่' } });
      }
      return route.fulfill({ json: { analysis: { name: 'ข้าวมันไก่', mealType: 'lunch', ingredients: [ingredient], portionDescription: 'หนึ่งจาน', source: 'ai-estimate', notes: [] } } });
    });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    const analyze = page.getByRole('button', { name: 'วิเคราะห์รูป', exact: true });
    await expect(analyze).toBeEnabled();
    const name = page.getByLabel('ชื่ออาหาร', { exact: true });
    await name.fill('ชื่อที่กรอกเอง');
    const preview = page.getByRole('img', { name: 'ตัวอย่างรูปอาหาร' });
    const originalImage = await preview.getAttribute('src');
    await page.clock.install();
    await analyze.click();
    try {
      await expect.poll(() => requests.length).toBe(1);
      await page.clock.runFor(11_000);
      await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toContainText('11 วินาที');
      await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toContainText('ไม่ต้องกดวิเคราะห์ซ้ำ');
      await page.getByRole('button', { name: 'กำลังวิเคราะห์…', exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click(); });
      expect(requests).toHaveLength(1);
      expect(mock.mealSaveCalls).toBe(0);
    } finally { release(); }
    await expect(page.getByRole('alert')).toContainText('โควตาอีก 1 ครั้ง');
    await expect(name).toHaveValue('ชื่อที่กรอกเอง');
    await expect(preview).toHaveAttribute('src', originalImage!);
    await expect(analyze).toBeEnabled();
    await page.clock.runFor(5000);
    expect(requests).toHaveLength(1);
    await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toHaveCount(0);
    await analyze.click();
    await expect(name).toHaveValue('ข้าวมันไก่');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('100');
    expect(requests).toHaveLength(2);
    expect(mock.mealSaveCalls).toBe(0);

    await name.fill('ข้าวผัด');
    await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('175');
    gate = new Promise<void>(resolve => { release = resolve; });
    const correction = page.getByRole('button', { name: 'วิเคราะห์ใหม่ตามชื่อที่แก้ไข', exact: true });
    await correction.click();
    try {
      await expect.poll(() => requests.length).toBe(3);
      await page.clock.runFor(10_000);
      await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toContainText('10 วินาที');
      await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toContainText('ไม่ต้องกดวิเคราะห์ซ้ำ');
      await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
    } finally { release(); }
    await expect(correction).toBeEnabled();
    await expect(name).toHaveValue('ข้าวผัด');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('175');
    await expect(preview).toHaveAttribute('src', originalImage!);
    await page.clock.runFor(5000);
    await expect(page.locator('.meal-panel .analysis-note[role="status"]')).toHaveCount(0);
    expect(requests).toHaveLength(3);
    expect(requests.every(item => item.imageData === originalImage)).toBe(true);
    expect(mock.mealSaveCalls).toBe(0);
  });

  test('reanalyses the same photo with a corrected name, replaces only on success, and requires an explicit save', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    const requests: { imageData: string; correctedMealName?: string }[] = [];
    let releaseCorrection!: () => void;
    const correctionGate = new Promise<void>(resolve => { releaseCorrection = resolve; });
    const rice = { name: 'ข้าว', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } };
    const shrimp = { ...rice, name: 'กุ้ง', amount: 150, referenceNutrients: { ...rice.referenceNutrients, caloriesKcal: 100 } };
    await page.route('**/api/meals/analyze', async route => {
      requests.push(route.request().postDataJSON());
      if (requests.length === 2) await correctionGate;
      if (requests.length === 3) return route.fulfill({ status: 502, json: { message: 'วิเคราะห์รูปไม่สำเร็จ' } });
      return route.fulfill({ json: { analysis: { name: 'ข้าวมันไก่', mealType: 'lunch', ingredients: requests.length === 1 ? [rice, { ...rice, name: 'ไก่' }] : [shrimp], portionDescription: 'ปริมาณประมาณจากภาพ', notes: [], source: 'ai-estimate' } } });
    });
    await page.setViewportSize({ width: 320, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'วิเคราะห์รูป', exact: true }).click();
    const name = page.getByLabel('ชื่ออาหาร', { exact: true });
    const correction = page.getByRole('button', { name: 'วิเคราะห์ใหม่ตามชื่อที่แก้ไข', exact: true });
    const rows = page.locator('.portion-row');
    await expect(name).toHaveValue('ข้าวมันไก่');
    await expect(rows).toHaveCount(2);
    await expect(correction).toHaveCount(0);
    await name.fill('ข้าวผัดกุ้ง');
    await expect(correction).toBeEnabled();
    await expect(page.locator('#meal-correction-warning')).toContainText('โควตาอีก 1 ครั้ง');
    await expect(page.locator('#meal-correction-warning')).toContainText('แทนที่ส่วนประกอบกับปริมาณที่แก้ไว้ทั้งหมด');
    await name.fill(' ข้าวมันไก่ ');
    await expect(correction).toHaveCount(0);
    await name.fill('  ');
    await expect(correction).toHaveCount(0);
    await name.fill('ก');
    await expect(correction).toBeDisabled();
    await name.fill(' ข้าวผัดกุ้ง ');
    await expect(correction).toBeEnabled();
    expect(requests).toHaveLength(1);
    expect(mock.mealSaveCalls).toBe(0);
    await page.getByRole('combobox', { name: /มื้ออาหาร/ }).selectOption('dinner');
    await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('250');
    try {
      await correction.click();
      await expect.poll(() => requests.length).toBe(2);
      await expect(name).toBeDisabled();
      await expect(page.getByRole('combobox', { name: /มื้ออาหาร/ })).toBeDisabled();
      await expect(page.locator('.meal-panel input[type="date"]')).toBeDisabled();
      await expect(page.locator('#meal-upload')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'ลบรูป', exact: true })).toBeDisabled();
      await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toBeDisabled();
      await expect(page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true })).toBeDisabled();
      await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
      await expect(rows).toHaveCount(2);
      expect(mock.mealSaveCalls).toBe(0);
    } finally {
      releaseCorrection();
    }
    await expect(name).toHaveValue('ข้าวผัดกุ้ง');
    await expect(name).toBeEnabled();
    await expect(page.getByRole('combobox', { name: /มื้ออาหาร/ })).toHaveValue('dinner');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('กุ้ง');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('150');
    await expect(page.getByRole('region', { name: 'สรุปโภชนาการมื้ออาหาร' })).toContainText('150');
    await expect(correction).toHaveCount(0);
    expect(requests[0].correctedMealName).toBeUndefined();
    expect(requests[1]).toEqual({ imageData: requests[0].imageData, correctedMealName: 'ข้าวผัดกุ้ง' });
    expect(mock.mealSaveCalls).toBe(0);

    await name.fill('กุ้งผัด');
    await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('175');
    await correction.click();
    await expect(page.getByRole('alert')).toContainText('วิเคราะห์รูปไม่สำเร็จ');
    await expect(name).toHaveValue('กุ้งผัด');
    await expect(correction).toBeEnabled();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('กุ้ง');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('175');
    await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
    expect(requests[2]).toEqual({ imageData: requests[0].imageData, correctedMealName: 'กุ้งผัด' });
    expect(mock.mealSaveCalls).toBe(0);
    await name.fill('ข้าวผัดกุ้ง');
    await expect(correction).toHaveCount(0);
    await name.fill('ชื่อที่แก้เอง');
    await expect(correction).toBeEnabled();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่', exact: true }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect.poll(() => mock.mealSaveCalls).toBe(1);
    expect(requests).toHaveLength(3);
    expect(mock.createdMealBodies[0]).toMatchObject({ name: 'ชื่อที่แก้เอง', mealType: 'dinner', imageData: requests[0].imageData, ingredients: [{ name: 'กุ้ง', amount: 175 }] });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('keeps catalog provenance with each ingredient after removal and a manual addition', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    const catalog = { id: 'rice', name: 'Rice', source: 'food-catalog', sourceName: 'Verified reference', url: 'https://example.org/rice', imageUrl: null, nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } };
    const rice = { name: 'Rice', amount: 200, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'food-catalog', referenceNutrients: catalog.nutrientsPer100g };
    const sauce = { name: 'Sauce', amount: 20, unit: 'g', referenceAmount: 20, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 40, carbsGrams: 10, sugarGrams: 2, proteinGrams: 0, fatGrams: 0 } };
    await page.route('**/api/meals/analyze', route => route.fulfill({ json: { analysis: { name: 'Rice with sauce', mealType: 'lunch', ingredients: [rice, sauce], portionDescription: 'Estimated plate', notes: [], source: 'ai-estimate', catalogMatches: [{ index: 0, name: 'Rice', status: 'matched', food: catalog }, { index: 1, name: 'Sauce', status: 'not-found' }] } } }));
    await page.route('**/api/foods/estimate', route => route.fulfill({ json: { ingredient: { ...rice, amount: 50 }, catalogMatch: { index: 0, name: 'Rice', status: 'matched', food: catalog } } }));
    await page.setViewportSize({ width: 320, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await page.getByRole('button', { name: 'เลือกจากอัลบั้ม', exact: true }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'วิเคราะห์รูป' }).click();
    const rows = page.locator('.portion-row');
    await expect(rows.nth(0)).toContainText('Verified reference');
    await expect(rows.nth(0)).toContainText('ปริมาณยังเป็นค่าประมาณจากภาพ');
    await rows.nth(0).locator('.ingredient-provenance summary').click();
    await expect(rows.nth(0).getByRole('link', { name: 'แหล่งข้อมูล' })).toHaveAttribute('href', catalog.url);
    await expect(rows.nth(1)).toContainText('ไม่พบในฐานข้อมูลอาหาร');
    await page.getByRole('button', { name: 'ลบ Rice', exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('ไม่พบในฐานข้อมูลอาหาร');
    await expect(rows.nth(0)).not.toContainText('Verified reference');
    await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
    await page.getByLabel('ชื่อส่วนประกอบ', { exact: true }).fill('Rice');
    await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('50');
    await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
    await expect(rows.nth(1)).toContainText('Verified reference');
    await expect(rows.nth(1)).not.toContainText('ปริมาณยังเป็นค่าประมาณจากภาพ');
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await expect(page.getByRole('region', { name: 'สรุปโภชนาการมื้ออาหาร' })).toContainText('105');
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.locator('.diary-meal-history')).toContainText('Rice with sauce');
    expect(mock.createdMealBodies[0].ingredients).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Rice', source: 'food-catalog', amount: 50 })]));
    for (const ingredient of mock.createdMealBodies[0].ingredients as Record<string, unknown>[]) {
      expect(ingredient).not.toHaveProperty('catalogMatch');
      expect(ingredient).not.toHaveProperty('photoEstimate');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
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
    await expect(logout).toHaveCount(0);
    try {
      await page.getByRole('button', { name: 'บันทึกข้อมูลส่วนตัว →' }).click();
      await expect(page.getByRole('button', { name: 'กำลังบันทึก…' })).toBeDisabled();
      await page.getByRole('button', { name: 'ย้อนกลับ', exact: true }).click();
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
    // Keep the configured reminder minute stable while CI drives the opt-in UI.
    // Only Date is fixed; application timers and the notification flow keep running.
    await page.clock.setFixedTime(new Date('2026-10-10T09:23:30Z'));
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
    await page.locator('#reminder-time-1').fill(time);
    await page.getByRole('button', { name: 'เปิดแจ้งเตือนมื้ออาหาร', exact: true }).click();
    await expect(page.getByRole('button', { name: 'ปิดแจ้งเตือนมื้ออาหาร' })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { notificationCalls: unknown[] }).notificationCalls.length)).toBe(1);
    await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
    await page.evaluate(() => window.dispatchEvent(new Event('reminder-settings-changed')));
    expect(await page.evaluate(() => (window as unknown as { notificationCalls: unknown[] }).notificationCalls.length)).toBe(1);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifebalance-reminders:u1')!).enabled)).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('lifebalance-reminders:u2'))).toBeNull();
  });
  test('switches every mobile tab without horizontal overflow at 390px', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    for (const tab of ['หน้าแรก', 'บันทึก', 'ความคืบหน้า', 'บัญชี']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.locator('.mobile-page.is-active')).toBeVisible();
    }
    await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
    await page.screenshot({ path: 'test-results/mobile-today.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  });

  test('supports a 320px viewport without horizontal overflow', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await login(page);
    await openDiary(page);
    await page.screenshot({ path: 'test-results/mobile-food.png', fullPage: true });
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width + 1);
  });

  test('analyzes an uploaded photo as a preview and saves only after confirmation', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await page.getByRole('button', { name: 'เลือกจากอัลบั้ม', exact: true }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('button', { name: 'วิเคราะห์รูป' })).toBeVisible();
    await page.getByRole('button', { name: 'วิเคราะห์รูป' }).click();
    await expect(page.locator('.ingredient-source-badge')).toHaveText('ค่าประมาณ AI');
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
    await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
    await expect(page.locator('.energy-consumed')).toHaveText('231');
    await expect(page.locator('.ref-macro-stack .ref-protein > div:first-child strong')).toContainText('13');
  });

  test('shows a usable fallback when analysis is unavailable', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await page.getByRole('button', { name: 'เลือกจากอัลบั้ม', exact: true }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    await page.getByRole('button', { name: 'วิเคราะห์รูป' }).click();
    await expect(page.getByRole('alert')).toContainText('ยังไม่ได้เปิดใช้การวิเคราะห์รูปภาพอาหาร');
    await expect(page.getByRole('alert')).toContainText('กรอกข้อมูลเองแล้วบันทึกได้');
    await page.getByLabel('ชื่ออาหาร').fill('อาหารกรอกเอง');
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('อาหารกรอกเอง');
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (กรัม)').fill('100');
    await foodSearch.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await foodSearch.getByRole('button', { name: /Rice/ }).click();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();
    expect(mock.mealSaveCalls).toBe(1);
  });

  test('keeps album upload usable when camera permission is denied', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError'); } },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await expect(page.getByText('เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือเลือกรูปจากอัลบั้ม', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'เลือกจากอัลบั้ม', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'เลือกจากอัลบั้ม', exact: true }).click();
    await page.getByLabel('เลือกรูปอาหารจากอัลบั้ม').setInputFiles({ name: 'food.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByRole('img', { name: 'ตัวอย่างรูปอาหาร' })).toBeVisible();
    expect(mock.analyzeCalls).toBe(0);
  });

  test('releases the camera stream when leaving the camera screen', async ({ page }) => {
    await mockApi(page);
    await page.addInitScript(() => {
      const stream = document.createElement('canvas').captureStream();
      const track = stream.getVideoTracks()[0];
      Object.assign(window, { cameraTrackStops: 0 });
      const stop = track.stop.bind(track);
      track.stop = () => {
        (window as unknown as { cameraTrackStops: number }).cameraTrackStops += 1;
        stop();
      };
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => stream },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
    await expect(page.getByRole('button', { name: 'ถ่ายภาพ', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
    await expect.poll(() => page.evaluate(() => (window as unknown as { cameraTrackStops: number }).cameraTrackStops)).toBe(1);
  });

  test('renders the same authenticated app at desktop width', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    await login(page);
    await expect(page.locator('.mobile-nav')).toBeVisible();
    await expect(page.locator('.mobile-page:visible')).toHaveCount(1);
    const bounds = await page.locator('.profile-layout').boundingBox();
    expect(bounds!.width).toBeGreaterThan(640);
    expect(bounds!.width).toBeLessThanOrEqual(1080);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/desktop-same-app.png', fullPage: true });
  });

  test('searches catalog food, applies a 200g portion, and marks the source', async ({ page }) => {
    const mock = await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openManualMeal(page);
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (กรัม)').fill('200');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await page.getByRole('button', { name: /Rice/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อพร้อมรูป');
    await expect(page.locator('.ingredient-source-badge')).toHaveText('ฐานข้อมูล');
    await expect(page.locator('.portion-row strong').first()).toHaveText('Rice');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('200');
    await page.setInputFiles('#meal-upload', { name: 'food.png', mimeType: 'image/png', buffer: png });
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('มื้อพร้อมรูป');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('200');
    await expect(page.getByRole('button', { name: 'วิเคราะห์รูป' })).toHaveCount(0);
    expect(mock.analyzeCalls).toBe(0);
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    expect(mock.analyzeCalls).toBe(0);
    expect(mock.createdMealBodies[0]).toMatchObject({ name: 'มื้อพร้อมรูป', ingredients: [{ source: 'food-catalog', amount: 200 }] });
    expect(mock.createdMealBodies[0].imageData).toEqual(expect.any(String));
  });

  test('searches the diary catalog and saves a reduced gram quantity without AI', async ({ page }) => {
    const mock = await mockApi(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await login(page);
    await openDiary(page);
    await page.getByLabel('ค้นหาประวัติอาหาร').fill('rice');
    await expect(page.getByRole('heading', { name: 'ประวัติอาหาร', exact: true })).toBeVisible();
    const catalog = page.getByRole('region', { name: 'ฐานข้อมูลอาหาร', exact: true });
    await expect(catalog.getByText('Rice', { exact: true })).toBeVisible();
    await expect(catalog.getByRole('link', { name: 'แหล่งข้อมูล' })).toHaveAttribute('href', 'https://fdc.nal.usda.gov/food-details/123/nutrients');
    await catalog.getByRole('button', { name: 'ใช้ Rice', exact: true }).click();
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('Rice');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('100');
    await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('50');
    await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await expect(page.getByRole('region', { name: 'สรุปโภชนาการมื้ออาหาร' })).toContainText('65');
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.locator('.diary-meal-history .diary-meal-row').filter({ has: page.getByRole('button', { name: 'แก้ไข Rice', exact: true }) })).toContainText('65 kcal');
    expect(mock.createdMealBodies[0]).toMatchObject({ ingredients: [{ source: 'food-catalog', amount: 50, referenceAmount: 100, unit: 'g' }] });
    expect(mock.analyzeCalls).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('shows unknown nutrients without enabling an incomplete catalog food', async ({ page }) => {
    await mockApi(page);
    await page.route('**/api/foods/catalog?*', route => route.fulfill({ json: { foods: [{ id: 'unknown', name: 'Unknown food', source: 'food-catalog', sourceName: 'Reference', url: null, imageUrl: null, nutrientsPer100g: { caloriesKcal: null, carbsGrams: 10, sugarGrams: null, proteinGrams: 3, fatGrams: 1 } }] } }));
    await login(page);
    await openDiary(page);
    await page.getByLabel('ค้นหาประวัติอาหาร').fill('unknown');
    const catalog = page.getByRole('region', { name: 'ฐานข้อมูลอาหาร', exact: true });
    await expect(catalog.getByRole('button', { name: /Unknown food/ })).toBeDisabled();
    await expect(catalog).toContainText('สารอาหารไม่ครบ');
    await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('unknown');
    await foodSearch.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await expect(foodSearch.getByRole('button', { name: /Unknown food/ })).toBeDisabled();
    await expect(foodSearch).toContainText('ไม่ทราบ kcal');
  });

  test('edits, deletes, and finds a saved meal in history', async ({ page }) => {
    await mockApi(page, { aiConfigured: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openManualMeal(page);
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (กรัม)').fill('100');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await page.getByRole('button', { name: /Rice/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อทดสอบ');
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'บันทึกอาหารแล้ว' })).toContainText('บันทึกอาหารแล้ว');
    await expect(page.locator('.diary-meal-history')).toContainText('มื้อทดสอบ');
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    await page.getByRole('button', { name: 'แก้ไข มื้อทดสอบ' }).click();
    await page.getByLabel('ชื่ออาหาร').fill('มื้อแก้ไข');
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'แก้ไขอาหารแล้ว' })).toContainText('แก้ไขอาหารแล้ว');
    await expect(page.locator('.diary-meal-history')).toContainText('มื้อแก้ไข');
    await expect(page.getByRole('heading', { name: 'ประวัติอาหาร', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เสร็จสิ้น', exact: true })).toBeVisible();
    await expect(page.locator('.diary-meal-history').getByText('มื้อแก้ไข')).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'ลบ มื้อแก้ไข' }).click();
    await expect(page.getByText('ยังไม่มีประวัติอาหารที่ตรงกับการค้นหา')).toBeVisible();
  });

  test('searches paged meal history and loads the next page', async ({ page }) => {
    const today = new Date();
    today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    const activityDate = today.toISOString().slice(0, 10);
    const historyMeals = Array.from({ length: 25 }, (_, index) => ({
      id: `history-${index + 1}`,
      name: index === 24 ? 'Special noodle bowl' : `History meal ${index + 1}`,
      mealType: 'lunch',
      activityDate,
      totalCalories: 130,
      ingredients: [{ name: 'Rice', amount: 100, unit: 'g', caloriesKcal: 130 }],
      imageData: null,
    }));
    const mock = await mockApi(page, { historyMeals });
    await login(page);
    await openDiary(page);
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    await page.getByLabel('ค้นหาประวัติอาหาร').fill('noodle');
    const history = page.locator('.diary-meal-history');
    await expect(history.getByText('Special noodle bowl')).toBeVisible();
    await expect(history.locator('article')).toHaveCount(1);
    expect(mock.historyCalls).toContainEqual({ q: 'noodle', limit: 20, offset: 0 });

    await page.getByLabel('ค้นหาประวัติอาหาร').fill('');
    await expect(history.locator('article')).toHaveCount(20);
    await expect(page.getByRole('button', { name: 'ดูประวัติเพิ่ม', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'ดูประวัติเพิ่ม', exact: true }).click();
    await expect(history.locator('article')).toHaveCount(25);
    await expect(page.getByRole('button', { name: 'ดูประวัติเพิ่ม', exact: true })).toHaveCount(0);
    expect(mock.historyCalls).toContainEqual({ q: '', limit: 20, offset: 20 });
  });

  test('reuses a searched history meal as a new meal on the selected date without changing its source', async ({ page }) => {
    const mock = await mockApi(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await openDiary(page);
    const selectedDate = '2026-09-27';
    await expect(page.locator('.diary-date-card')).toHaveCount(0);
    await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
    await page.locator('.meal-panel').getByLabel('วันที่', { exact: true }).fill(selectedDate);
    const foodSearch = await openFoodSearch(page);
    await foodSearch.getByRole('textbox', { name: 'ค้นหาอาหาร' }).fill('rice');
    await foodSearch.getByLabel('ปริมาณ (กรัม)').fill('120');
    await foodSearch.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await foodSearch.getByRole('button', { name: /Rice/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('ข้าวสำหรับทดสอบประวัติ');
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    expect(mock.createdMealBodies[0]).toMatchObject({
      name: 'ข้าวสำหรับทดสอบประวัติ',
      activityDate: selectedDate,
      ingredients: [{ source: 'food-catalog', amount: 120 }],
    });

    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    await page.getByLabel('ค้นหาประวัติอาหาร').fill('ข้าวสำหรับทดสอบประวัติ');
    const history = page.locator('.diary-meal-history');
    await expect(history).toContainText(formatDisplayDate(selectedDate));
    await history.getByRole('button', { name: /บันทึกมื้อนี้อีกครั้ง/ }).click();
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('ข้าวสำหรับทดสอบประวัติ');
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('120');
    await expect(page.locator('.ingredient-source-badge')).toHaveText('ฐานข้อมูล');
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();

    expect(mock.updatedMealIds).toEqual([]);
    expect(mock.createdMealBodies).toHaveLength(2);
    expect(mock.createdMealBodies[1]).toMatchObject({
      name: 'ข้าวสำหรับทดสอบประวัติ',
      activityDate: selectedDate,
      ingredients: [{ source: 'food-catalog', amount: 120 }],
    });
    mkdirSync('.local/screenshots', { recursive: true });
    await page.screenshot({ path: '.local/screenshots/diary-history-390.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 800 });
    await page.screenshot({ path: '.local/screenshots/diary-history-320.png', fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'ประวัติอาหาร', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'เสร็จสิ้น', exact: true })).toBeVisible();
    await page.getByLabel('ค้นหาประวัติอาหาร').fill('ข้าวสำหรับทดสอบประวัติ');
    await expect(page.locator('.diary-meal-history').getByRole('button', { name: /บันทึกมื้อนี้อีกครั้ง/ })).toHaveCount(2);
  });
});
