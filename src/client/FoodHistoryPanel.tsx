import { useEffect, useState } from 'react';
import type { PublicMeal } from '../shared/contracts';
import { api, ApiError } from './api';
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export function FoodHistoryPanel() {
  const [to, setTo] = useState(today); const [from, setFrom] = useState(today);
  const [meals, setMeals] = useState<PublicMeal[]>([]); const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let sequence = 0;
    if (!from || !to || from > to) { setError('เลือกวันที่เริ่มต้นก่อนหรือเท่ากับวันที่สิ้นสุด'); return; }
    const load = async () => {
      const current = ++sequence;
      try { const result = await api<{ meals: PublicMeal[] }>(`/meals/history?from=${from}&to=${to}`); if (active && current === sequence) { setMeals(result.meals); setError(''); } }
      catch (e) { if (active && current === sequence) setError(e instanceof ApiError ? e.message : 'โหลดประวัติไม่ได้'); }
    };
    void load(); const changed = () => { void load(); };
    window.addEventListener('daily-calories-updated', changed);
    return () => { active = false; window.removeEventListener('daily-calories-updated', changed); };
  }, [from, to]);
  return <section className="card history-panel"><span className="eyebrow">FOOD HISTORY</span><h2>ประวัติอาหาร</h2><div className="history-filter"><label>จาก<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label>ถึง<input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></div>{error ? <p className="feedback error" role="alert">{error}</p> : meals.length ? meals.map(meal => <article key={meal.id}><strong>{meal.name}</strong><span>{meal.activityDate} · {meal.totalCalories} kcal</span></article>) : <p className="empty-state">ไม่พบรายการในช่วงวันที่เลือก</p>}</section>;
}
