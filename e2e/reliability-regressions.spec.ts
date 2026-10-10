import { expect, test, type Page } from './coverage-fixture';

const baseUser = { id: 'reliability', email: 'reliability@example.com', displayName: 'ผู้ใช้ทดสอบ', age: 30, weightKg: 70 as number | null, heightCm: 175, bmi: 22.9, dailyCalorieTarget: 1900, targetWeightKg: null, goalSettings: null };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };

async function login(page: Page, ingredients: Array<Record<string, unknown>> = []) {
  let currentUser = { ...baseUser };
  let loggedIn = false;
  let profileWrite: Record<string, unknown> | undefined;
  let failNextProfileWrite = false;
  let weightLogs: Array<{id:string;date:string;weightKg:number;heightCm:number;bmi:number}> = [];
  let exerciseWrite: { path: string; body: unknown } | undefined;
  let holdCurrent = false;
  let releaseCurrent: (() => void) | undefined;
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url());
    const json = (body: unknown, status=200) => route.fulfill({ status, contentType:'application/json', body:JSON.stringify(body) });
    if(url.pathname==='/api/auth/me') return loggedIn ? json({user:currentUser}) : json({message:'unauthorized'},401);
    if(url.pathname==='/api/auth/login') { loggedIn=true; return json({user:currentUser}); }
    if(url.pathname==='/api/profile' && request.method()==='PUT') { profileWrite=request.postDataJSON(); if(failNextProfileWrite) { failNextProfileWrite=false; return json({message:'save failed'},500); } currentUser={...currentUser,...profileWrite}; return json({user:currentUser}); }
    if(url.pathname==='/api/weight-logs' && request.method()==='POST') { const body=request.postDataJSON(); const log={id:'weight-new',date:body.date,weightKg:body.weightKg,heightCm:175,bmi:26.1}; weightLogs=[log]; currentUser={...currentUser,weightKg:body.weightKg,bmi:26.1}; return json({log,user:currentUser},201); }
    if(url.pathname==='/api/weight-logs' && request.method()==='GET') return json({logs:weightLogs});
    if(url.pathname.startsWith('/api/weight-logs/') && request.method()==='DELETE') { weightLogs=[]; currentUser={...currentUser,weightKg:null,bmi:null}; return json({user:currentUser}); }
    if(url.pathname==='/api/summary/weekly') return json({startDate:today(),endDate:today(),days:[],caloriesConsumed:420,caloriesBurned:80});
    if(url.pathname==='/api/meals/daily') return json({meals: ingredients.length ? [{id:'meal',name:'อาหารทดสอบ',activityDate:url.searchParams.get('date'),mealType:'lunch',imageData:null,totalCalories:420,ingredients}] : []});
    if(url.pathname==='/api/exercises/daily') {
      const date=url.searchParams.get('date')!;
      if(holdCurrent && date===today()) { holdCurrent=false; await new Promise<void>(resolve => { releaseCurrent=resolve; }); }
      const isCurrent=date===today();
      return json({date,exercises:[{id:isCurrent?'old-exercise':'new-exercise',activityType:'walking',durationMinutes:isCurrent?31:22,caloriesBurned:80,activityDate:date}],caloriesConsumed:420,caloriesBurned:80,netCalories:340});
    }
    if(url.pathname.startsWith('/api/exercises/') && request.method()==='PUT') { exerciseWrite={path:url.pathname,body:request.postDataJSON()}; return json({exercise:{}}); }
    if(url.pathname==='/api/meals/history') return json({meals:[],hasMore:false});
    return json({logs:[],foods:[]});
  });
  await page.goto('/'); await page.getByLabel('อีเมล').fill(baseUser.email); await page.getByLabel('รหัสผ่าน',{exact:true}).fill('AuditTest123!'); await page.getByRole('button',{name:'เข้าสู่ระบบ →'}).click();
  await expect(page.locator('.ref-macro-row')).toHaveCount(3);
  return {
    profileWrite: () => profileWrite,
    failNextProfileWrite: () => { failNextProfileWrite=true; },
    holdCurrent: () => { holdCurrent=true; },
    releaseCurrent: () => releaseCurrent?.(),
    currentHeld: () => Boolean(releaseCurrent),
    exerciseWrite: () => exerciseWrite,
  };
}

