import { expect, test, type Page } from './coverage-fixture';
import { mkdirSync, writeFileSync } from 'node:fs';

test.use({ timezoneId: 'Asia/Bangkok' });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3e0AAAAASUVORK5CYII=', 'base64');
const imageData = `data:image/png;base64,${png.toString('base64')}`;
const nutrients = { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 };
const names = ['เส้นก๋วยเตี๋ยวขาว', 'เนื้อหมูสับ', 'หมูชิ้น', 'กุ้ง', 'ลูกชิ้นปลา', 'ถั่วงอก', 'ถั่วลิสงป่น', 'มะนาว', 'พริกป่น', 'ต้นหอมและผักรวมสำหรับทดสอบชื่อส่วนประกอบที่ยาวมากบนหน้าจอมือถือ'];
const amounts = [200, 75, 50, 50, 50, 30, 10, 15, 5, 10];
const captures = '.local/meal-editor-reference-20261008';

async function setup(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-08T05:00:00Z'));
  let meal: any = { id: 'reference-meal', name: 'ก๋วยเตี๋ยวต้มยำหมูสับหมูชิ้นกุ้งลูกชิ้น', activityDate: '2026-10-06', mealType: 'lunch', imageData, totalCalories: 643.5,
    ingredients: names.map((name, index) => ({ id: `ingredient-${index}`, name, amount: amounts[index], unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: nutrients, ...nutrients })) };
  let failSave = true;
  const writes: Array<{ method: string; body: any; path: string }> = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === '/api/auth/me') return json({ user: { id: 'reference-user', displayName: 'ทดสอบ', email: 'reference@example.test', age: 30, weightKg: 70, heightCm: 170, bmi: 24, dailyCalorieTarget: 2000 } });
    if (path === '/api/meals/daily') return json({ date: url.searchParams.get('date'), meals: [] });
    if (path === '/api/exercises/daily') return json({ date: url.searchParams.get('date'), exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    if (path === '/api/meals/history') return json({ meals: [meal], hasMore: false });
    if (path === '/api/foods/estimate') { const body = request.postDataJSON(); return json({ ingredient: { name: body.name, amount: body.amount, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'food-catalog', referenceNutrients: nutrients, catalogMatch: { status: 'matched', food: { sourceName: 'แหล่งข้อมูลทดสอบ', imageUrl: imageData, url: null } } } }); }
    if (path === '/api/meals/reference-meal' && request.method() === 'PUT') {
      const body = request.postDataJSON(); writes.push({ method: 'PUT', body, path });
      if (failSave) { failSave = false; return json({ message: 'บันทึกไม่ได้ในขณะนี้' }, 500); }
      meal = { ...body, id: 'reference-meal', totalCalories: body.ingredients.reduce((sum: number, item: any) => sum + item.referenceNutrients.caloriesKcal * item.amount / item.referenceAmount, 0) };
      return json({ meal });
    }
    return json({ meals: [], foods: [], logs: [], days: [] });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  return { writes };
}

test('ten ingredient editor has one date picker, compact rows and adjacent footer controls', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: `แก้ไข ก๋วยเตี๋ยวต้มยำหมูสับหมูชิ้นกุ้งลูกชิ้น`, exact: true }).click();
  await expect(page.locator('.ingredient-row')).toHaveCount(10);
  await expect(page.locator('#meal-date-display')).toHaveCount(0);
  await expect(page.locator('.meal-panel input[type="date"]')).toHaveCount(1);
  await expect(page.getByLabel('วันที่', { exact: true })).toHaveValue('2026-10-06');
  await expect(page.locator('.meal-top-row')).toContainText('6 ต.ค. 2569');
  await expect(page.locator('.meal-total-calories strong')).toHaveText('643.5');
  await expect(page.locator('.nutrition-card strong')).toHaveText(['138.6', '14.9', '1.5']);
  await expect(page.locator('.ingredient-row img, .ingredient-thumb')).toHaveCount(0);
  mkdirSync(captures, { recursive: true });
  for (const width of [320, 360, 390, 533, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const photo = await page.locator('.image-picker > img').boundingBox();
    expect(photo!.width).toBeGreaterThanOrEqual(80); expect(photo!.width).toBeLessThanOrEqual(96);
    expect(Math.abs(photo!.height - photo!.width)).toBeLessThan(1);
    for (const row of await page.locator('.ingredient-row').all()) {
      const title = await row.locator('.ingredient-card-title > strong:first-child').boundingBox();
      const kcal = await row.locator('.ingredient-calories').boundingBox();
      expect(title!.x + title!.width).toBeLessThanOrEqual(kcal!.x + 1);
      expect((await row.boundingBox())!.height).toBeLessThanOrEqual(width >= 480 ? 104 : 145);
      expect((await row.locator('input').boundingBox())!.width).toBeGreaterThanOrEqual(72);
      expect((await row.getByRole('button', { name: /^ลบ / }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    const add = await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).boundingBox();
    const calculate = await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่', exact: true }).boundingBox();
    const save = await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).boundingBox();
    const cancel = await page.getByRole('button', { name: 'ยกเลิก', exact: true }).boundingBox();
    expect(calculate!.y - add!.y - add!.height).toBeGreaterThanOrEqual(0);
    expect(calculate!.y - add!.y - add!.height).toBeCloseTo(8, 0);
    expect(save!.y - calculate!.y - calculate!.height).toBeCloseTo(8, 0);
    expect(cancel!.y - save!.y - save!.height).toBeCloseTo(8, 0);
    expect(save!.height).toBeGreaterThanOrEqual(48); expect(save!.height).toBeLessThanOrEqual(52);
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).scrollIntoViewIfNeeded();
    const visibleSave = await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).boundingBox();
    const nav = await page.locator('.mobile-nav').boundingBox();
    expect(visibleSave!.y + visibleSave!.height).toBeLessThanOrEqual(nav!.y + 1);
    writeFileSync(`${captures}/editor-${width}.json`, JSON.stringify({ width, ingredientHeights: await page.locator('.ingredient-row').evaluateAll(rows => rows.map(row => row.getBoundingClientRect().height)), buttonGaps: { addToCalculate: calculate!.y - add!.y - add!.height, calculateToSave: save!.y - calculate!.y - calculate!.height, saveToCancel: cancel!.y - save!.y - save!.height } }, null, 2));
    await page.screenshot({ path: `${captures}/editor-${width}.png`, fullPage: true });
  }
});

