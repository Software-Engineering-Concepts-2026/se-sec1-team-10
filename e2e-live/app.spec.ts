import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const account = {
  displayName: 'Live QA',
  email: `live-qa-${randomUUID()}@example.com`,
  password: 'ValidPassword123!',
};
const mealName = `Live QA meal ${randomUUID().slice(0, 8)}`;
let registrationCreated = false;
const uploadImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
let apiFailures: string[] = [];
let pageErrors: string[] = [];

test.describe.serial('live PostgreSQL account flow', () => {
  test.beforeEach(async ({ page }) => {
    apiFailures = [];
    pageErrors = [];
    page.on('response', response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith('/api/') && response.status() >= 500) apiFailures.push(`${response.status()} ${url.pathname}`);
    });
    page.on('pageerror', error => pageErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(apiFailures, `API 5xx responses: ${apiFailures.join(', ')}`).toEqual([]);
    expect(pageErrors, `Browser page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('registers, updates profile, and restores it after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByLabel('ชื่อที่ใช้แสดง').fill(account.displayName);
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByLabel('ยืนยันรหัสผ่าน').fill(account.password);
    const registrationResponse = page.waitForResponse(response => response.url().includes('/api/auth/register') && response.status() === 201);
    await page.getByRole('button', { name: 'สร้างบัญชี →' }).click();
    await registrationResponse;
    registrationCreated = true;
    await expect(page.getByText(/สมัครสมาชิกสำเร็จ/)).toBeVisible();

    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();

    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByRole('button', { name: 'ข้อมูลส่วนตัว' }).click();
    await page.getByLabel('อายุ (ปี)').fill('30');
    await page.getByLabel('น้ำหนัก (กก.)').fill('70');
    await page.getByLabel('ส่วนสูง (ซม.)').fill('175');
    await page.getByRole('button', { name: /บันทึกข้อมูลส่วนตัว/ }).click();
    await expect(page.getByText('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByRole('button', { name: 'ข้อมูลส่วนตัว' }).click();
    await expect(page.getByLabel('อายุ (ปี)')).toHaveValue('30');
    await expect(page.getByLabel('น้ำหนัก (กก.)')).toHaveValue('70');
    await expect(page.getByLabel('ส่วนสูง (ซม.)')).toHaveValue('175');
  });

  test('saves a manual meal and restores it from PostgreSQL after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
    await expect(page.getByLabel('ชื่ออาหาร')).toBeVisible();
    await page.getByLabel('ชื่ออาหาร').fill(mealName);
    await page.locator('#meal-upload').setInputFiles({ name: 'meal-image.png', mimeType: 'image/png', buffer: uploadImage });
    await expect(page.getByAltText('ตัวอย่างรูปอาหาร')).toBeVisible();
    await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
    await page.getByRole('button', { name: 'ค้นหาจากฐานข้อมูลอาหาร', exact: true }).click();
    await page.getByLabel('ค้นหาอาหาร').fill('rice');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    const foodResults = page.locator('.food-results');
    await expect(foodResults.locator('button').first()).toBeVisible({ timeout: 30_000 });
    await foodResults.locator('xpath=..').getByLabel('ปริมาณ (ก.)').fill('100');
    const catalogFood = foodResults.locator('button').first();
    const foodLabel = (await catalogFood.innerText()).split('\n')[0];
    await catalogFood.click();
    await expect(page.getByText(foodLabel, { exact: true })).toBeVisible();

    // Add a second real catalog ingredient, then remove it to cover both edits.
    await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
    await page.getByRole('button', { name: 'ค้นหาจากฐานข้อมูลอาหาร', exact: true }).click();
    await page.getByLabel('ค้นหาอาหาร').fill('rice');
    await page.getByRole('button', { name: 'ค้นหา', exact: true }).click();
    await expect(foodResults.locator('button').first()).toBeVisible({ timeout: 30_000 });
    await foodResults.locator('xpath=..').getByLabel('ปริมาณ (ก.)').fill('50');
    await foodResults.locator('button').first().click();
    await expect(page.locator('.ingredient-row')).toHaveCount(2);
    await page.getByRole('button', { name: `ลบ ${foodLabel}` }).last().click();
    await expect(page.locator('.ingredient-row')).toHaveCount(1);

    const amount = page.getByLabel('ปริมาณส่วนประกอบ 1');
    await amount.fill('150');
    await expect(page.getByRole('status').filter({ hasText: 'ข้อมูลเปลี่ยนแล้ว' })).toBeVisible();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await expect(amount).toHaveValue('150');
    const expectedCalories = Math.round(Number(await page.locator('.meal-total-calories strong').innerText()));
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();

    const prisma = new PrismaClient();
    try {
      const saved = await prisma.mealLog.findFirst({
        where: { user: { email: account.email }, name: mealName },
        select: { totalCalories: true, imageData: true, ingredients: { select: { amount: true, source: true } } },
      });
      expect(saved).not.toBeNull();
      expect(saved?.totalCalories).toBe(expectedCalories);
      expect(saved?.imageData).toMatch(/^data:image\//);
      expect(saved?.ingredients).toEqual([{ amount: 150, source: 'food-catalog' }]);
    } finally { await prisma.$disconnect(); }

    await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    const historyRow = page.locator('.diary-meal-row').filter({ hasText: mealName });
    await expect(historyRow).toBeVisible();
    await expect(historyRow.locator('img')).toHaveCount(1);
    await expect(historyRow).toContainText('150 กรัม');
    await page.reload();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    const restored = page.locator('.diary-meal-row').filter({ hasText: mealName });
    await expect(restored).toBeVisible();
    await expect(restored.locator('img')).toHaveCount(1);
    await restored.getByRole('button', { name: `บันทึกมื้อนี้อีกครั้ง: ${mealName}` }).click();
    await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue(mealName);
    await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('150');
    await expect(page.getByAltText('ตัวอย่างรูปอาหาร')).toBeVisible();
    await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
  });

  test.afterAll(async () => {
    if (!registrationCreated || !process.env.DATABASE_URL) return;
    const prisma = new PrismaClient();
    try {
      const ownAccount = await prisma.user.findUnique({ where: { email: account.email }, select: { id: true, email: true } });
      if (ownAccount?.email === account.email) await prisma.user.delete({ where: { id: ownAccount.id } });
    }
    finally { await prisma.$disconnect(); }
  });
});
