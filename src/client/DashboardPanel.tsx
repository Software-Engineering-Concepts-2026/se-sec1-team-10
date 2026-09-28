import { useEffect, useState } from 'react';
import type { PublicMeal, PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';

type DailySummary = { caloriesConsumed: number; caloriesBurned: number; netCalories: number };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function DashboardPanel({ user }: { user: PublicUser }) {
  const [date, setDate] = useState(today);
  const [data, setData] = useState<{ daily: DailySummary; meals: PublicMeal[] } | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      try {
        const [daily, meals] = await Promise.all([
          api<DailySummary>(`/exercises/daily?date=${date}`),
          api<{ meals: PublicMeal[] }>(`/meals/daily?date=${date}`),
        ]);
        if (active && request === sequence) { setData({ daily, meals: meals.meals }); setError(''); }
      } catch (e) { if (active && request === sequence) setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่ได้'); }
    };
    setData(null); void refresh();
    const updated = () => { void refresh(); };
    window.addEventListener('daily-calories-updated', updated);
    return () => { active = false; window.removeEventListener('daily-calories-updated', updated); };
  }, [date]);
  const target = user.dailyCalorieTarget;
  const consumed = data?.daily.caloriesConsumed ?? 0;
  const netCalories = data?.daily.netCalories ?? 0;
  const remaining = target ? target - netCalories : null;
  const progress = target ? Math.max(0, Math.min(100, netCalories / target * 100)) : 0;
  const macros = (data?.meals ?? []).flatMap(meal => meal.ingredients).reduce((total, ingredient) => ({
    carbs: total.carbs + (ingredient.carbsGrams ?? 0), protein: total.protein + (ingredient.proteinGrams ?? 0),
    fat: total.fat + (ingredient.fatGrams ?? 0),
  }), { carbs: 0, protein: 0, fat: 0 });
  return <section className="card dashboard-panel" aria-labelledby="dashboard-title">
    <div className="exercise-heading"><div><span className="eyebrow">TODAY'S BALANCE</span><h2 id="dashboard-title">พลังงานของคุณ</h2></div><label className="compact-field">วันที่<input type="date" value={date} onChange={e => { if (e.target.value) setDate(e.target.value); }} /></label></div>
    {error ? <p className="feedback error" role="alert">{error}</p> : !data ? <p role="status">กำลังโหลดข้อมูล…</p> : <>
      <div className="energy-ring" style={{ background: `conic-gradient(#fff ${progress}%, #ffffff30 0)` }}><div><span>{remaining === null ? 'รับประทานแล้ว' : remaining < 0 ? 'เกินเป้าหมาย' : 'ทานได้อีก'}</span><strong>{Math.abs(remaining ?? consumed).toLocaleString()}</strong><small>kcal</small></div></div>
      <p className="energy-caption">{target ? `เป้าหมาย ${target.toLocaleString()} kcal / วัน` : 'ตั้งเป้าหมายในหน้าความคืบหน้า'}</p>
      <div className="energy-summary"><div><span>รับประทาน</span><strong>{consumed.toLocaleString()}</strong><small>kcal</small></div><div><span>ออกกำลังกาย</span><strong>{data.daily.caloriesBurned.toLocaleString()}</strong><small>kcal</small></div><div><span>พลังงานสุทธิ</span><strong>{netCalories.toLocaleString()}</strong><small>kcal</small></div></div>
      <div className="macro-summary" aria-label="สารอาหารที่บันทึก"><div><span>คาร์บ</span><strong>{Math.round(macros.carbs)} <small>ก.</small></strong></div><div><span>โปรตีน</span><strong>{Math.round(macros.protein)} <small>ก.</small></strong></div><div><span>ไขมัน</span><strong>{Math.round(macros.fat)} <small>ก.</small></strong></div></div>
      <p className="energy-caption">BMI ปัจจุบัน {user.bmi?.toFixed(1) ?? '—'} · อาหาร {data.meals.length} รายการ</p>
    </>}
  </section>;
}
