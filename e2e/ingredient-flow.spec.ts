import { test, expect } from '@playwright/test';

for (const width of [320, 390]) test(`ingredient lifecycle at ${width}px without nested form submission`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  let saved: any = null;
  let creates = 0;
  let updates = 0;
  let fail = true;
  await page.route('**/api/**', async route => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const reply = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === '/api/auth/me') return reply({ user: { id: 'test', displayName: 'Tester', email: 'test@example.test', bmi: null } });
    if (path === '/api/foods/estimate') {
      if (fail) { fail = false; return reply({ message: 'ประมาณสารอาหารไม่สำเร็จ' }, 502); }
      const { name, amount } = req.postDataJSON();
      return reply({ ingredient: { name, amount, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'ai-estimate', referenceNutrients: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 } } });
    }
    if (path === '/api/meals/daily') return reply({ meals: saved ? [saved] : [], caloriesConsumed: saved?.totalCalories ?? 0 });
    if ((path === '/api/meals' && req.method() === 'POST') || (path === '/api/meals/m1' && req.method() === 'PUT')) {
      req.method() === 'POST' ? creates++ : updates++;
      const body = req.postDataJSON();
      saved = { ...body, id: 'm1', totalCalories: body.ingredients.reduce((n: number, i: any) => n + i.referenceNutrients.caloriesKcal * i.amount / i.referenceAmount, 0) };
      return reply({ meal: saved });
    }
    if (path === '/api/exercises/daily') return reply({ exercises: [], caloriesConsumed: 0, caloriesBurned: 0 });
    return reply({ meals: [], points: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByLabel('ชื่ออาหาร', { exact: true }).fill('ข้าวทดสอบ');
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await expect(page.locator('form form')).toHaveCount(0);
  await page.getByLabel('ชื่อส่วนประกอบ', { exact: true }).fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('200');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await expect(page.getByRole('alert')).toContainText('ประมาณสารอาหารไม่สำเร็จ');
  await expect(page.getByLabel('ชื่อส่วนประกอบ', { exact: true })).toHaveValue('ข้าวสวย');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('200');
  expect(creates).toBe(0);
  expect(new URL(page.url()).search).toBe('');
  await expect(page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await expect(page.getByRole('region', { name: 'สรุปโภชนาการมื้ออาหาร' })).toContainText('260');
  await page.getByLabel('ปริมาณส่วนประกอบ 1').fill('100');
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await expect(page.getByRole('region', { name: 'สรุปโภชนาการมื้ออาหาร' })).toContainText('130');
  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  await expect(page.getByRole('button', { name: 'แก้ไข', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.getByRole('button', { name: 'แก้ไข', exact: true }).click();
  await expect(page.getByLabel('ปริมาณส่วนประกอบ 1')).toHaveValue('100');
  await page.getByRole('button', { name: 'ลบ ข้าวสวย', exact: true }).click();
  await expect(page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ', { exact: true }).fill('ไก่ต้ม');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('150');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await expect(page.getByRole('button', { name: 'แก้ไข', exact: true })).toBeVisible();
  expect(creates).toBe(1);
  expect(updates).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