test('profile keeps unrelated draft and submits the latest weight; null weight clears stale value', async ({page}) => {
  const state=await login(page);
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await page.locator('.ref-menu button').filter({hasText:'ข้อมูลส่วนตัว'}).click();
  await page.getByLabel('ชื่อที่ใช้แสดง').fill('เปลี่ยนชื่อเท่านั้น');
  await page.locator('.profile-form input[name=weightKg]').fill('79');
  await page.getByRole('button',{name:'ความคืบหน้า',exact:true}).click();
  await page.getByRole('button',{name:'บันทึกน้ำหนัก',exact:true}).click();
  await page.locator('.ref-weight-form input[type=number]').fill('80');
  await page.getByRole('button',{name:'บันทึกน้ำหนัก',exact:true}).click();
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await expect(page.locator('.profile-form input[name=weightKg]')).toHaveValue('80');
  await expect(page.getByLabel('ชื่อที่ใช้แสดง')).toHaveValue('เปลี่ยนชื่อเท่านั้น');
  await page.getByRole('button',{name:'บันทึกข้อมูลส่วนตัว →',exact:true}).click();
  await expect.poll(()=>state.profileWrite()?.weightKg).toBe(80);

  await page.getByRole('button',{name:'ความคืบหน้า',exact:true}).click();
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button',{name:/ลบน้ำหนัก/}).click();
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await page.locator('.ref-menu button').filter({hasText:'ข้อมูลส่วนตัว'}).click();
  await expect(page.locator('.profile-form input[name=weightKg]')).toHaveValue('');
});

test('late activity response cannot replace the selected date or be edited onto it', async ({page}) => {
  const state=await login(page);
  await page.getByRole('button',{name:'บันทึก',exact:true}).click();
  state.holdCurrent(); await page.locator('.diary-action.activity').click();
  await expect.poll(state.currentHeld).toBe(true);
  const selected='2026-10-01'; await page.locator('.ref-exercise input[type=date]').fill(selected);
  await expect(page.locator('.exercise-list')).toContainText('22 นาที');
  const lateResponse = page.waitForResponse(response => response.url().includes(`/api/exercises/daily?date=${today()}`));
  state.releaseCurrent();
  await lateResponse;
  await expect(page.locator('.exercise-list')).toContainText('22 นาที');
  await expect(page.locator('.ref-exercise input[type=date]')).toHaveValue(selected);
  await page.locator('.exercise-list button[aria-label^="แก้ไข"]').click();
  await expect(page.getByRole('button',{name:'บันทึกการแก้ไข'})).toBeVisible();
  await page.locator('.ref-exercise input[type=date]').fill('2026-10-02');
  await expect(page.getByRole('button',{name:'เพิ่มกิจกรรม'})).toBeVisible();
  await expect(page.locator('.exercise-list')).toContainText('22 นาที');
  await page.locator('.exercise-list button[aria-label^="แก้ไข"]').click();
  await page.locator('.exercise-form input[type=number]').fill('45');
  await page.getByRole('button',{name:'บันทึกการแก้ไข'}).click();
  await expect.poll(state.exerciseWrite).toEqual({path:'/api/exercises/new-exercise',body:{activityType:'walking',durationMinutes:45,activityDate:'2026-10-02'}});
});

const ingredient = (carbsGrams: number|null, proteinGrams: number|null, fatGrams: number|null) => ({id:'i',name:'ส่วนประกอบ',amount:100,unit:'g',referenceAmount:100,referenceUnit:'g',source:'legacy',referenceNutrients:{caloriesKcal:420,carbsGrams,proteinGrams,fatGrams,sugarGrams:null},caloriesKcal:420,carbsGrams,proteinGrams,fatGrams,sugarGrams:null});

test('dashboard distinguishes fully missing, partial, known zero, and complete macro data', async ({page}) => {
  await login(page,[ingredient(null,null,null)]);
  for(const key of ['carbs','protein','fat']) {
    await expect(page.locator(`.ref-macro-row.ref-${key} strong`)).toContainText('—');
    await expect(page.locator(`.ref-macro-row.ref-${key}`)).toContainText('ข้อมูลไม่ครบ');
  }
  await expect(page.locator('.ref-macro-track[aria-label*="ไม่แสดงความคืบหน้า"]')).toHaveCount(3);
});

