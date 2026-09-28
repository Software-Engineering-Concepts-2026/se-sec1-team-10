import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const account = {
  displayName: 'Live QA',
  email: `live-qa-${randomUUID()}@example.com`,
  password: 'ValidPassword123!',
};

test.describe.serial('live PostgreSQL application flow', () => {
  test('registers, saves profile and persists a meal across reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByLabel('ชื่อที่ใช้แสดง').fill(account.displayName);
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByLabel('ยืนยันรหัสผ่าน').fill(account.password);
    await page.getByRole('button', { name: /สร้างบัญชี/ }).click();
    await expect(page.getByText(/สมัครสมาชิกสำเร็จ/)).toBeVisible();

    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();

    await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
    await page.getByLabel('อายุ (ปี)').fill('30');
    await page.getByLabel('น้ำหนัก (กก.)').fill('70');
    await page.getByLabel('ส่วนสูง (ซม.)').fill('175');
    await page.getByRole('button', { name: /บันทึกข้อมูลส่วนตัว/ }).click();
    await expect(page.getByText(/บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว/)).toBeVisible();

    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('tab', { name: 'อาหาร', exact: true }).click();
    await page.getByRole('button', { name: 'กรอกสารอาหารเอง' }).click();
    await page.getByLabel('ชื่ออาหาร').fill('Live QA meal');
    await page.getByLabel('ชื่อส่วนประกอบ 1', { exact: true }).fill('Rice');
    await page.getByLabel('carbsGrams 1', { exact: true }).fill('50');
    await page.getByLabel('proteinGrams 1', { exact: true }).fill('25');
    await page.getByLabel('fatGrams 1', { exact: true }).fill('10');
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.locator('.meal-list article').filter({ hasText: 'Live QA meal' })).toBeVisible();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();

    await page.reload();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('tab', { name: 'อาหาร', exact: true }).click();
    await expect(page.locator('.meal-list article').filter({ hasText: 'Live QA meal' })).toBeVisible();
    await expect(page.locator('.meal-list')).toContainText('390 kcal');
    await page.screenshot({ path: 'test-results/live-food.png', fullPage: true });
  });

  test('edits, deletes, and updates daily totals through the live API', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('tab', { name: 'อาหาร', exact: true }).click();
    await page.getByRole('button', { name: 'แก้ไข', exact: true }).click();
    await page.getByLabel('ชื่ออาหาร').fill('Live QA meal edited');
    await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
    await expect(page.locator('.meal-list article').filter({ hasText: 'Live QA meal edited' })).toBeVisible();
    await expect(page.getByText('แก้ไขอาหารแล้ว')).toBeVisible();
    await page.locator('.meal-list article').getByRole('button', { name: 'ลบ', exact: true }).click();
    await expect(page.getByText('ลบรายการอาหารแล้ว')).toBeVisible();
    await expect(page.getByText('ยังไม่มีรายการอาหารในวันนี้')).toBeVisible();
    await page.getByRole('button', { name: 'วันนี้', exact: true }).click();
    await expect(page.locator('.energy-ring strong')).toHaveText('0');
    await page.screenshot({ path: 'test-results/live-today.png', fullPage: true });
  });

  test.afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = new PrismaClient();
    try { await prisma.user.deleteMany({ where: { email: account.email } }); }
    finally { await prisma.$disconnect(); }
  });
});
