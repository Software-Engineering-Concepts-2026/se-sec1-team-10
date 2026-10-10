import { expect, test, type Page } from './coverage-fixture';
import { mkdirSync } from 'node:fs';

test.use({ timezoneId: 'Asia/Bangkok' });
const currentDay = '2026-10-08';
const previousDay = '2026-10-07';

async function openHome(page: Page) {
  await page.clock.setFixedTime(new Date('2026-10-08T05:00:00Z'));
  const requests: Array<{ endpoint: string; date: string | null }> = [];
  const user = { id: 'date-user', email: 'date@example.test', displayName: 'ผู้ทดสอบวันที่', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9, dailyCalorieTarget: 2000, goalSettings: null };
  await page.route('**/api/**', async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const date = searchParams.get('date');
    const calories = date === currentDay ? 300 : date === previousDay ? 600 : 900;
    const json = (body: unknown) => route.fulfill({ status: 200, json: body });
    if (pathname === '/api/auth/me') return json({ user });
    if (pathname === '/api/exercises/daily') {
      requests.push({ endpoint: pathname, date });
      return json({ date, exercises: [], caloriesConsumed: calories, caloriesBurned: 0, netCalories: calories });
    }
    if (pathname === '/api/meals/daily') {
      requests.push({ endpoint: pathname, date });
      return json({ date, meals: [{ id: `meal-${date}`, name: `อาหารของ ${date}`, activityDate: date, mealType: 'lunch', totalCalories: calories, ingredients: [] }] });
    }
    return json({ meals: [], foods: [], logs: [], days: [], caloriesConsumed: 0, caloriesBurned: 0 });
  });
  await page.goto('/');
  await expect(page.locator('.energy-consumed')).toHaveText('300');
  return requests;
}

test('previous and next day reload both daily endpoints and stop at today', async ({ page }) => {
  const requests = await openHome(page);
  const next = page.getByRole('button', { name: 'วันถัดไป', exact: true });
  const previous = page.getByRole('button', { name: 'วันก่อนหน้า', exact: true });
  const date = page.locator('.ref-date input');
  await expect(date).toHaveValue(currentDay);
  await expect(next).toBeDisabled();
  await previous.click();
  await expect(date).toHaveValue(previousDay);
  await expect(next).toBeEnabled();
  await expect(page.locator('.energy-consumed')).toHaveText('600');
  await expect(page.locator('.ref-today-meals')).toContainText(`อาหารของ ${previousDay}`);
  for (const endpoint of ['/api/meals/daily', '/api/exercises/daily']) expect(requests.some(request => request.endpoint === endpoint && request.date === previousDay)).toBe(true);
  await next.click();
  await expect(date).toHaveValue(currentDay);
  await expect(next).toBeDisabled();
  await expect(page.locator('.energy-consumed')).toHaveText('300');
  await expect(page.locator('.ref-today-meals')).toContainText(`อาหารของ ${currentDay}`);
  for (const endpoint of ['/api/meals/daily', '/api/exercises/daily']) expect(requests.at(requests.map(request => request.endpoint).lastIndexOf(endpoint))?.date).toBe(currentDay);
});

test('date bar opens the native picker, rejects future dates and crosses month/year boundaries', async ({ page }) => {
  const requests = await openHome(page);
  await page.evaluate(() => {
    const original = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function () {
      this.dataset.pickerOpened = 'true';
      return original.call(this);
    };
  });
  const date = page.locator('.ref-date input');
  await expect(date).toHaveAttribute('type', 'date');
  await expect(date).toHaveAttribute('max', currentDay);
  await page.locator('.ref-date').click();
  await expect(date).toHaveAttribute('data-picker-opened', 'true');
  await page.keyboard.press('Escape');
  await date.fill('2026-01-01');
  await expect(page.locator('.ref-today-meals')).toContainText('อาหารของ 2026-01-01');
  await page.getByRole('button', { name: 'วันก่อนหน้า', exact: true }).click();
  await expect(date).toHaveValue('2025-12-31');
  await expect(page.locator('.ref-date')).toContainText('31 ธ.ค. 2568');
  await expect(page.locator('.ref-today-meals')).toContainText('อาหารของ 2025-12-31');
  await page.getByRole('button', { name: 'วันถัดไป', exact: true }).click();
  await expect(date).toHaveValue('2026-01-01');
  await date.fill('2026-10-09');
  await expect(date).toHaveValue('2026-01-01');
  expect(requests.some(request => request.date === '2026-10-09')).toBe(false);
});

test('three controls stay on one row with usable arrows at mobile and desktop widths', async ({ page }) => {
  await openHome(page);
  const directory = '.local/home-date-selector-20261008';
  mkdirSync(directory, { recursive: true });
  for (const width of [320, 360, 390, 533, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const selector = page.locator('.ref-date-selector');
    const [previous, date, next] = await Promise.all([selector.locator('button').first().boundingBox(), selector.locator('.ref-date').boundingBox(), selector.locator('button').last().boundingBox()]);
    for (const arrow of [previous!, next!]) {
      expect(arrow.width).toBe(44);
      expect(arrow.height).toBe(44);
      expect(Math.abs(arrow.y + arrow.height / 2 - (date!.y + date!.height / 2))).toBeLessThanOrEqual(1);
    }
    expect(previous!.x + previous!.width).toBeLessThanOrEqual(date!.x);
    expect(date!.x + date!.width).toBeLessThanOrEqual(next!.x);
    expect(date!.width).toBeGreaterThan(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const summary = await page.locator('.ref-today-summary').boundingBox();
    expect(summary!.y).toBeGreaterThanOrEqual(date!.y + date!.height);
    await page.screenshot({ path: `${directory}/home-${width}.png`, fullPage: true });
  }
});
