import { test, expect, type Page } from './coverage-fixture';
import { mkdirSync } from 'node:fs';
import { goalSchema, type GoalInput, type PublicUser } from '../src/shared/contracts';

const initialUser: PublicUser = { id: 'goal-user', email: 'goal@example.com', displayName: 'ผู้ทดสอบเป้าหมาย', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9, dailyCalorieTarget: null, targetWeightKg: null, goalSettings: null };
async function setup(page: Page, initial: PublicUser = initialUser, validateGoalInput = false) {
  await page.clock.install({ time: new Date('2026-10-07T12:00:00+07:00') });
  let user = structuredClone(initial);
  const saved: GoalInput[] = [];
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me') return json({ user });
    if (path === '/api/goals') {
      const rawBody = route.request().postDataJSON();
      if (validateGoalInput) {
        const parsed = goalSchema.safeParse(rawBody);
        if (!parsed.success) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Invalid goal payload' }) });
      }
      const body = rawBody as GoalInput; saved.push(body);
      const settings = body.goalSettings!;
      const target = settings.targetMode === 'manual' ? body.dailyCalorieTarget : { maintain: 2638, lose: 2374, 'gain-muscle': 2770 }[settings.mode];
      user = { ...user, targetWeightKg: body.targetWeightKg, dailyCalorieTarget: target, goalSettings: { ...settings, tdeeKcal: 2638, profileSnapshot: { age: 30, weightKg: 70, heightCm: 175 }, startWeightKg: 70, updatedAt: '2026-10-06T00:00:00.000Z' } };
      return json({ user });
    }
    if (path === '/api/exercises/daily') return json({ caloriesConsumed: 2000, caloriesBurned: 600, netCalories: 1400, exercises: [] });
    if (path === '/api/meals/daily') return json({ meals: [] });
    if (path === '/api/weight-logs') return json({ logs: [{ id: 'weight-1', date: '2026-10-05', weightKg: 70, heightCm: 175, bmi: 22.9 }, { id: 'weight-2', date: '2026-10-06', weightKg: 68, heightCm: 175, bmi: 22.2 }] });
    if (path === '/api/summary/weekly') return json({ startDate: '2026-09-30', endDate: '2026-10-06', caloriesConsumed: 2000, caloriesBurned: 700, days: Array.from({ length: 7 }, (_, index) => ({ date: `2026-10-0${index + 1}`, caloriesConsumed: index === 0 ? 2000 : 0, caloriesBurned: index === 0 ? 600 : index === 1 ? 100 : 0, netCalories: index === 0 ? 1400 : index === 1 ? -100 : 0, mealCount: index === 0 ? 2 : 0 })) });
    return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ message: 'unexpected API' }) });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  return { saved };
}
async function openGoals(page: Page) {
  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  await page.getByRole('button', { name: /เป้าหมายสุขภาพ/ }).click();
  await expect(page.getByRole('heading', { name: 'เป้าหมายสุขภาพ', exact: true })).toBeVisible();
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('320px: explicit formula choice, goal presets, manual override and saved progress', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const { saved } = await setup(page);
  await openGoals(page);
  await expect(page.getByLabel('เพศที่ใช้ในสูตรคำนวณ')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true })).toBeDisabled();
  await page.getByLabel('เพศที่ใช้ในสูตรคำนวณ').selectOption('male');
  await expect(page.locator('.goal-baseline')).toContainText('2,638 kcal');
  await page.getByRole('radio', { name: /ลดน้ำหนัก/ }).check();
  await expect(page.getByRole('radio', { name: /ใช้ค่าประมาณ/ })).toHaveAccessibleName(/2,374/);
  await page.getByRole('radio', { name: /เพิ่มกล้ามเนื้อ/ }).check();
  await expect(page.getByRole('radio', { name: /ใช้ค่าประมาณ/ })).toHaveAccessibleName(/2,770/);
  await page.getByRole('radio', { name: 'กำหนดเอง', exact: true }).check();
  await page.getByLabel('เป้าหมายพลังงานต่อวัน (kcal)').fill('2500');
  await page.getByLabel('น้ำหนักเป้าหมาย (กก.)').fill('72');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายเรียบร้อยแล้ว', { exact: true })).toBeVisible();
  expect(saved[0]).toMatchObject({ dailyCalorieTarget: 2500, targetWeightKg: 72, goalSettings: { mode: 'gain-muscle', formulaSex: 'male', targetMode: 'manual' } });
  await noHorizontalOverflow(page);
  mkdirSync('.local/goals-check', { recursive: true });
  await page.screenshot({ path: '.local/goals-check/goals-320.png', fullPage: true });
  await page.getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  await expect(page.locator('.trend-goal-stats')).toContainText('72 กก.');
  await expect(page.locator('.weekly-totals')).toContainText('-500');
  await expect(page.locator('.unlogged-day')).toHaveCount(6);
  await noHorizontalOverflow(page);
});

