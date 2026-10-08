import { useEffect, useState } from 'react';
import type { PublicUser } from '../shared/contracts';
import { calorieBudget } from '../shared/goals';
import { api, ApiError } from './api';
import { formatDisplayDate } from './formatDisplay';
import { localDate } from './mealHelpers';

type Day = { date: string; caloriesConsumed: number; caloriesBurned: number; netCalories: number; mealCount?: number };
type Summary = { startDate: string; endDate: string; days: Day[]; caloriesConsumed: number; caloriesBurned: number };
export function WeeklySummaryPanel({ user }: { user: PublicUser }) {
  const [date, setDate] = useState(localDate);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);
  useEffect(() => {
    let active = true; let sequence = 0;
    setSummary(null);
    const load = async () => { const current = ++sequence; setLoading(true); try { const result = await api<Summary>(`/summary/weekly?date=${date}`); if (active && current === sequence) { setSummary(result); setError(''); } } catch (e) { if (active && current === sequence) setError(e instanceof ApiError ? e.message : 'โหลดสรุปรายสัปดาห์ไม่ได้'); } finally { if (active && current === sequence) setLoading(false); } };
    void load(); const updated = () => { void load(); };
    window.addEventListener('daily-calories-updated', updated);
    return () => { active = false; window.removeEventListener('daily-calories-updated', updated); };
  }, [date, retryVersion]);
  const loggedDays = (summary?.days ?? []).filter(day => (day.mealCount ?? (day.caloriesConsumed > 0 ? 1 : 0)) > 0);
  const target = user.dailyCalorieTarget;
  const comparison = (day: Day) => calorieBudget(target, day.caloriesConsumed, day.caloriesBurned, user.goalSettings).countedCalories;
  const differences = loggedDays.map(day => comparison(day) - (target ?? 0));
  const averageDifference = target != null && differences.length ? Math.round(differences.reduce((sum, value) => sum + value, 0) / differences.length) : null;
  const weeklyNetCalories = summary?.days.reduce((total, day) => total + day.netCalories, 0) ?? 0;
  const max = Math.max(1, ...(summary?.days.flatMap(day => [day.caloriesConsumed, day.caloriesBurned, target ?? 0]) ?? [1]));
  return <section className="weekly-panel ref-weekly" aria-labelledby="weekly-title"><div className="exercise-heading"><div><h2 id="weekly-title">สรุปพลังงาน 7 วัน</h2></div><label className="compact-field weekly-date-field">สิ้นสุดวันที่<input type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /><small>{formatDisplayDate(date)}</small></label></div>
    {error && <div className="weekly-load-error"><p className="feedback error" role="alert">{error}</p><button type="button" className="diary-link" disabled={loading} onClick={() => setRetryVersion(version => version + 1)}>ลองโหลดอีกครั้ง</button></div>}{loading && !summary ? <p role="status">กำลังโหลดสรุปรายสัปดาห์…</p> : summary ? <>
      <p className="ref-note">{formatDisplayDate(summary.startDate)} – {formatDisplayDate(summary.endDate)}</p>
      <h3 className="ref-section-label">พลังงานรายวัน (kcal)</h3>
      <div className="weekly-bars ref-weekly-bars">{summary.days.map(day => { const logged = (day.mealCount ?? (day.caloriesConsumed > 0 ? 1 : 0)) > 0; const diff = target == null || !logged ? null : comparison(day) - target; return <div key={day.date} className={!logged ? 'unlogged-day' : ''} title={!logged ? `${formatDisplayDate(day.date)}: ไม่มีบันทึกอาหาร` : diff == null ? `${formatDisplayDate(day.date)}: ยังไม่ได้ตั้งเป้าหมาย` : `${formatDisplayDate(day.date)}: ${diff > 0 ? '+' : ''}${diff} kcal เทียบเป้าหมายปัจจุบัน`}><div className="bar-pair" role="img" aria-label={`${formatDisplayDate(day.date)}: รับประทาน ${day.caloriesConsumed} kcal เผาผลาญ ${day.caloriesBurned} kcal`}><span className="consumed" style={{ height: `${day.caloriesConsumed / max * 100}%` }} /><span className="burned" style={{ height: `${day.caloriesBurned / max * 100}%` }} /></div><small>{day.date.slice(8)}</small><b>{diff == null ? '—' : `${diff > 0 ? '+' : ''}${diff}`}</b></div>; })}</div><p className="chart-key"><span />รับประทาน <i />เผาผลาญ <small>· ตัวเลขรายวันแสดงผลต่างจากเป้าหมายในวันที่มีบันทึก</small></p>
      <h3 className="ref-section-label">สรุปรายสัปดาห์</h3>
      <div className="weekly-totals ref-weekly-stats"><div><span>ค่าเฉลี่ยที่รับประทาน</span><strong>{loggedDays.length ? Math.round(loggedDays.reduce((sum,day) => sum + day.caloriesConsumed,0) / loggedDays.length).toLocaleString() : '—'}</strong><small>kcal/วันที่มีข้อมูล</small></div><div><span>วันที่บันทึกอาหาร</span><strong>{loggedDays.length}</strong><small>จาก 7 วัน</small></div><div><span>ค่าเฉลี่ยเทียบเป้าหมาย</span><strong>{averageDifference == null ? '—' : `${averageDifference > 0 ? '+' : ''}${averageDifference}`}</strong><small>{averageDifference == null ? target == null ? 'ยังไม่ได้ตั้งเป้าหมาย' : 'ยังไม่มีบันทึกอาหาร' : 'kcal/วัน · บวกคือเกินเป้า'}</small></div><div><span>{user.goalSettings ? 'รับประทานรวม' : 'พลังงานสุทธิรวม (เป้าหมายเดิม)'}</span><strong>{(user.goalSettings ? summary.caloriesConsumed : weeklyNetCalories).toLocaleString()}</strong><small>kcal · ข้อมูล 7 วัน</small></div></div>
      {loggedDays.length === 0 && <p className="empty-state">ยังไม่มีบันทึกอาหารในช่วงนี้</p>}

      <p className="ref-note">เปรียบเทียบกับเป้าหมายปัจจุบัน เฉพาะวันที่มีบันทึกอาหาร วันที่ไม่ได้บันทึกไม่ได้หมายถึงกิน 0 kcal</p>
    </> : null}</section>;
}