test('dashboard labels partial sums, preserves known zero, and shows complete positive proportions', async ({page}) => {
  await login(page,[ingredient(20,10,0),ingredient(null,null,null)]);
  await expect(page.locator('.ref-macro-row.ref-carbs')).toContainText('บางส่วน');
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toContainText('~20');
  await expect(page.locator('.ref-macro-row.ref-protein strong')).toContainText('~10');
  await expect(page.locator('.ref-macro-row.ref-fat strong')).toContainText('~0');
  await expect(page.locator('.ref-macro-track[aria-label*="ไม่แสดงความคืบหน้า"]')).toHaveCount(3);
});

test('dashboard displays known zero and full proportions when all nutrients are known', async ({page}) => {
  await login(page,[ingredient(20,30,0)]);
  await expect(page.locator('.ref-macro-row.ref-carbs strong')).toContainText('20');
  await expect(page.locator('.ref-macro-row.ref-protein strong')).toContainText('30');
  await expect(page.locator('.ref-macro-row.ref-fat strong')).toContainText('0');
  await expect(page.locator('.ref-macro-track[aria-label*="ไม่แสดงความคืบหน้า"]')).toHaveCount(0);
  await expect(page.locator('.ref-macro-row.ref-carbs .ref-macro-track span')).not.toHaveAttribute('style','width: 0%;');
});

test('dashboard treats no meals as known zero macros', async ({page}) => {
  await login(page,[]);
  for(const key of ['carbs','protein','fat']) await expect(page.locator(`.ref-macro-row.ref-${key} strong`)).toContainText('0');
  await expect(page.locator('.ref-macro-track[aria-label*="จากเป้าหมายประมาณ"][aria-label*="0 เปอร์เซ็นต์"]')).toHaveCount(3);
});

test('profile keeps an intentional weight draft after a failed save and resets it on reopen', async ({page}) => {
  const state=await login(page);
  await page.getByRole('button',{name:'บัญชี',exact:true}).click();
  await page.locator('.ref-menu button').filter({hasText:'ข้อมูลส่วนตัว'}).click();
  await page.locator('.profile-form input[name=weightKg]').fill('79');
  state.failNextProfileWrite();
  await page.getByRole('button',{name:'บันทึกข้อมูลส่วนตัว →',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('save failed');
  await expect(page.locator('.profile-form input[name=weightKg]')).toHaveValue('79');
  await page.getByRole('button',{name:'กลับ'}).click();
  await page.locator('.ref-menu button').filter({hasText:'ข้อมูลส่วนตัว'}).click();
  await expect(page.locator('.profile-form input[name=weightKg]')).toHaveValue('70');
});

test('activity load failure stops loading and a failed edit keeps its draft', async ({ page }) => {
  await login(page);
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click();
  await page.locator('.diary-action.activity').click();
  await expect(page.locator('.exercise-list')).toContainText('31 นาที');
  await page.locator('.exercise-list button[aria-label^="แก้ไข"]').click();
  await page.locator('.exercise-form input[type=number]').fill('45');
  await page.route('**/api/exercises/old-exercise', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'บันทึกไม่สำเร็จ' }) }));
  await page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ');
  await expect(page.locator('.exercise-form input[type=number]')).toHaveValue('45');
  await expect(page.getByRole('button', { name: 'บันทึกการแก้ไข', exact: true })).toBeEnabled();
  await page.route('**/api/exercises/daily?date=2026-10-03', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'โหลดไม่สำเร็จ' }) }));
  await page.locator('.ref-exercise input[type=date]').fill('2026-10-03');
  await expect(page.getByRole('alert')).toContainText('โหลดไม่สำเร็จ');
  await expect(page.locator('.ref-exercise')).toContainText('ยังแสดงสรุปพลังงานของวันที่เลือกไม่ได้');
  await expect(page.locator('.ref-exercise [role=status]')).toHaveCount(0);
  await expect(page.locator('.exercise-list')).not.toContainText('31 นาที');
});
