import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const captures = '.local/camera-home-cleanup-20261008';

const user = {
  id: 'ui-polish', email: 'ui-polish@example.com', displayName: 'ผู้ทดสอบ', age: 30,
  weightKg: 70, heightCm: 170, bmi: 24.2, dailyCalorieTarget: 1900, targetWeightKg: null,
  goalSettings: null, avatarImageData: 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=',
};
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };

async function openApp(page: Page) {
  let weeklyAttempts = 0;
  let catalogAttempts = 0;
  let failWeekly = true;
  await page.route('**/api/**', async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return json({ user });
    if (pathname === '/api/summary/weekly') {
      weeklyAttempts++;
      if (failWeekly) return json({ message: 'ยังโหลดไม่ได้' }, 503);
      return json({ startDate: today(), endDate: today(), days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    }
    if (pathname === '/api/meals/history') return json({ meals: [], hasMore: false });
    if (pathname === '/api/foods/catalog') {
      catalogAttempts++;
      if (catalogAttempts === 1) return json({ message: 'ค้นหาไม่ได้' }, 503);
      return json({ foods: [] });
    }
    if (pathname === '/api/meals/daily') return json({ date: searchParams.get('date'), meals: [], caloriesConsumed: 0 });
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    if (pathname === '/api/weight-logs') return json({ logs: [] });
    return json({});
  });
  await page.goto('/');
  return { weeklyAttempts: () => weeklyAttempts, catalogAttempts: () => catalogAttempts, allowWeekly: () => { failWeekly = false; } };
}

test('camera fills the space above navigation on mobile and desktop', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => Promise.reject(new Error('permission denied')) } });
  });
  await openApp(page);
  await page.locator('.ref-nav').getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('button', { name: /ถ่ายภาพอาหาร/ }).click();
  await expect(page.locator('.diary-camera-error')).toHaveCount(1);
  mkdirSync(captures, { recursive: true });
  for (const [width, height] of [[320, 667], [360, 800], [390, 844], [533, 886], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    const nav = await page.locator('.ref-nav').boundingBox();
    const gallery = await page.getByRole('button', { name: /เลือกจากอัลบั้ม/ }).boundingBox();
    const shutter = await page.getByRole('button', { name: 'ถ่ายภาพ' }).boundingBox();
    const camera = await page.locator('.diary-camera').boundingBox();
    const controls = await page.locator('.diary-camera-controls').boundingBox();
    for (const selector of ['.diary-camera', '.diary-camera-controls']) {
      expect(await page.locator(selector).evaluate(element => {
        const style = getComputedStyle(element);
        return [style.borderTopLeftRadius, style.borderTopRightRadius, style.borderBottomLeftRadius, style.borderBottomRightRadius];
      })).toEqual(['0px', '0px', '0px', '0px']);
    }
    expect(gallery!.y + gallery!.height).toBeLessThanOrEqual(nav!.y);
    expect(shutter!.y + shutter!.height).toBeLessThanOrEqual(nav!.y);
    expect(nav!.y - (controls!.y + controls!.height)).toBeGreaterThanOrEqual(0);
    expect(nav!.y - (controls!.y + controls!.height)).toBeLessThanOrEqual(10);
    expect(camera!.height).toBeGreaterThan(height * 0.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.locator('.ref-nav').getByRole('button', { name: 'หน้าแรก', exact: true })).toBeVisible();
    await page.screenshot({ path: `${captures}/camera-${width}.png`, fullPage: true });
  }
});

test('weekly and catalog errors have direct retry and catalog query stays in place', async ({ page }) => {
  const attempts = await openApp(page);
  await page.locator('.ref-nav').getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  await expect(page.locator('.weekly-load-error')).toContainText('ยังโหลดไม่ได้');
  const before = attempts.weeklyAttempts();
  attempts.allowWeekly();
  await page.locator('.weekly-load-error').getByRole('button', { name: 'ลองโหลดอีกครั้ง' }).click();
  await expect(page.locator('.weekly-load-error')).toHaveCount(0);
  await expect.poll(attempts.weeklyAttempts).toBeGreaterThan(before);

  await page.locator('.ref-nav').getByRole('button', { name: 'บันทึก', exact: true }).click();
  const search = page.getByLabel('ค้นหาประวัติอาหาร');
  await search.fill('ข้าว');
  const retry = page.getByRole('button', { name: 'ลองค้นหาอีกครั้ง' });
  await expect(retry).toBeVisible();
  await retry.click();
  await expect(search).toHaveValue('ข้าว');
  await expect.poll(attempts.catalogAttempts).toBe(2);
  await expect(page.locator('.diary-catalog-error')).toHaveCount(0);
});

