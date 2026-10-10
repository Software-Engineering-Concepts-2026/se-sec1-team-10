import { expect, test, type Page } from './coverage-fixture';
import { mkdirSync } from 'node:fs';

test.use({ timezoneId: 'Asia/Bangkok' });
const today = '2026-10-08';
const yesterday = '2026-10-07';
const nutrients = { caloriesKcal: 180, carbsGrams: 32, sugarGrams: 2, proteinGrams: 6, fatGrams: 3 };
const ingredient = (id: string, name = 'ข้าวสวย') => ({ id, name, amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'legacy', referenceNutrients: nutrients, ...nutrients });
const meal = (id: string, name: string, activityDate: string, mealType: string | null = 'lunch', totalCalories = 360) => ({ id, name, activityDate, mealType, imageData: null, totalCalories, ingredients: [ingredient(`${id}-ingredient`)] });

async function setup(page: Page, includePrevious = false, additionalMeals: ReturnType<typeof meal>[] = []) {
  await page.clock.setFixedTime(new Date('2026-10-08T05:00:00Z'));
  let meals = [meal('old-meal', 'ข้าวผัดทดสอบชื่ออาหารที่ยาวมากสำหรับหน้าจอมือถือขนาดเล็ก', today), ...(includePrevious ? [meal('past-meal', 'มื้อย้อนหลังที่ต้องลบ', yesterday)] : []), ...additionalMeals];
  const writes: Array<{ method: string; body?: any; id?: string }> = [];
  let failNextDelete = false;
  let failNextPut = false;
  let delayPrevious = false;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const { pathname, searchParams } = url;
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (pathname === '/api/auth/me') return json({ user: { id: 'home-user', email: 'home@example.test', displayName: 'ทดสอบ', age: 30, weightKg: 70, heightCm: 170, bmi: 24, dailyCalorieTarget: 2000, goalSettings: null } });
    if (pathname === '/api/exercises/daily') {
      const date = searchParams.get('date');
      if (date === yesterday && delayPrevious) await new Promise(resolve => setTimeout(resolve, 800));
      const caloriesConsumed = meals.filter(item => item.activityDate === date).reduce((sum, item) => sum + item.totalCalories, 0);
      return json({ date, exercises: [], caloriesConsumed, caloriesBurned: 0, netCalories: caloriesConsumed });
    }
    if (pathname === '/api/meals/daily') {
      const date = searchParams.get('date');
      if (date === yesterday && delayPrevious) await new Promise(resolve => setTimeout(resolve, 800));
      return json({ date, meals: meals.filter(item => item.activityDate === date) });
    }
    if (pathname === '/api/foods/estimate') return json({ ingredient: { name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual', referenceNutrients: nutrients } });
    if (pathname === '/api/meals' && request.method() === 'POST') {
      const body = request.postDataJSON(); writes.push({ method: 'POST', body });
      const saved = { ...body, id: 'created-meal', totalCalories: 180, ingredients: body.ingredients.map((item: any, index: number) => ({ ...item, id: `created-${index}`, ...nutrients })) };
      meals = [...meals, saved]; return json({ meal: saved });
    }
    if (pathname.startsWith('/api/meals/') && request.method() === 'PUT') {
      const id = pathname.split('/').at(-1)!; const body = request.postDataJSON(); writes.push({ method: 'PUT', body, id });
      if (failNextPut) { failNextPut = false; return json({ message: 'บันทึกไม่ได้ในขณะนี้' }, 500); }
      const saved = { ...body, id, totalCalories: 180, ingredients: body.ingredients.map((item: any, index: number) => ({ ...item, id: `${id}-${index}`, ...nutrients })) };
      meals = meals.map(item => item.id === id ? saved : item); return json({ meal: saved });
    }
    if (pathname.startsWith('/api/meals/') && request.method() === 'DELETE') {
      const id = pathname.split('/').at(-1)!; writes.push({ method: 'DELETE', id });
      if (failNextDelete) { failNextDelete = false; return json({ message: 'ลบไม่ได้ในขณะนี้' }, 500); }
      meals = meals.filter(item => item.id !== id); return json({ ok: true });
    }
    return json({ meals: [], foods: [], logs: [], days: [], caloriesConsumed: 0, caloriesBurned: 0 });
  });
  await page.goto('/');
  await expect(page.locator('.ref-meal-card')).toHaveCount(1 + additionalMeals.filter(item => item.activityDate === today).length);
  return { writes, setDeleteFailure: () => { failNextDelete = true; }, setPutFailure: () => { failNextPut = true; }, delayPrevious: () => { delayPrevious = true; } };
}

test('selected date add/edit uses existing editor and refreshes the overview without duplicate meals', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await expect(page.locator('.ref-today-meals-header h2')).toContainText('อาหาร · 7 ต.ค. 2569');
  await expect(page.locator('.ref-meal-card')).toHaveCount(0);
  await page.getByRole('button', { name: /บันทึกอาหารวันที่/ }).click();
  await page.getByLabel('ชื่ออาหาร').fill('มื้อย้อนหลัง');
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('100');
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await page.getByRole('button', { name: 'บันทึกข้อมูล' }).click();
  await expect(page.locator('.ref-today-meals-header h2')).toContainText('อาหาร · 7 ต.ค. 2569');
  await expect(page.getByRole('status').filter({ hasText: 'บันทึกอาหารแล้ว' })).toContainText('บันทึกอาหารแล้ว');
  await expect(page.locator('.ref-meal-card')).toHaveCount(1);
  expect(state.writes.filter(item => item.method === 'POST')).toHaveLength(1);
  expect(state.writes.find(item => item.method === 'POST')?.body.activityDate).toBe(yesterday);
  await expect(page.locator('.ref-carbs > div:first-child strong')).toContainText('32');
  await page.locator('.ref-meal-card').getByRole('button', { name: /เปิดรายละเอียด/ }).click();
  await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('มื้อย้อนหลัง');
  await page.getByLabel('ชื่ออาหาร').fill('แก้ไขมื้อย้อนหลัง');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expect(page.locator('.ref-meal-card')).toContainText('แก้ไขมื้อย้อนหลัง');
  expect(state.writes.filter(item => item.method === 'POST')).toHaveLength(1);
  expect(state.writes.filter(item => item.method === 'PUT')).toHaveLength(1);
  expect(state.writes.find(item => item.method === 'PUT')).toMatchObject({ id: 'created-meal', body: { activityDate: yesterday } });
  await page.locator('.ref-meal-card').getByRole('button', { name: /^แก้ไข/ }).click();
  await page.getByLabel('ชื่ออาหาร').fill('ฉบับร่างที่ต้องเก็บไว้');
  await page.getByLabel('วันที่').fill(today);
  state.setPutFailure();
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expect(page.getByRole('alert')).toContainText('บันทึกไม่ได้ในขณะนี้');
  await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('ฉบับร่างที่ต้องเก็บไว้');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expect(page.locator('.ref-today-meals-header h2')).toContainText('อาหาร · 7 ต.ค. 2569');
  await expect(page.locator('.ref-date input')).toHaveValue(yesterday);
  expect(state.writes.filter(item => item.method === 'PUT').at(-1)).toMatchObject({ id: 'created-meal', body: { activityDate: today } });
});

