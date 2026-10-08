import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const user = { id: 'compact-ui', email: 'compact@example.com', displayName: 'ผู้ทดสอบ', age: 30, weightKg: 68, heightCm: 165, bmi: 25, dailyCalorieTarget: 1900, targetWeightKg: 64, goalSettings: null, avatarImageData: null };
const nutrients = { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 };
const outputDir = '.local/compact-ui-fixes-20261008';

async function capture(page: Page, name: string, width: number, extra: Record<string, unknown>) {
  mkdirSync(outputDir, { recursive: true });
  const base = `${outputDir}/${name}-${width}`;
  const metrics = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, horizontalOverflow: document.documentElement.scrollWidth > innerWidth }));
  await page.screenshot({ path: `${base}.png`, fullPage: true, animations: 'disabled' });
  writeFileSync(`${base}.json`, JSON.stringify({ name, ...metrics, ...extra }, null, 2));
}

async function login(page: Page) {
  let saved: unknown;
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me') return json({ user });
    if (path === '/api/meals/daily') return json({ date: new URL(request.url()).searchParams.get('date') || today(), meals: [], caloriesConsumed: 0 });
    if (path === '/api/meals/history') return json({ meals: [{ id: 'meal-history', name: 'ข้าวในประวัติ', mealType: 'lunch', activityDate: today(), totalCalories: 130, imageData: null, ingredients: [{ name: 'ข้าวสวย', amount: 100, unit: 'g', ...nutrients }] }], hasMore: false });
    if (path === '/api/foods/estimate') {
      const body = request.postDataJSON() as { name: string; amount: number };
      const fromAi = body.name !== 'ข้าวสวย';
      return json({ ingredient: { name: body.name, amount: body.amount, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: fromAi ? 'ai-estimate' : 'food-catalog', referenceNutrients: nutrients, ...(fromAi ? { catalogMatch: { status: 'ambiguous' } } : { catalogMatch: { status: 'matched', food: { sourceName: 'ฐานข้อมูลอาหาร', url: null } } }) } });
    }
    if (path === '/api/meals' && method === 'POST') { saved = request.postDataJSON(); const body = saved as Record<string, unknown>; const ingredients = body.ingredients as Array<Record<string, unknown>>; return json({ meal: { ...body, id: 'saved-meal', totalCalories: 130, ingredients: ingredients.map(item => ({ ...item, ...nutrients })) } }, 201); }
    if (path === '/api/exercises/daily') return json({ date: today(), exercises: [{ id: 'walk', activityDate: today(), activityType: 'walking', durationMinutes: 30, caloriesBurned: 100 }], caloriesConsumed: 0, caloriesBurned: 100, netCalories: -100 });
    if (path === '/api/health-history') return json({ points: [{ date: today(), weightKg: 68, bmi: 25 }] });
    if (path === '/api/weight-logs') return json({ points: [], logs: [{ id: 'weight-1', date: today(), weightKg: 68, heightCm: 165, bmi: 25 }] });
    if (path === '/api/summary/weekly') return json({ startDate: today(), endDate: today(), days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    return json({ message: `fixture: ${method} ${path}` });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  return () => saved;
}

test('compact ingredient cards preserve editing, provenance, recalculation, save, and touch targets', async ({ page }) => {
  const saved = await login(page);
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
  await page.getByLabel('ชื่ออาหาร').fill('มื้อทดสอบ');
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  const longAiName = 'อกไก่ย่างซอสสมุนไพรและผักรวมสำหรับทดสอบชื่อส่วนประกอบภาษาไทยที่ยาวมาก';
  await page.getByLabel('ชื่อส่วนประกอบ').fill(longAiName);
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('350');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  const card = page.locator('.ingredient-row.portion-row').first();
  const aiCard = page.locator('.ingredient-row.portion-row').nth(1);
  await expect(card).toBeVisible();
  await expect(aiCard).toContainText(longAiName);
  await expect(aiCard.locator('.ingredient-source-badge')).toContainText('ค่าประมาณ AI');
  await expect(aiCard.getByLabel('ปริมาณส่วนประกอบ 2')).toHaveValue('350');
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await expect(card.locator('.ingredient-calories')).toHaveText('130 kcal');
  await expect(aiCard.locator('.ingredient-calories')).toHaveText('455 kcal');
  await expect(card.locator('.ingredient-source-badge')).toContainText('ฐานข้อมูล');
  await card.locator('.ingredient-provenance summary').click();
  await expect(card.locator('.ingredient-provenance')).toHaveAttribute('open', '');
  await expect(card.locator('.ingredient-provenance')).toContainText('ฐานข้อมูลอาหาร');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await card.locator('.ingredient-provenance summary').click();

  for (const width of [320, 360, 390, 533, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const height = await card.evaluate(element => element.getBoundingClientRect().height);
    expect(height, `ingredient card at ${width}px`).toBeLessThanOrEqual(width >= 390 ? 115 : 140);
    const quantity = card.getByLabel('ปริมาณส่วนประกอบ 1');
    const remove = card.getByRole('button', { name: 'ลบ ข้าวสวย' });
    expect(await quantity.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    expect(await quantity.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(72);
    expect(await remove.evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    expect(await card.locator('.ingredient-provenance summary').evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    const aiCardBox = await aiCard.boundingBox();
    expect(aiCardBox?.height, `long AI ingredient card at ${width}px`).toBeLessThanOrEqual(width >= 390 ? 115 : 140);
    expect(await aiCard.getByRole('button', { name: `ลบ ${longAiName}` }).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThanOrEqual(44);
    if ([320, 390, 533].includes(width)) {
      await capture(page, 'ingredient-collapsed', width, { cardHeight: height, aiCardHeight: await aiCard.evaluate(element => element.getBoundingClientRect().height),
        quantityHeight: await quantity.evaluate(element => element.getBoundingClientRect().height),
        deleteWidth: await remove.evaluate(element => element.getBoundingClientRect().width) });
      await card.locator('.ingredient-provenance summary').click();
      await expect(card.locator('.ingredient-provenance')).toHaveAttribute('open', '');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await capture(page, 'ingredient-details-open', width, { cardHeight: await card.evaluate(element => element.getBoundingClientRect().height) });
      await card.locator('.ingredient-provenance summary').click();
      await aiCard.locator('.ingredient-provenance summary').click();
      await expect(aiCard.locator('.ingredient-provenance')).toContainText('ยังจับคู่กับฐานข้อมูลอาหารไม่ได้แน่ชัด');
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const detailBounds = await aiCard.locator('.ingredient-provenance > *:not(summary)').boundingBox();
      expect(detailBounds?.x).toBeGreaterThanOrEqual(0);
      expect((detailBounds?.x ?? 0) + (detailBounds?.width ?? 0)).toBeLessThanOrEqual(width);
      await capture(page, 'ingredient-ai-details-open', width, { detailBounds });
      await aiCard.locator('.ingredient-provenance summary').click();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('200');
  await expect(page.getByRole('status').filter({ hasText: 'ข้อมูลเปลี่ยนแล้ว' })).toContainText('คำนวณสารอาหารใหม่');
  await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await expect(page.locator('.meal-total-calories')).toContainText('715');
  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('บันทึกอาหารแล้ว');
  expect(saved()).toMatchObject({ name: 'มื้อทดสอบ', ingredients: [{ name: 'ข้าวสวย', amount: 200, referenceNutrients: nutrients }, { name: longAiName, amount: 350, source: 'ai-estimate' }] });
});

test('reminder labels and secondary actions fit mobile widths and keep 44px targets', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  await page.getByRole('button', { name: /แจ้งเตือนมื้ออาหาร/ }).click();
  for (const width of [320, 360, 390, 533, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const label = page.locator('.ref-reminder-times label').first();
    expect(await label.locator('> span').evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(100);
    expect(await label.locator('input').evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    if ([320, 390, 533].includes(width)) await capture(page, 'reminders', width, {
      labelWidth: await label.locator('> span').evaluate(element => element.getBoundingClientRect().width),
      inputHeight: await label.locator('input').evaluate(element => element.getBoundingClientRect().height),
    });
  }
});

test('Diary, exercise, weight, and profile actions retain 44px hit areas', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  async function checkHistoryActions() {
    const buttons = page.locator('.diary-meal-history .row-actions button');
    await expect(buttons).toHaveCount(2);
    for (const width of [320, 390, 533]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const button of await buttons.all()) expect(await button.evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    }
  }
  await checkHistoryActions();
  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
  await checkHistoryActions();
  const history = page.locator('.diary-history-head .diary-link');
  await expect(history).toBeVisible();
  expect(await history.evaluate(element => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await page.getByRole('button', { name: 'เสร็จสิ้น', exact: true }).click();
  await page.getByRole('button', { name: 'บันทึกกิจกรรม' }).click();
  const exerciseActions = page.locator('.ref-exercise .row-actions button');
  await expect(exerciseActions).toHaveCount(2);
  for (const button of await exerciseActions.all()) expect(await button.evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  const weightActions = page.locator('.ref-weight-log-list .row-actions button');
  await expect(weightActions).toHaveCount(2);
  for (const button of await weightActions.all()) expect(await button.evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);

  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  await page.getByRole('button', { name: /ข้อมูลส่วนตัว/ }).click();
  const photoActions = page.locator('.profile-photo-actions > label.text-button, .profile-photo-actions > button.text-button');
  for (const button of await photoActions.all()) expect(await button.evaluate(element => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
});
