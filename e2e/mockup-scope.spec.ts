import { expect, test } from './coverage-fixture';
import { mkdirSync, writeFileSync } from 'node:fs';

test('four existing tabs stay usable across mobile and desktop and preserve reference scope', async ({ page }) => {
  const directory = process.env.UI_CAPTURE_DIR || '.local/mockup-refresh-20261008';
  mkdirSync(directory, { recursive: true });
  const date = new Date().toLocaleDateString('en-CA');
  const previousDay = new Date(); previousDay.setDate(previousDay.getDate() - 1);
  const user = { id: 'mockup-user', displayName: 'ผู้ทดสอบหน้าจอ', email: 'mockup@example.com', age: 30, weightKg: 68, heightCm: 165, bmi: 25, dailyCalorieTarget: 1900, targetWeightKg: 64, goalSettings: null };
  const meal = { id: 'long-meal', activityDate: date, mealType: 'lunch', name: 'ข้าวผัดผักรวมและอกไก่ชื่ออาหารยาวสำหรับตรวจการจัดวาง', imageData: null, totalCalories: 420, ingredients: [{ name: 'ข้าวสวย', amount: 180, unit: 'g', caloriesKcal: 420, carbsGrams: 60, proteinGrams: 30, fatGrams: 8 }] };
  await page.route('**/api/**', async route => {
    const { pathname, searchParams } = new URL(route.request().url());
    const json = (body: unknown) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(body) });
    if (pathname === '/api/auth/me') return json({ user });
    if (pathname === '/api/meals/daily') return json({ date: searchParams.get('date'), meals: [meal], caloriesConsumed: 420 });
    if (pathname === '/api/meals/history') return json({ meals: [meal], hasMore: false });
    if (pathname === '/api/exercises/daily') return json({ date: searchParams.get('date'), exercises: [], caloriesConsumed: 420, caloriesBurned: 120, netCalories: 300 });
    if (pathname === '/api/weight-logs') return json({ logs: [{ id: 'weight-1', date, weightKg: 68, heightCm: 165, bmi: 25 }, { id: 'weight-2', date: previousDay.toLocaleDateString('en-CA'), weightKg: 69, heightCm: 165, bmi: 25.3 }] });
    if (pathname === '/api/summary/weekly') return json({ startDate: date, endDate: date, days: [{ date, caloriesConsumed: 420, caloriesBurned: 120, netCalories: 300, mealCount: 1 }], caloriesConsumed: 420, caloriesBurned: 120 });
    return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"unexpected request"}' });
  });
  await page.goto('/');
  for (const width of [320, 360, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [index, tab] of ['หน้าแรก', 'บันทึก', 'ความคืบหน้า', 'บัญชี'].entries()) {
      if (process.env.UI_CAPTURE_TAB && process.env.UI_CAPTURE_TAB !== String(index + 1)) continue;
      await page.locator('.ref-nav').getByRole('button', { name: tab, exact: true }).click();
      if (tab === 'หน้าแรก') {
        await expect(page.locator('.ref-today-meals').getByText(meal.name, { exact: true })).toBeVisible();
        await expect(page.locator('.ref-macro-stack')).toContainText('60');
      } else if (tab === 'บันทึก') {
        await expect(page.locator('.diary-meal-history').getByText(meal.name, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: /ถ่ายภาพอาหาร/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /QR|barcode|สแกน/i })).toHaveCount(0);
        const reuse = page.getByRole('button', { name: /^บันทึกมื้อนี้อีกครั้ง:/ }).first();
        expect((await reuse.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        const row = page.locator('.diary-food-history-card').first();
        const rowBox = (await row.boundingBox())!;
        const thumbnail = (await row.locator('.diary-meal-image').boundingBox())!;
        expect(thumbnail.width).toBe(80);
        expect(thumbnail.height).toBe(thumbnail.width);
        expect(rowBox.height).toBeLessThanOrEqual(145);
        const reuseBox = (await reuse.boundingBox())!;
        const badge = (await row.locator('.diary-meal-badge').boundingBox())!;
        for (const action of await row.locator('.row-actions button').all()) {
          const box = (await action.boundingBox())!;
          expect(box.y).toBeGreaterThanOrEqual(reuseBox.y + reuseBox.height - 1);
          expect(box.x).toBeGreaterThanOrEqual(badge.x + badge.width);
          expect(box.x + box.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
          expect(box.height).toBeGreaterThanOrEqual(44);
        }
      } else if (tab === 'ความคืบหน้า') {
        await expect(page.getByRole('img', { name: 'กราฟน้ำหนักรายวัน' })).toBeVisible();
        await expect(page.getByRole('heading', { name: 'ข้อมูลเพิ่มเติม', exact: true })).toHaveCount(0);
        await expect(page.locator('.chart-key')).toContainText('เผาผลาญ');
        await expect(page.getByRole('button', { name: /ขยายกราฟ/ })).toHaveCount(0);
        for (const button of await page.locator('.ref-chart-controls button').all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      } else {
        await expect(page.getByRole('button', { name: /ข้อมูลส่วนตัว/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /เป้าหมายสุขภาพ/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /แจ้งเตือนมื้ออาหาร/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /ออกจากระบบ/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /^Settings$|^การตั้งค่า$/i })).toHaveCount(0);
      }
      if (process.env.UI_CAPTURE_BASELINE !== '1') {
        if (tab === 'หน้าแรก') {
          const [ring, macros] = await Promise.all([page.locator('.ref-intake-card').boundingBox(), page.locator('.ref-macro-stack').boundingBox()]);
          expect(macros!.x).toBeGreaterThanOrEqual(ring!.x + ring!.width - 2);
        } else if (tab === 'ความคืบหน้า') {
          const sections = ['.ref-trend-stats', '.ref-chart-tabs', '.ref-chart-ranges', '.ref-trend-chart', '.ref-weight-logs', '.ref-weekly'];
          const boxes = await Promise.all(sections.map(selector => page.locator(selector).boundingBox()));
          for (let i = 1; i < boxes.length; i++) {
            if (i === 2 && width >= 1024) continue; // Wide screens may place both graph controls on one row.
            if (i === 5 && width >= 1024) {
              const trend = (await page.locator('.ref-trend').boundingBox())!;
              expect(boxes[i]!.x).toBeGreaterThanOrEqual(trend.x + trend.width);
              expect(boxes[i]!.y).toBeCloseTo(trend.y, 0);
              continue;
            }
            expect(boxes[i]!.y).toBeGreaterThanOrEqual(boxes[i - 1]!.y + boxes[i - 1]!.height - 2);
          }
        } else if (tab === 'บัญชี') {
          await expect(page.locator('.ref-profile-metrics')).toHaveCount(0);
          await page.getByRole('button', { name: 'ดูข้อมูลโปรไฟล์', exact: true }).click();
          await expect(page.locator('.ref-profile-details')).toContainText('น้ำหนัก 68 กก.');
          await expect(page.locator('.ref-profile-details')).toContainText('ส่วนสูง 165 ซม.');
          await expect(page.locator('.ref-profile-details')).toContainText('BMI 25.0');
          await page.getByRole('button', { name: 'ซ่อนข้อมูลโปรไฟล์', exact: true }).click();
          await expect(page.locator('.ref-profile-details')).toHaveCount(0);
          const [profile, menu, logout] = await Promise.all(['.ref-profile-card', '.ref-menu', '.ref-logout-area'].map(selector => page.locator(selector).boundingBox()));
          if (width >= 1024) {
            expect(menu!.x).toBeGreaterThanOrEqual(profile!.x + profile!.width);
            expect(menu!.y).toBeCloseTo(profile!.y, 0);
            expect(logout!.x).toBeCloseTo(menu!.x, 0);
          } else {
            expect(menu!.y).toBeGreaterThanOrEqual(profile!.y + profile!.height);
          }
          expect(logout!.y).toBeGreaterThanOrEqual(menu!.y + menu!.height);
        }
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const tabs = page.locator('.ref-nav button');
      await expect(tabs).toHaveCount(4);
      for (const button of await tabs.all()) {
        const box = await button.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const text = (await button.textContent())!.trim();
        expect(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('button')?.textContent?.trim(), { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 })).toBe(text);
      }
      await page.screenshot({ path: `${directory}/${index + 1}-${width}.png`, fullPage: true });
      const geometry = await page.evaluate(() => Object.fromEntries(['.ref-today-summary', '.diary-action', '.diary-meal-row', '.ref-profile-card'].map(selector => {
        const elements = Array.from(document.querySelectorAll(selector)).filter(element => element.getBoundingClientRect().height > 0);
        return [selector, elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }))];
      })));
      writeFileSync(`${directory}/${index + 1}-${width}.json`, JSON.stringify(geometry, null, 2));
    }
  }
  if (process.env.UI_CAPTURE_BASELINE !== '1') {
    const nav = page.locator('.ref-nav');
    await nav.getByRole('button', { name: 'หน้าแรก', exact: true }).click();
    const active = nav.locator('[aria-current="page"]');
    expect(await active.evaluate(element => ({ style: getComputedStyle(element).outlineStyle, focusVisible: element.matches(':focus-visible') }))).toEqual({ style: 'none', focusVisible: false });
    await active.focus();
    await page.keyboard.press('Tab');
    const focused = nav.getByRole('button', { name: 'บันทึก', exact: true });
    await expect(focused).toBeFocused();
    expect(await focused.evaluate(element => element.matches(':focus-visible') && Number.parseFloat(getComputedStyle(element).outlineWidth) > 0)).toBe(true);
    await page.keyboard.press('Enter');
    await expect(focused).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'บันทึกอาหาร', exact: true })).toBeVisible();
    await page.screenshot({ path: `${directory}/keyboard-focus.png` });
  }
});