test('history loading does not show an empty state until the request completes', async ({ page }) => {
  let release!: () => void;
  let requested!: () => void;
  const wasRequested = new Promise<void>(resolve => { requested = resolve; });
  await openApp(page);
  await page.route('**/api/meals/history**', async route => {
    requested();
    await new Promise<void>(resolve => { release = resolve; });
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ meals: [], hasMore: false }) });
  });
  await page.locator('.ref-nav').getByRole('button', { name: 'บันทึก', exact: true }).click();
  await wasRequested;
  await expect(page.getByRole('status').filter({ hasText: 'กำลังโหลดประวัติอาหาร' })).toBeVisible();
  await expect(page.locator('.diary-empty')).toHaveCount(0);
  release();
  await expect(page.locator('.diary-empty')).toContainText('ยังไม่มีรายการอาหาร');
});

test('date fields expose editable native text on focus and restore the Thai display after blur', async ({ page }) => {
  const attempts = await openApp(page);
  attempts.allowWeekly();
  await page.locator('.ref-nav').getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  const input = page.getByLabel('สิ้นสุดวันที่', { exact: true });
  const formatted = page.locator('.weekly-date-control .meal-date-formatted');
  await expect(formatted).toBeVisible();
  await input.focus();
  await expect(formatted).toBeHidden();
  // Inputs animate color on focus; wait for the visible state instead of sampling its first frame.
  await expect(input).not.toHaveCSS('color', 'rgba(0, 0, 0, 0)');
  const previous = new Date(); previous.setDate(previous.getDate() - 1);
  const date = `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}-${String(previous.getDate()).padStart(2, '0')}`;
  await input.fill(date);
  await expect(input).toHaveValue(date);
  await expect.poll(attempts.weeklyAttempts).toBeGreaterThan(1);
  await input.blur();
  await expect(formatted).toBeVisible();
});

test('avatar upload and delete actions align and diary search remains readable', async ({ page }) => {
  await openApp(page);
  mkdirSync(captures, { recursive: true });
  await page.locator('.ref-nav').getByRole('button', { name: 'บัญชี', exact: true }).click();
  async function checkAlignment(scope: string) {
    const change = page.locator(`${scope} .profile-photo-actions label`);
    const remove = page.locator(`${scope} .profile-photo-actions button`).filter({ hasText: 'ลบรูป' });
    const [changeBox, removeBox] = await Promise.all([change.boundingBox(), remove.boundingBox()]);
    expect(Math.abs((changeBox!.y + changeBox!.height / 2) - (removeBox!.y + removeBox!.height / 2))).toBeLessThanOrEqual(1);
    expect(changeBox!.height).toBeGreaterThanOrEqual(44);
    expect(removeBox!.height).toBeGreaterThanOrEqual(44);
  }
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await checkAlignment('.ref-profile-card');
    await page.screenshot({ path: `${captures}/account-${width}.png`, fullPage: true });
  }
  await page.getByRole('button', { name: /ข้อมูลส่วนตัว/ }).click();
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await checkAlignment('.profile-form');
  }

  await page.locator('.ref-nav').getByRole('button', { name: 'บันทึก', exact: true }).click();
  const search = page.getByLabel('ค้นหาประวัติอาหาร');
  const colors = await search.evaluate(input => ({
    text: getComputedStyle(input).color,
    background: getComputedStyle(input).backgroundColor,
    placeholder: getComputedStyle(input, '::placeholder').color,
  }));
  expect(colors.text).toBe('rgb(25, 43, 32)');
  expect(colors.background).toBe('rgb(255, 255, 255)');
  expect(colors.placeholder).not.toBe('rgba(0, 0, 0, 0)');
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await search.focus();
    await expect(page.locator('.diary-search')).toHaveCSS('border-color', 'rgb(35, 131, 55)');
    await page.screenshot({ path: `${captures}/diary-${width}.png`, fullPage: true });
  }
  await expect(page.locator('.diary-day-selector')).toHaveCount(0);
  await expect(page.getByLabel('เลือกวันที่ดูประวัติ')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'ประวัติทั้งหมด', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
  await page.getByLabel('ค้นหาประวัติอาหาร').focus();
  await expect(page.locator('.diary-search')).toHaveCSS('border-color', 'rgb(35, 131, 55)');
  await expect(page.getByLabel('ค้นหาประวัติอาหาร')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