test('delete confirms, preserves a failed past-day item, then refreshes count and calorie and macro summary', async ({ page }) => {
  const state = await setup(page, true);
  await page.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await expect(page.locator('.ref-today-meals-header')).toContainText('1 รายการ');
  let acceptDelete = false;
  page.on('dialog', dialog => acceptDelete ? dialog.accept() : dialog.dismiss());
  await page.locator('.ref-meal-card').getByRole('button', { name: /^ลบ/ }).click();
  await expect(page.locator('.ref-meal-card')).toHaveCount(1);
  expect(state.writes.filter(item => item.method === 'DELETE')).toHaveLength(0);
  acceptDelete = true;
  state.setDeleteFailure();
  await page.locator('.ref-meal-card').getByRole('button', { name: /^ลบ/ }).click();
  await expect(page.getByRole('alert')).toContainText('ลบไม่ได้ในขณะนี้');
  await expect(page.locator('.ref-meal-card')).toHaveCount(1);
  await page.locator('.ref-meal-card').getByRole('button', { name: /^ลบ/ }).click();
  await expect(page.locator('.ref-meal-card')).toHaveCount(0);
  await expect(page.locator('.ref-today-meals-header')).toContainText('0 รายการ');
  await expect(page.locator('.energy-consumed')).toHaveText('0');
  await expect(page.locator('.ref-carbs > div:first-child strong')).toContainText('0');
  await expect(page.locator('.ref-date input')).toHaveValue(yesterday);
  expect(state.writes.filter(item => item.method === 'DELETE')).toHaveLength(2);
});

