import { expect, test, type Page } from '@playwright/test';

const user = { id: 'chunk-user', email: 'chunk@example.test', displayName: 'ผู้ใช้ทดสอบ', age: 30, weightKg: 70, heightCm: 170, bmi: 24, dailyCalorieTarget: 2000, goalSettings: null };

async function mockApplicationApi(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === '/api/auth/me' ? { user }
      : path === '/api/meals/daily' ? { meals: [] }
      : path === '/api/exercises/daily' ? { date: new Date().toISOString().slice(0, 10), exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 }
      : path === '/api/summary/weekly' ? { startDate: '2026-10-01', endDate: '2026-10-07', days: [], caloriesConsumed: 0, caloriesBurned: 0 }
      : { logs: [], foods: [] };
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

test('a missing MealPanel module offers deliberate recovery without a reload loop', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await mockApplicationApi(page);

  let failedMealModule = false;
  await page.route('**/assets/MealPanel-*.js', async route => {
    if (!failedMealModule) {
      failedMealModule = true;
      await route.abort('failed');
    } else {
      await route.continue();
    }
  });

  let navigations = 0;
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  await page.goto('/');
  await expect(page.locator('.ref-macro-row')).toHaveCount(3);
  await page.getByRole('button', { name: /เพิ่มรายการ/ }).click();

  await expect(page.getByRole('heading', { name: 'โหลดส่วนนี้ไม่สำเร็จ' })).toBeVisible();
  await expect(page.getByText('ไฟล์ส่วนนี้อาจโหลดไม่สำเร็จจากเครือข่าย')).toBeVisible();
  await expect(page.getByText('การโหลดใหม่อาจทำให้ข้อมูลที่ยังไม่ได้บันทึกหายไป')).toBeVisible();
  await expect(page.getByRole('button', { name: 'โหลดเวอร์ชันล่าสุด' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  await page.screenshot({ path: testInfo.outputPath('missing-chunk-mobile.png'), fullPage: true });
  await page.waitForTimeout(400);
  expect(navigations).toBe(1);

  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.locator('.mobile-nav [aria-current="page"]')).toContainText('บันทึก');
  await page.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'โหลดส่วนนี้ไม่สำเร็จ' })).toBeVisible();

  await page.getByRole('button', { name: 'โหลดเวอร์ชันล่าสุด' }).click();
  await expect(page.locator('.ref-macro-row')).toHaveCount(3);
  expect(navigations).toBe(2);
  await page.getByRole('button', { name: /เพิ่มรายการ/ }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกอาหาร' })).toBeVisible();
});

test('an unrelated MealPanel render error keeps generic recovery copy and warning', async ({ page }, testInfo) => {
  await mockApplicationApi(page);
  await page.route('**/assets/MealPanel-*.js', route => route.fulfill({
    status: 200,
    contentType: 'text/javascript',
    body: 'export function MealPanel() { throw new Error("Unrelated render fault"); }',
  }));

  await page.goto('/');
  await expect(page.locator('.ref-macro-row')).toHaveCount(3);
  await page.getByRole('button', { name: /เพิ่มรายการ/ }).click();

  await expect(page.getByRole('heading', { name: 'ส่วนนี้แสดงผลไม่ได้' })).toBeVisible();
  await expect(page.getByText('กรุณาลองโหลดหน้าใหม่อีกครั้ง')).toBeVisible();
  await expect(page.getByText('การโหลดใหม่อาจทำให้ข้อมูลที่ยังไม่ได้บันทึกหายไป')).toBeVisible();
  await expect(page.getByRole('button', { name: 'โหลดหน้าใหม่' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'โหลดเวอร์ชันล่าสุด' })).toHaveCount(0);
  await expect(page.getByText('เวอร์ชันของแอปในแท็บนี้อาจเก่าแล้ว')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('render-error-desktop.png'), fullPage: true });
});