test('weekly summary does not pretend an unset goal or an unlogged day is a calorie deficit', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  await expect(page.locator('.weekly-totals')).toContainText('ยังไม่ได้ตั้งเป้าหมาย');
  await expect(page.locator('.weekly-bars b')).toHaveText(Array(7).fill('—'));
  await expect(page.locator('.unlogged-day')).toHaveCount(6);
});

test('390px: legacy calories stay manual until confirmation; new goal does not add exercise twice', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { saved } = await setup(page, { ...initialUser, dailyCalorieTarget: 2000, targetWeightKg: 65 });
  await openGoals(page);
  await expect(page.getByRole('radio', { name: 'กำหนดเอง', exact: true })).toBeChecked();
  await expect(page.getByLabel('เป้าหมายพลังงานต่อวัน (kcal)')).toHaveValue('2000');
  await page.getByLabel('เพศที่ใช้ในสูตรคำนวณ').selectOption('male');
  await expect(page.getByLabel('เป้าหมายพลังงานต่อวัน (kcal)')).toHaveValue('2000');
  await page.getByRole('radio', { name: /ใช้ค่าประมาณ/ }).check();
  await expect(page.locator('.ref-goal-compare')).toContainText('ปัจจุบัน: 2,000 kcal/วัน');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายเรียบร้อยแล้ว', { exact: true })).toBeVisible();
  expect(saved[0]).not.toHaveProperty('dailyCalorieTarget');
  await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
  await expect(page.locator('.energy-remaining')).toHaveText('638');
  await noHorizontalOverflow(page);
});

test('desktop: a changed profile suggests recalculation and does not silently save', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const { saved } = await setup(page, { ...initialUser, weightKg: 68, targetWeightKg: 65, dailyCalorieTarget: 2638, goalSettings: { mode: 'maintain', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'recommended', tdeeKcal: 2638, startWeightKg: 70, profileSnapshot: { age: 30, weightKg: 70, heightCm: 175 }, updatedAt: '2026-10-05T00:00:00.000Z' } });
  await openGoals(page);
  await expect(page.getByText(/ข้อมูลส่วนตัวเปลี่ยนจากตอนคำนวณครั้งล่าสุด/)).toBeVisible();
  await page.getByRole('button', { name: 'ใช้ค่าประมาณใหม่', exact: true }).click();
  expect(saved).toHaveLength(0);
  await page.getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  await expect(page.locator('.trend-goal-stats')).toContainText('-2 กก.');
  await expect(page.locator('.trend-target-line')).toContainText('65 กก.');
  await expect(page.locator('.weekly-totals')).toContainText('-638');
  await page.getByRole('button', { name: 'BMI', exact: true }).click();
  await expect(page.getByRole('img', { name: 'กราฟ BMI รายวัน', exact: true })).toBeVisible();
  await expect(page.locator('.trend-target-line')).toHaveCount(0);
  await expect(page.locator('.ref-trend-chart')).toContainText('BMI 22.2');
  await page.getByRole('button', { name: 'น้ำหนัก', exact: true }).click();
  await expect(page.locator('.trend-target-line')).toContainText('65 กก.');
  await noHorizontalOverflow(page);
  mkdirSync('.local/goals-check', { recursive: true });
  await page.screenshot({ path: '.local/goals-check/progress-desktop.png', fullPage: true });
});

test('saved goal metadata is projected to API fields when changing lose to gain muscle', async ({ page }) => {
  const initial: PublicUser = {
    ...initialUser,
    targetWeightKg: 85,
    dailyCalorieTarget: 2374,
    goalSettings: {
      mode: 'lose', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'recommended',
      tdeeKcal: 2638, startWeightKg: 95,
      profileSnapshot: { age: 30, weightKg: 95, heightCm: 175 }, updatedAt: '2026-10-06T00:00:00.000Z',
    },
  };
  const { saved } = await setup(page, { ...initial, weightKg: 95 }, true);
  await openGoals(page);
  await expect(page.getByRole('radio', { name: /ลดน้ำหนัก/ })).toBeChecked();
  await page.getByRole('radio', { name: /เพิ่มกล้ามเนื้อ/ }).check();
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายเรียบร้อยแล้ว', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'เป้าหมายสุขภาพ' })).toBeVisible();
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ targetWeightKg: 85, goalSettings: { mode: 'gain-muscle', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'recommended' } });
  expect(Object.keys(saved[0].goalSettings ?? {}).sort()).toEqual(['activityLevel', 'formulaSex', 'mode', 'targetMode']);
});
