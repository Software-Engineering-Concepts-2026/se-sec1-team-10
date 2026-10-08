import { expect, test, type Page, type Route } from '@playwright/test';
import type { PublicMeal, PublicUser } from '../src/shared/contracts';

const initialUser: PublicUser = {
  id: 'save-flow-user', email: 'save@example.com', displayName: 'ผู้ทดสอบ', age: 30,
  weightKg: 70, heightCm: 175, bmi: 22.9, dailyCalorieTarget: null,
  targetWeightKg: null, goalSettings: null, avatarImageData: null,
};
const nutrients = { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0.1, proteinGrams: 3, fatGrams: 0.3 };

async function setup(page: Page) {
  let user = structuredClone(initialUser);
  let meals: PublicMeal[] = [];
  let failMealSave = true;
  let savedMealBodies: unknown[] = [];
  let exerciseSaves = 0;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (path === '/api/auth/me' && method === 'GET') return json({ user: null }, 401);
    if (path === '/api/auth/login') return json({ user });
    if (path === '/api/auth/logout') return route.fulfill({ status: 204 });
    if (path === '/api/meals/history') return json({ meals, hasMore: false });
    if (path === '/api/meals/daily') return json({ date: '2026-10-07', meals: [], caloriesConsumed: 0 });
    if (path === '/api/foods/estimate') return json({ ingredient: { name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual', referenceNutrients: nutrients } });
    if (path === '/api/meals' && method === 'POST') {
      if (failMealSave) { failMealSave = false; return json({ message: 'บันทึกไม่สำเร็จ' }, 500); }
      const body = request.postDataJSON() as PublicMeal;
      savedMealBodies.push(body);
      const meal = { ...body, id: 'meal-1', totalCalories: 130, ingredients: body.ingredients.map(item => ({ ...item, ...nutrients })) };
      meals = [meal];
      return json({ meal }, 201);
    }
    if (path === '/api/meals/meal-1' && method === 'PUT') {
      const body = request.postDataJSON() as PublicMeal; savedMealBodies.push(body);
      meals = [{ ...body, id: 'meal-1', totalCalories: 130, ingredients: body.ingredients.map(item => ({ ...item, ...nutrients })) }];
      return json({ meal: meals[0] });
    }
    if (path === '/api/meals/meal-1' && method === 'DELETE') { meals = []; return route.fulfill({ status: 204 }); }
    if (path === '/api/exercises/daily') return json({ date: '2026-10-07', exercises: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    if (path === '/api/exercises' && method === 'POST') { exerciseSaves += 1; return json({ exercise: { id: 'exercise-1' } }, 201); }
    if (path === '/api/profile' && method === 'PUT') { user = { ...user, ...request.postDataJSON() } as PublicUser; return json({ user }); }
    if (path === '/api/profile/avatar' && method === 'PUT') { user = { ...user, avatarImageData: (request.postDataJSON() as { avatarImageData: string | null }).avatarImageData }; return json({ user }); }
    if (path === '/api/goals' && method === 'PUT') { user = { ...user, dailyCalorieTarget: 2638, targetWeightKg: 68 }; return json({ user }); }
    if (path === '/api/summary/weekly') return json({ startDate: '2026-10-01', endDate: '2026-10-07', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (path === '/api/health-history') return json({ points: [] });
    return json({ message: `unexpected ${method} ${path}` }, 404);
  });
  await page.goto('/');
  await page.getByLabel('อีเมล').fill(initialUser.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('ValidPassword123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await expect(page.getByRole('heading', { name: /สวัสดี/ })).toBeVisible();
  return { meals: () => meals, savedMealBodies: () => savedMealBodies, exerciseSaves: () => exerciseSaves };
}

async function openDiary(page: Page) {
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
}

async function fillMeal(page: Page, name = 'มื้อทดสอบ') {
  await page.getByRole('button', { name: /บันทึกอาหาร/ }).click();
  await page.getByLabel('ชื่ออาหาร').fill(name);
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await expect(page.getByText('ข้าวสวย', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
}

test('meal save failure keeps draft; success returns home; history edits and deletes saved meals', async ({ page }) => {
  const state = await setup(page);
  await openDiary(page);
  await fillMeal(page);
  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');
  await expect(page.getByLabel('ชื่ออาหาร')).toHaveValue('มื้อทดสอบ');
  await expect(page.getByText('ข้าวสวย', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'บันทึกอาหารแล้ว' })).toContainText('บันทึกอาหารแล้ว');
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อทดสอบ');
  expect(state.savedMealBodies()).toHaveLength(1);

  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
  await page.getByRole('button', { name: 'แก้ไข มื้อทดสอบ' }).click();
  await page.getByLabel('ชื่ออาหาร').fill('มื้อแก้ไข');
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'แก้ไขอาหารแล้ว' })).toContainText('แก้ไขอาหารแล้ว');
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อแก้ไข');
  expect(state.savedMealBodies()).toHaveLength(2);
  expect((state.savedMealBodies()[1] as { activityDate: string }).activityDate).toBe((state.savedMealBodies()[0] as { activityDate: string }).activityDate);

  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'ลบ มื้อแก้ไข' }).click();
  await expect(page.locator('.diary-empty')).toContainText('ยังไม่มีประวัติอาหาร');
  expect(state.meals()).toHaveLength(0);
});

test('exercise save returns to the Diary home with a success notice', async ({ page }) => {
  const state = await setup(page);
  await openDiary(page);
  await page.getByRole('button', { name: 'บันทึกกิจกรรม' }).click();
  await page.getByLabel('ระยะเวลา (นาที)').fill('45');
  await page.getByRole('button', { name: 'เพิ่มกิจกรรม', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'บันทึกกิจกรรมแล้ว' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ดูทั้งหมด', exact: true })).toBeVisible();
  expect(state.exerciseSaves()).toBe(1);
});

test('profile and goal saves return to account; saving only an avatar keeps the profile form open', async ({ page }) => {
  await setup(page);
  await page.getByRole('button', { name: 'บัญชี', exact: true }).click();
  await page.getByRole('button', { name: 'ข้อมูลส่วนตัว ข้อมูลพื้นฐานของคุณ' }).click();
  await page.getByLabel('ชื่อที่ใช้แสดง').fill('ชื่อใหม่');
  await page.getByRole('button', { name: 'บันทึกข้อมูลส่วนตัว →' }).click();
  await expect(page.getByRole('status')).toContainText('บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว');
  await expect(page.getByRole('button', { name: /เป้าหมายสุขภาพ ตั้งเป้าพลังงานและน้ำหนัก/ })).toBeVisible();

  await page.getByRole('button', { name: 'ข้อมูลส่วนตัว ข้อมูลพื้นฐานของคุณ' }).click();
  await page.getByLabel('ชื่อที่ใช้แสดง').fill('ยังไม่บันทึก');
  await page.getByLabel(/เพิ่มรูป|เปลี่ยนรูป/).last().setInputFiles({ name: 'profile.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'บันทึกรูป', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'ข้อมูลส่วนตัว', exact: true })).toBeVisible();
  await expect(page.getByLabel('ชื่อที่ใช้แสดง')).toHaveValue('ยังไม่บันทึก');

  await page.getByRole('button', { name: 'กลับ' }).click();
  await page.getByRole('button', { name: 'เป้าหมายสุขภาพ ตั้งเป้าพลังงานและน้ำหนัก' }).click();
  await page.getByLabel('เพศที่ใช้ในสูตรคำนวณ').selectOption('male');
  await page.getByLabel('น้ำหนักเป้าหมาย (กก.)').fill('68');
  await page.getByRole('button', { name: 'บันทึกเป้าหมาย', exact: true }).click();
  await expect(page.getByText('บันทึกเป้าหมายเรียบร้อยแล้ว', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ข้อมูลส่วนตัว ข้อมูลพื้นฐานของคุณ' })).toBeVisible();
});