test('meal card and actions fit narrow and desktop viewports without horizontal overflow', async ({ page }) => {
  await setup(page);
  const directory = '.local/home-meal-actions-20261008';
  mkdirSync(directory, { recursive: true });
  for (const width of [320, 360, 390, 533, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const card = page.locator('.ref-meal-card');
    const bounds = await card.boundingBox();
    expect(bounds).not.toBeNull();
    const heading = (await page.locator('.ref-today-meals-header h2').boundingBox())!;
    const add = page.getByRole('button', { name: 'เพิ่มรายการ', exact: false });
    const addBox = (await add.boundingBox())!;
    expect(addBox.x).toBeGreaterThanOrEqual(heading.x + heading.width);
    expect(heading.y + heading.height / 2).toBeCloseTo(addBox.y + addBox.height / 2, 0);
    expect(addBox.height).toBeGreaterThanOrEqual(44);
    for (const heading of await page.locator('.ref-today-meal-group-header').all()) {
      const headingBounds = await heading.boundingBox();
      expect(headingBounds).not.toBeNull();
      expect(headingBounds!.x).toBeGreaterThanOrEqual(0);
      expect(headingBounds!.x + headingBounds!.width).toBeLessThanOrEqual(width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await card.getByRole('button', { name: /แก้ไข/ }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await card.getByRole('button', { name: /ลบ/ }).evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true });
  }
});

test('macro summary keeps actual amounts above target visible and fits narrow widths', async ({ page }) => {
  const largeMeal = meal('macro-over-target', 'มื้อทดสอบสารอาหารเกินเป้าหมาย', today, 'dinner', 2921);
  const overTarget = { caloriesKcal: 2921, carbsGrams: 271, sugarGrams: 2, proteinGrams: 196, fatGrams: 117 };
  largeMeal.ingredients[0] = { ...largeMeal.ingredients[0], ...overTarget, referenceNutrients: overTarget };
  await setup(page, false, [largeMeal]);
  const rows = page.locator('.ref-macro-stack .ref-macro-row');
  await expect(rows).toHaveCount(3);
  for (const [selector, text] of [['.ref-carbs', '303 / 250'], ['.ref-protein', '202 / 100'], ['.ref-fat', '120 / 67']]) {
    await expect(page.locator(`.ref-macro-stack ${selector} strong`)).toContainText(text);
    expect(await page.locator(`.ref-macro-stack ${selector} .ref-macro-track > span`).evaluate(element => (element as HTMLElement).style.width)).toBe('100%');
  }
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const row of await rows.all()) {
      const icon = (await row.locator('svg').boundingBox())!;
      expect(icon.width).toBe(20);
      expect(icon.height).toBe(20);
      const badge = row.locator('.ref-macro-icon-badge');
      const circle = (await badge.boundingBox())!;
      expect(circle.width).toBe(36);
      expect(circle.height).toBe(36);
      await expect(badge).toHaveCSS('border-radius', '50%');
      expect(await badge.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
      expect(Math.abs(icon.x + icon.width / 2 - circle.x - circle.width / 2)).toBeLessThan(1);
      expect(Math.abs(icon.y + icon.height / 2 - circle.y - circle.height / 2)).toBeLessThan(1);
      const label = (await row.locator('> div:first-child > span').boundingBox())!;
      const amount = (await row.locator('strong').boundingBox())!;
      if (amount.y < label.y + label.height - 1) expect(amount.x).toBeGreaterThanOrEqual(label.x + label.width);
      else expect(amount.y).toBeGreaterThanOrEqual(label.y + label.height);
      const track = (await row.locator('.ref-macro-track').boundingBox())!;
      expect(track.height).toBeGreaterThanOrEqual(6);
      expect(track.height).toBeLessThanOrEqual(8);
    }
  }
});

test('choosing the currently selected date keeps the Home data loaded', async ({ page }) => {
  await setup(page);
  await page.locator('.ref-date input').fill(today);
  await expect(page.locator('.ref-meal-card')).toHaveCount(1);
  await expect(page.locator('.ref-today-meals-header h2')).toContainText('อาหาร · 8 ต.ค. 2569');
});

test('slow selected-date reload does not label or display the previous day meals as the new day', async ({ page }) => {
  const state = await setup(page);
  state.delayPrevious();
  await page.getByRole('button', { name: 'วันก่อนหน้า' }).click();
  await expect(page.locator('.ref-today-meals-header h2')).toContainText('อาหาร · 7 ต.ค. 2569');
  await expect(page.locator('.ref-meal-card')).toHaveCount(0);
  await expect(page.getByText('กำลังโหลดรายการอาหาร…')).toBeVisible();
  await expect(page.locator('.ref-meal-card')).toHaveCount(0);
  await expect(page.locator('.ref-meal-card').getByText(/ข้าวผัดทดสอบ/)).toHaveCount(0);
  await expect(page.locator('.ref-today-meal-group')).toHaveCount(0);
});

test('Home groups mixed meal types in order, omits empty groups, and rounds summed raw calories', async ({ page }) => {
  await setup(page, false, [
    meal('snack-meal', 'ของว่าง', today, 'snack', 90.2),
    meal('dinner-meal', 'อาหารเย็น', today, 'dinner', 300.3),
    meal('breakfast-two', 'อาหารเช้าอีกจาน', today, 'breakfast', 10.6),
    meal('breakfast-one', 'อาหารเช้าจานแรก', today, 'breakfast', 10.6),
  ]);
  await expect(page.locator('.ref-today-meal-group-header h3')).toHaveText(['อาหารเช้า', 'อาหารกลางวัน', 'อาหารเย็น', 'ของว่าง']);
  await expect(page.locator('.ref-today-meal-group-header').nth(0)).toContainText('2 รายการ · 21 kcal');
  await expect(page.locator('.ref-today-meal-group-header').nth(1)).toContainText('1 รายการ · 360 kcal');
  await expect(page.locator('.ref-today-meal-group-header').nth(2)).toContainText('1 รายการ · 300 kcal');
  await expect(page.locator('.ref-today-meal-group-header').nth(3)).toContainText('1 รายการ · 90 kcal');
  await expect(page.locator('.ref-meal-card')).toHaveCount(5);
});

test('single-type and unrecognized historical meals remain visible; editing moves a meal between groups', async ({ page }) => {
  await setup(page, false, [meal('unknown-meal', 'มื้อเก่าที่ไม่ทราบประเภท', today, null, 110)]);
  await expect(page.locator('.ref-today-meal-group-header h3')).toHaveText(['อาหารกลางวัน', 'ไม่ระบุมื้อ']);
  await page.getByRole('button', { name: /^แก้ไข มื้อเก่าที่ไม่ทราบประเภท/ }).click();
  await page.getByRole('combobox', { name: /^มื้ออาหาร/ }).selectOption('dinner');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click();
  await expect(page.locator('.ref-today-meal-group-header h3')).toHaveText(['อาหารกลางวัน', 'อาหารเย็น']);
  await expect(page.locator('.ref-today-meal-group').nth(1)).toContainText('มื้อเก่าที่ไม่ทราบประเภท');

  await page.getByRole('button', { name: 'แก้ไข มื้อเก่าที่ไม่ทราบประเภท' }).click();
  await page.getByRole('button', { name: '← กลับหน้าแรก' }).click();
  await expect(page.locator('.ref-today-meal-group-header h3')).toHaveText(['อาหารกลางวัน', 'อาหารเย็น']);
});

test('a single meal type renders only its nonempty group and deleting its last meal removes the group', async ({ page }) => {
  await setup(page);
  await expect(page.locator('.ref-today-meal-group-header h3')).toHaveText(['อาหารกลางวัน']);
  page.on('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /^ลบ/ }).click();
  await expect(page.locator('.ref-today-meal-group')).toHaveCount(0);
});
