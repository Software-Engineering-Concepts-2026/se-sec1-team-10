import { useEffect, useState } from 'react';
import { api, ApiError } from './api';

type Day = { date: string; caloriesConsumed: number; caloriesBurned: number; netCalories: number };
type Summary = { startDate: string; endDate: string; days: Day[]; caloriesConsumed: number; caloriesBurned: number };
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function WeeklySummaryPanel() {
  const [date, setDate] = useState(localDate);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; let sequence = 0;
    const load = async () => { const current = ++sequence; try { const result = await api<Summary>(`/summary/weekly?date=${date}`); if (active && current === sequence) { setSummary(result); setError(''); } } catch (e) { if (active && current === sequence) setError(e instanceof ApiError ? e.message : 'โหลดสรุปรายสัปดาห์ไม่ได้'); } };
    void load(); const updated = () => { void load(); };
    window.addEventListener('daily-calories-updated', updated);
    return () => { active = false; window.removeEventListener('daily-calories-updated', updated); };
  }, [date]);
  const weeklyNetCalories = summary?.days.reduce((total, day) => total + day.netCalories, 0) ?? 0;
  const max = Math.max(1, ...(summary?.days.flatMap(day => [day.caloriesConsumed, day.caloriesBurned]) ?? [1]));
  return <section className="card weekly-panel" aria-labelledby="weekly-title"><div className="exercise-heading"><div><span className="eyebrow">WEEKLY OVERVIEW</span><h2 id="weekly-title">สรุปพลังงาน 7 วัน</h2><p className="muted">เปรียบเทียบแคลอรีที่รับเข้าและใช้ไป เพื่อดูพฤติกรรมของสัปดาห์นี้</p></div><label className="compact-field weekly-date-field">สิ้นสุดวันที่<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>{error ? <p className="feedback error">{error}</p> : <><div className="weekly-totals"><div><span>รับประทาน</span><strong>{summary?.caloriesConsumed ?? 0}</strong><small>kcal</small></div><div><span>เผาผลาญ</span><strong>{summary?.caloriesBurned ?? 0}</strong><small>kcal</small></div><div><span>พลังงานสุทธิ</span><strong>{weeklyNetCalories}</strong><small>kcal</small></div></div><div className="weekly-bars">{summary?.days.map(day => <div key={day.date}><div className="bar-pair"><span className="consumed" style={{ height: `${day.caloriesConsumed / max * 100}%` }} /><span className="burned" style={{ height: `${day.caloriesBurned / max * 100}%` }} /></div><small>{day.date.slice(5).replace('-', '/')}</small></div>)}</div><p className="chart-key"><span />รับประทาน <i />เผาผลาญ</p></>}</section>;
} 
