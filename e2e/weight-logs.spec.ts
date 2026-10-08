import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const initialUser = { id: 'weight-user', email: 'weight@example.com', displayName: 'ผู้ทดสอบน้ำหนัก', age: 30, weightKg: 68, heightCm: 165, bmi: 25, dailyCalorieTarget: 1900, targetWeightKg: 64, goalSettings: null };

async function openProgress(page: import('@playwright/test').Page) {
  let loggedIn = false;
  let user: { id: string; email: string; displayName: string; age: number; weightKg: number | null; heightCm: number; bmi: number | null; dailyCalorieTarget: number; targetWeightKg: number; goalSettings: null } = { ...initialUser };
  const now = new Date();
  const currentDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const logs: Array<{ id: string; date: string; weightKg: number; heightCm: number; bmi: number }> = [{ id: 'prior-today', date: currentDate, weightKg: 68, heightCm: 165, bmi: 25 }];
  let nextId = 0;
  await page.route('**/api/**', async route => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (pathname === '/api/auth/login') { loggedIn = true; return json({ user }); }
    if (pathname === '/api/weight-logs' && request.method() === 'GET') return json({ logs: [...logs].sort((a, b) => b.date.localeCompare(a.date)) });
    if (pathname === '/api/weight-logs' && request.method() === 'POST') {
      const body = request.postDataJSON() as { date: string; weightKg: number };
      if (body.weightKg === 72) return json({ message: 'save failed' }, 500);
      const log = { id: `weight-${++nextId}`, date: body.date, weightKg: body.weightKg, heightCm: 165, bmi: Math.round(body.weightKg / 1.65 ** 2 * 10) / 10 };
      logs.unshift(log); user = { ...user, weightKg: body.weightKg, bmi: log.bmi };
      return json({ log, user }, 201);
    }
    if (pathname.startsWith('/api/weight-logs/') && request.method() === 'PUT') {
      const id = pathname.split('/').at(-1)!; const body = request.postDataJSON() as { date: string; weightKg: number };
      const log = logs.find(item => item.id === id)!; Object.assign(log, { date: body.date, weightKg: body.weightKg, bmi: Math.round(body.weightKg / 1.65 ** 2 * 10) / 10 });
      user = { ...user, weightKg: body.weightKg, bmi: log.bmi };
      return json({ log, user });
    }
    if (pathname.startsWith('/api/weight-logs/') && request.method() === 'DELETE') {
      const id = pathname.split('/').at(-1)!; const index = logs.findIndex(item => item.id === id); if (index >= 0) logs.splice(index, 1);
      user = logs.length ? { ...user, weightKg: logs[0].weightKg, bmi: logs[0].bmi } : { ...user, weightKg: null, bmi: null };
      return json({ user, message: 'deleted' });
    }
    if (pathname === '/api/summary/weekly') return json({ startDate: '2026-10-01', endDate: '2026-10-07', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    return json({ message: `unexpected ${request.method()} ${pathname}` }, 404);
  });
  await page.goto('/');
  await page.getByLabel('อีเมล').fill(initialUser.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('WeightTest123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await page.getByRole('button', { name: 'ความคืบหน้า', exact: true }).click();
  return { currentDate };
}

test('weight logs save, edit, delete, update profile, and keep a failed draft', async ({ page }) => {
  const state = await openProgress(page);
  const screenshotDirectory = '.local/next-plan-ui-check-20261007';
  mkdirSync(screenshotDirectory, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const date = page.getByLabel('วันที่', { exact: true });
  const weight = page.getByLabel('น้ำหนัก (กก.)', { exact: true });
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก', exact: true }).click();
  await date.fill(state.currentDate);
  await weight.fill('70.5');
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'บันทึกน้ำหนักแล้ว' })).toBeVisible();
  await expect(page.locator('.ref-weight-log-list')).toContainText('70.5 กก.');
  await expect(page.locator('.ref-weight-form')).toHaveCount(0);
  await expect(page.locator('.ref-trend-chart svg')).toContainText('70.5 กก.');
  await page.screenshot({ path: `${screenshotDirectory}/weight-history-390.png`, fullPage: true });

  await page.getByRole('button', { name: /แก้ไขน้ำหนัก/ }).first().click();
  await page.screenshot({ path: `${screenshotDirectory}/weight-form-390.png`, fullPage: true });
  await weight.fill('71.2');
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await expect(page.locator('.ref-weight-log-list')).toContainText('71.2 กก.');
  await expect(page.locator('.ref-trend-stats')).toContainText('71.2 กก.');

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /ลบน้ำหนัก/ }).first().click();
  await expect(page.locator('.ref-weight-log-list')).toContainText('68 กก.');
  await expect(page.locator('.ref-trend-stats')).toContainText('68 กก.');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: /ลบน้ำหนัก/ }).first().click();
  await expect(page.getByText('ยังไม่มีรายการน้ำหนัก', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'บันทึกน้ำหนัก', exact: true }).click();
  await weight.fill('72');
  await page.getByRole('button', { name: 'บันทึกน้ำหนัก', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('save failed');
  await expect(weight).toHaveValue('72');
});
