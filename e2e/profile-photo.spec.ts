import { expect, test, type Page, type Route } from '@playwright/test';

const user = { id: 'photo-user', email: 'photo@example.com', displayName: 'ผู้ทดสอบ', age: null, weightKg: null, heightCm: null, bmi: null, avatarImageData: null };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

async function setup(page: Page) {
  let loggedIn = false;
  let avatar: string | null = null;
  let failNextSave = false;
  let heldSave: Promise<void> | undefined;
  let releaseSave: (() => void) | undefined;
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const currentUser = { ...user, avatarImageData: avatar };
    if (path === '/api/auth/me' && method === 'GET') return loggedIn ? json({ user: currentUser }) : json({ message: 'unauthorized' }, 401);
    if (path === '/api/auth/login' && method === 'POST') { loggedIn = true; return json({ user: currentUser }); }
    if (path === '/api/auth/logout' && method === 'POST') { loggedIn = false; return route.fulfill({ status: 204 }); }
    if (path === '/api/profile/avatar' && method === 'PUT') {
      if (heldSave) await heldSave;
      if (failNextSave) { failNextSave = false; return json({ message: 'บันทึกไม่สำเร็จ' }, 500); }
      avatar = (request.postDataJSON() as { avatarImageData: string | null }).avatarImageData;
      return json({ user: { ...user, avatarImageData: avatar } });
    }
    if (path === '/api/exercises/daily' || path === '/api/meals/daily') return json({ date: new URL(request.url()).searchParams.get('date'), exercises: [], meals: [], caloriesConsumed: 0, caloriesBurned: 0, netCalories: 0 });
    if (path === '/api/summary/weekly') return json({ startDate: '2026-10-05', endDate: '2026-10-11', days: [], caloriesConsumed: 0, caloriesBurned: 0 });
    if (path === '/api/health-history') return json({ points: [], rangeDays: 365, performanceTargetMs: 1500 });
    return json({ message: `unmocked ${method} ${path}` }, 404);
  });
  await page.goto('/');
  await page.getByLabel('อีเมล').fill(user.email);
  await page.getByLabel('รหัสผ่าน', { exact: true }).fill('ValidPassword123!');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ →' }).click();
  await page.getByRole('button', { name: 'เปิดบัญชีของคุณ' }).click();
  return { get avatar() { return avatar; }, failSave() { failNextSave = true; }, holdSave() { heldSave = new Promise<void>(resolve => { releaseSave = resolve; }); }, releaseSave() { releaseSave?.(); heldSave = undefined; } };
}

async function selectImage(page: Page, name = 'profile.png', type = 'image/png', buffer = png) {
  await page.getByLabel(/เพิ่มรูป|เปลี่ยนรูป/).last().setInputFiles({ name, mimeType: type, buffer });
}

async function coloredPng(page: Page, color: string) {
  const dataUrl = await page.evaluate(colorValue => {
    const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 24;
    const context = canvas.getContext('2d')!; context.fillStyle = colorValue; context.fillRect(0, 0, 32, 24);
    return canvas.toDataURL('image/png');
  }, color);
  return Buffer.from(dataUrl.split(',')[1], 'base64');
}

test('saves avatar, restores it after reload, changes it, and removes it', async ({ page }) => {
  const state = await setup(page);
  await selectImage(page);
  await expect(page.getByRole('button', { name: 'บันทึกรูป' }).last()).toBeEnabled();
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  await expect.poll(() => state.avatar).toMatch(/^data:image\/jpeg;base64,/);
  const firstAvatar = state.avatar;
  await page.reload();
  await expect(page.getByRole('button', { name: 'เปิดบัญชีของคุณ' }).locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'เปิดบัญชีของคุณ' }).click();
  await selectImage(page, 'changed.png', 'image/png', await coloredPng(page, '#08a050'));
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  const changed = state.avatar;
  expect(changed).toMatch(/^data:image\/jpeg;base64,/);
  expect(changed).not.toBe(firstAvatar);
  await page.getByRole('button', { name: 'ลบรูป' }).first().click();
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  await expect.poll(() => state.avatar).toBeNull();
});

test('rejects invalid files, keeps a draft after failure, and allows retry', async ({ page }) => {
  const state = await setup(page);
  await selectImage(page, 'invalid.gif', 'image/gif', png);
  await expect(page.getByText('เลือกรูป JPG, PNG หรือ WEBP เท่านั้น')).toBeVisible();
  await selectImage(page, 'corrupt.png', 'image/png', Buffer.from('not an image'));
  await expect(page.getByText('ไฟล์รูปไม่ถูกต้อง')).toBeVisible();
  await selectImage(page);
  state.failSave();
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  await expect(page.getByText('บันทึกไม่สำเร็จ')).toBeVisible();
  await expect(page.getByRole('button', { name: 'บันทึกรูป' }).last()).toBeVisible();
  await expect(page.locator('.profile-avatar img').last()).toBeVisible();
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  await expect.poll(() => state.avatar).toMatch(/^data:image\/jpeg;base64,/);
  await page.reload();
  await expect(page.getByRole('button', { name: 'เปิดบัญชีของคุณ' }).locator('img')).toBeVisible();
  await page.getByRole('button', { name: 'เปิดบัญชีของคุณ' }).click();
  await page.getByRole('button', { name: 'ลบรูป' }).first().click();
  await page.getByRole('button', { name: 'บันทึกรูป' }).last().click();
  await expect.poll(() => state.avatar).toBeNull();
});

test('prevents profile saves and logout while a photo save is pending', async ({ page }) => {
  const state = await setup(page);
  await selectImage(page);
  state.holdSave();
  await page.getByRole('button', { name: 'บันทึกรูป', exact: true }).click();
  await expect(page.getByRole('button', { name: 'ออกจากระบบ ↗' })).toBeDisabled();
  await page.getByRole('button', { name: 'ข้อมูลส่วนตัว ข้อมูลพื้นฐานของคุณ' }).click();
  const profileSave = page.locator('.profile-form form button[type="submit"]');
  await expect(profileSave).toBeDisabled();
  state.releaseSave();
  await expect.poll(() => state.avatar).toMatch(/^data:image\/jpeg;base64,/);
  await expect(profileSave).toBeEnabled();
});
