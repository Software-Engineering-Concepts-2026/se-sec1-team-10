import { expect, test, type Page, type Route } from '@playwright/test';
import type { PublicMeal, PublicUser } from '../src/shared/contracts';

const user: PublicUser = { id: 'history-user', email: 'history@example.com', displayName: 'ทดสอบประวัติ', age: 30, weightKg: 70, heightCm: 175, bmi: 22.9, dailyCalorieTarget: 1900, targetWeightKg: null, goalSettings: null };
const nutrientValues = { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0.1, proteinGrams: 3, fatGrams: 0.3 };
const dateAt = (daysAgo: number) => { const date = new Date(); date.setDate(date.getDate() - daysAgo); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const meal = (id: string, name: string, activityDate: string): PublicMeal => ({ id, name, activityDate, mealType: 'dinner', imageData: null, totalCalories: 130, ingredients: [{ id: `${id}-i`, name: 'ข้าวสวย', amount: 100, unit: 'g', source: 'manual', referenceAmount: 100, referenceUnit: 'g', referenceNutrients: nutrientValues, ...nutrientValues }] });

async function setup(page: Page) {
  const today = dateAt(0);
  const yesterday = dateAt(1);
  let loggedIn = false;
  let meals: PublicMeal[] = [meal('yesterday-meal', 'มื้อเมื่อวาน', yesterday)];
  let mealId = 0;
  const mealWrites: Array<{ method: string; activityDate: string; name: string }> = [];
  const legacyMeals = Array.from({ length: 21 }, (_, index) => meal(`legacy-${index + 1}`, `รายการเก่า ${index + 1}`, today));
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const { pathname, searchParams } = new URL(request.url());
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return loggedIn ? json({ user }) : json({ message: 'unauthorized' }, 401);
    if (pathname === '/api/auth/login') { loggedIn = true; return json({ user }); }
    if (pathname === '/api/meals/history' && method === 'GET') {
      const offset = Number(searchParams.get('offset') ?? 0);
      const query = (searchParams.get('q') ?? '').toLocaleLowerCase();
      const matching = [...meals, ...legacyMeals].filter(item => item.name.toLocaleLowerCase().includes(query));
      return json({ meals: matching.slice(offset, offset + 20), hasMore: offset + 20 < matching.length });
    }
    if (pathname === '/api/foods/estimate') return json({ ingredient: { name: 'ข้าวสวย', amount: 100, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'manual', referenceNutrients: nutrientValues } });
    if (pathname === '/api/meals' && method === 'POST') {
      const body = request.postDataJSON() as Omit<PublicMeal, 'id' | 'totalCalories'>;
      mealWrites.push({ method, activityDate: body.activityDate, name: body.name });
      const saved = { ...body, id: `meal-${++mealId}`, totalCalories: 130 } as PublicMeal; meals = [saved, ...meals]; return json({ meal: saved }, 201);
    }
    const mealMatch = pathname.match(/^\/api\/meals\/([^/]+)$/);
    if (mealMatch && method === 'PUT') {
      const body = request.postDataJSON() as Omit<PublicMeal, 'id' | 'totalCalories'>;
      mealWrites.push({ method, activityDate: body.activityDate, name: body.name });
      const saved = { ...body, id: mealMatch[1], totalCalories: 130 } as PublicMeal; meals = meals.map(item => item.id === mealMatch[1] ? saved : item); return json({ meal: saved });
    }
    if (mealMatch && method === 'DELETE') { meals = meals.filter(item => item.id !== mealMatch[1]); return route.fulfill({ status: 204 }); }
    return json({ message: `unexpected ${method} ${pathname}` }, 404);
  });
  await page.goto('/');
  await page.getByLabel('อีเมล').fill(user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('DiaryTest123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
  return { today, yesterday, mealWrites, meals: () => meals, legacyMeals };
}

test('full history paginates and search finds older meals', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
  await expect(page.locator('.diary-meal-history')).toContainText('รายการเก่า 19');
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อเมื่อวาน');
  await page.getByRole('button', { name: 'ดูประวัติเพิ่ม', exact: true }).click();
  await expect(page.locator('.diary-meal-history')).toContainText('รายการเก่า 21');
  await page.getByLabel('ค้นหาประวัติอาหาร').fill('มื้อเมื่อวาน');
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อเมื่อวาน');
  await expect(page.locator('.diary-meal-history')).not.toContainText('รายการเก่า');
  expect(state.legacyMeals).toHaveLength(21);
});

test('historical edit keeps its date, reuse uses the selected form date, and manual entry honors date changes', async ({ page }) => {
  const state = await setup(page);
  await page.getByRole('button', { name: 'ดูทั้งหมด', exact: true }).click();
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อเมื่อวาน');
  await page.getByRole('button', { name: 'แก้ไข มื้อเมื่อวาน' }).click();
  await expect(page.getByLabel('วันที่', { exact: true })).toHaveValue(state.yesterday);
  await page.getByLabel('ชื่ออาหาร').fill('มื้อเมื่อวานที่แก้ไข');
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อเมื่อวานที่แก้ไข');
  await page.getByRole('button', { name: 'บันทึกมื้อนี้อีกครั้ง: มื้อเมื่อวานที่แก้ไข' }).click();
  await expect(page.getByLabel('วันที่', { exact: true })).toHaveValue(state.today);
  await page.getByLabel('ชื่ออาหาร').fill('มื้อที่นำกลับมาใช้');
  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  await expect(page.locator('.diary-meal-history')).toContainText('มื้อที่นำกลับมาใช้');
  await page.getByRole('button', { name: 'เสร็จสิ้น', exact: true }).click();
  await page.locator('.diary-action.food').click();
  await page.getByLabel('วันที่', { exact: true }).fill(state.yesterday);
  await page.getByLabel('ชื่ออาหาร').fill('มื้อวันที่เลือก');
  await page.getByRole('button', { name: 'เพิ่มส่วนประกอบ', exact: true }).click();
  await page.getByLabel('ชื่อส่วนประกอบ').fill('ข้าวสวย');
  await page.getByLabel('ปริมาณที่เพิ่ม (กรัม)').fill('100');
  await page.getByRole('button', { name: 'ประมาณและเพิ่มส่วนประกอบ' }).click();
  await expect(page.getByText('ข้าวสวย', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'คำนวณสารอาหารใหม่' }).click();
  await page.getByRole('button', { name: 'บันทึกข้อมูล', exact: true }).click();
  expect(state.mealWrites.map(write => write.activityDate)).toEqual([state.yesterday, state.today, state.yesterday]);
  expect(state.meals().find(item => item.name === 'มื้อเมื่อวานที่แก้ไข')?.activityDate).toBe(state.yesterday);
});
