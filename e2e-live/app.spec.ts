import { expect, test } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';

const account = {
  displayName: 'Live QA',
  email: `live-qa-${randomUUID()}@example.com`,
  password: 'ValidPassword123!',
};

test.describe.serial('live PostgreSQL account flow', () => {
  test('registers, updates profile, and restores it after reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'สมัครสมาชิก', exact: true }).click();
    await page.getByLabel('ชื่อที่ใช้แสดง').fill(account.displayName);
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByLabel('ยืนยันรหัสผ่าน').fill(account.password);
    await page.getByRole('button', { name: 'สร้างบัญชี →' }).click();
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
    await page.route('**/api/foods/estimate', route => route.fulfill({
      json: {
        ingredient: {
          name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual',
          referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0.1, proteinGrams: 3, fatGrams: 0.3 },
        },
      },
    }));
    await page.goto('/');
    await page.getByLabel('อีเมล').fill(account.email);
    await page.getByLabel('รหัสผ่าน', { exact: true }).fill(account.password);
    await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
    await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
    await page.getByLabel('ชื่ออาหาร').fill('Live QA meal');
    await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
    await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
    await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
    await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
    await expect(page.getByText('ข้าวสวย', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
    await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
    await expect(page.getByText('บันทึกอาหารแล้ว')).toBeVisible();

    await page.getByRole('button', { name: /กลับไปบันทึก/ }).click();
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    await expect(page.locator('.diary-meal-history')).toContainText('Live QA meal');
    await page.reload();
    await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
    await expect(page.locator('.diary-meal-history')).toContainText('Live QA meal');
  });

  test.afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const prisma = new PrismaClient();
    try { await prisma.user.deleteMany({ where: { email: account.email } }); }
    finally { await prisma.$disconnect(); }
  });
});