test('existing date, image, ingredient and save callbacks preserve drafts and totals', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: /^แก้ไข ก๋วยเตี๋ยว/ }).click();
  await page.getByLabel('ชื่ออาหาร', { exact: true }).fill('มื้อแก้ไขทดสอบ');
  await page.getByLabel('วันที่', { exact: true }).fill('2026-10-05');
  await expect(page.locator('.meal-top-row')).toContainText('5 ต.ค. 2569');
  await page.locator('.meal-top-row select').selectOption('dinner');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'เปลี่ยนรูป', exact: true }).click()]);
  await chooser.setFiles({ name: 'changed.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('img', { name: 'ตัวอย่างรูปอาหาร', exact: true })).toBeVisible();
  await expect(page.getByLabel('ชื่ออาหาร', { exact: true })).toHaveValue('มื้อแก้ไขทดสอบ');
  await expect(page.getByLabel('ปริมาณส่วนประกอบ 1', { exact: true })).toHaveValue('200');
  await page.getByRole('button', { name: 'ลบรูป', exact: true }).click();
  await expect(page.locator('.image-picker > img')).toHaveCount(0);
  await expect(page.locator('.ingredient-row')).toHaveCount(10);
  await page.getByLabel('ปริมาณส่วนประกอบ 1', { exact: true }).fill('250');
  const save = page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true });
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่', exact: true }).click();
  await expect(page.locator('.meal-total-calories strong')).toHaveText('708.5');
  await page.getByRole('button', { name: `ลบ ${names[9]}`, exact: true }).click();
  await expect(page.locator('.nutrient-heading')).toContainText('9 รายการ');
  await expect(save).toBeDisabled();
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ', { exact: true }).fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ', exact: true }).click();
  const catalog = page.locator('.ingredient-row').last();
  await expect(catalog.locator('img, .ingredient-thumb')).toHaveCount(0);
  await expect(catalog.locator('.ingredient-source-badge')).toHaveText('ฐานข้อมูล');
  await catalog.locator('summary').click();
  await expect(catalog.locator('details')).toContainText('แหล่งข้อมูลทดสอบ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่', exact: true }).click();
  await expect(page.locator('.meal-total-calories strong')).toHaveText('825.5');
  await save.click();
  await expect(page.getByRole('alert')).toContainText('บันทึกไม่ได้ในขณะนี้');
  await expect(page.getByLabel('ชื่ออาหาร', { exact: true })).toHaveValue('มื้อแก้ไขทดสอบ');
  await expect(page.getByLabel('วันที่', { exact: true })).toHaveValue('2026-10-05');
  await save.click();
  await expect(page.getByRole('status').filter({ hasText: 'แก้ไขอาหารแล้ว' })).toBeVisible();
  await expect(page.locator('.meal-panel')).toHaveCount(0);
  expect(state.writes).toHaveLength(2);
  expect(state.writes.at(-1)).toMatchObject({ method: 'PUT', path: '/api/meals/reference-meal', body: { name: 'มื้อแก้ไขทดสอบ', mealType: 'dinner', activityDate: '2026-10-05', imageData: null } });
  expect(state.writes.at(-1)!.body.ingredients).toHaveLength(10);
  expect(state.writes.at(-1)!.body.ingredients).toEqual(expect.arrayContaining([expect.objectContaining({ name: names[0], amount: 250 }), expect.objectContaining({ name: 'ข้าวสวย', amount: 100, source: 'food-catalog' })]));
});
