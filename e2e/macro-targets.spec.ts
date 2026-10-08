import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const date = '2026-10-08';
const initial = {
  id: 'macro-user', displayName: 'ผู้ทดสอบสารอาหาร', email: 'macro@example.test', age: 30,
  weightKg: 70, heightCm: 175, bmi: 22.9, dailyCalorieTarget: 2000, targetWeightKg: 72,
  goalSettings: { mode: 'maintain', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'manual', tdeeKcal: 2638,
    profileSnapshot: { age: 30, weightKg: 70, heightCm: 175 }, startWeightKg: 70, updatedAt: `${date}T00:00:00.000Z` },
};
async function setup(page: Page, options: { noTarget?: boolean; overTarget?: boolean } = {}) {
  let user = structuredClone(initial);
  if (options.noTarget) Object.assign(user, { dailyCalorieTarget: null, goalSettings: null });
  let failSave = false, failDaily = false;
  const saves: Array<Record<string, any>> = [];
  await page.route('**/api/**', async route => {
    const { pathname } = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (pathname === '/api/auth/me') return json({ user });
    if (pathname === '/api/goals') {
      const body = route.request().postDataJSON(); saves.push(body);
      if (failSave) return json({ message: 'บันทึกเป้าหมายไม่สำเร็จ' }, 503);
      user = { ...user, dailyCalorieTarget: body.dailyCalorieTarget, targetWeightKg: body.targetWeightKg, goalSettings: { ...user.goalSettings, ...body.goalSettings } };
      return json({ user });
    }
    if (pathname === '/api/meals/daily') return json({ meals: [{ id: 'meal', name: 'อาหารทดสอบ', activityDate: date, mealType: 'lunch', totalCalories: 420,
      ingredients: [{ name: 'ส่วนประกอบ', amount: 100, unit: 'g', caloriesKcal: 420, carbsGrams: options.overTarget ? 300 : 40, proteinGrams: 20, fatGrams: 10 }] }] });
    if (pathname === '/api/exercises/daily') return failDaily ? json({ message: 'โหลดวันนี้ไม่สำเร็จ' }, 503) : json({ date, exercises: [], caloriesConsumed: 420, caloriesBurned: 0, netCalories: 420 });
    if (pathname === '/api/meals/history') return json({ meals: [], hasMore: false });
    return json({ foods: [], logs: [], days: [], caloriesConsumed: 0, caloriesBurned: 0 });
  });
  await page.goto('/');
  await expect(page.locator('.ref-macro-row')).toHaveCount(3);
  return { saves, failSave: (value: boolean) => { failSave = value; }, failDaily: (value: boolean) => { failDaily = value; } };
}
async function openGoals(page: Page) {
  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  await page.getByRole('button', { name: /เป้าหมายสุขภาพ/ }).click();
  await expect(page.locator('.goal-macro-preview')).toBeVisible();
}

test('macro previews use manual calories and only saved goals update Today and survive reload', async ({ page }) => {
  const state = await setup(page);
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('40 / 250 กรัม');
  await expect(page.locator('.ref-macro-row.ref-protein strong')).toHaveText('20 / 100 กรัม');
  await openGoals(page);
  await expect(page.locator('.goal-macro-item.ref-carbs')).toContainText('50%');
  await expect(page.locator('.goal-macro-item.ref-protein')).toContainText('100');
  for (const mode of ['ลดน้ำหนัก', 'เพิ่มกล้ามเนื้อ']) {
    await page.getByRole('radio', { name: mode, exact: true }).check();
    await expect(page.locator('.goal-macro-item.ref-carbs')).toContainText('45%');
    await expect(page.locator('.goal-macro-item.ref-protein')).toContainText('125');
  }
  await page.getByLabel('เป้าหมายพลังงานต่อวัน (kcal)').fill('2400');
  await expect(page.locator('.goal-macro-item.ref-carbs strong')).toHaveText('270 กรัม/วัน');
  await expect(page.locator('.goal-macro-item.ref-protein strong')).toHaveText('150 กรัม/วัน');
  await expect(page.locator('.goal-macro-item.ref-fat strong')).toHaveText('80 กรัม/วัน');
  expect(state.saves).toHaveLength(0);
  await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('40 / 250 กรัม');
  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  state.failSave(true);
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายไม่สำเร็จ', { exact: true })).toBeVisible();
  await expect(page.getByLabel('เป้าหมายพลังงานต่อวัน (kcal)')).toHaveValue('2400');
  state.failSave(false);
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายเรียบร้อยแล้ว', { exact: true })).toBeVisible();
  expect(Object.keys(state.saves.at(-1)!.goalSettings).sort()).toEqual(['activityLevel', 'formulaSex', 'mode', 'targetMode']);
  await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('40 / 270 กรัม');
  await page.reload();
  await expect(page.locator('.ref-macro-row.ref-protein strong')).toHaveText('20 / 150 กรัม');
  await expect(page.locator('.ref-macro-row.ref-fat strong')).toHaveText('10 / 80 กรัม');
  mkdirSync('.local/macro-ui-polish-20261008', { recursive: true });
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/macro-ui-polish-20261008/today-${width}.png`, fullPage: true });
  }
  await openGoals(page);
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `.local/macro-ui-polish-20261008/goals-${width}.png`, fullPage: true });
  }
});

test('macro progress keeps an over-target amount but caps its visual track', async ({ page }) => {
  await setup(page, { overTarget: true });
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('300 / 250 กรัม');
  await expect(page.locator('.ref-carbs .ref-macro-track')).toHaveAttribute('aria-label', /120 เปอร์เซ็นต์/);
  await expect(page.locator('.ref-carbs .ref-macro-track span')).toHaveAttribute('style', 'width: 100%;');
});

test('unset macro targets are not fabricated and Today retries and labels the selected past date', async ({ page }) => {
  const state = await setup(page, { noTarget: true });
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('40 กรัม');
  await expect(page.locator('.ref-macro-track[aria-label="ยังไม่ได้ตั้งเป้าสารอาหาร"]')).toHaveCount(3);
  state.failDaily(true);
  await page.reload();
  await expect(page.getByText('โหลดวันนี้ไม่สำเร็จ', { exact: true })).toBeVisible();
  state.failDaily(false);
  await page.getByRole('button', { name: 'ลองโหลดอีกครั้ง', exact: true }).click();
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toHaveText('40 กรัม');
  await page.locator('.ref-date input').fill('2026-10-07');
  await expect(page.locator('#today-meals-title')).toContainText('อาหาร · 7 ต.ค. 2569');
  await page.getByRole('button', { name: 'ดูรายละเอียดเพิ่มเติม', exact: true }).click();
  await expect(page.locator('.ref-details')).toContainText('วันที่ย้อนหลังเทียบกับเป้าหมายปัจจุบัน');
});
