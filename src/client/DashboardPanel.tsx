import { useEffect, useState } from 'react';
import type { PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';

type DailySummary = { caloriesConsumed: number; caloriesBurned: number; netCalories: number };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const bmiStatus = (bmi: number | null) => bmi === null ? 'รอข้อมูลน้ำหนักและส่วนสูง' : bmi < 18.5 ? 'ต่ำกว่าเกณฑ์' : bmi < 23 ? 'อยู่ในเกณฑ์' : bmi < 25 ? 'เริ่มเกินเกณฑ์' : 'สูงกว่าเกณฑ์';

export function DashboardPanel({ user }: { user: PublicUser }) {
  const [date, setDate] = useState(today);
  const [daily, setDaily] = useState<DailySummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void (async () => { try { setDaily(await api<DailySummary>(`/exercises/daily?date=${date}`)); setError(''); } catch (e) { setError(e instanceof ApiError ? e.message : 'โหลด Dashboard ไม่ได้'); } })(); }, [date]);
  const netLabel = (daily?.netCalories ?? 0) > 0 ? 'พลังงานคงเหลือ' : (daily?.netCalories ?? 0) < 0 ? 'เผาผลาญมากกว่าที่รับ' : 'สมดุลพลังงาน';
  return <section className="card dashboard-panel" aria-labelledby="dashboard-title"><div className="exercise-heading"><div><span className="eyebrow">TODAY AT A GLANCE</span><h2 id="dashboard-title">Dashboard สุขภาพ</h2><p className="muted">สรุปค่าที่สำคัญของวันนี้ในจุดเดียว</p></div><label className="compact-field">วันที่<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>{error ? <p className="feedback error">{error}</p> : <div className="dashboard-cards"><article className="bmi-card"><span>BMI ปัจจุบัน</span><strong>{user.bmi?.toFixed(1) ?? '—'}</strong><small>{bmiStatus(user.bmi)}</small></article><article><span>รับประทาน</span><strong>{daily?.caloriesConsumed ?? 0}</strong><small>kcal</small></article><article><span>เผาผลาญ</span><strong>{daily?.caloriesBurned ?? 0}</strong><small>kcal</small></article><article className="net-card"><span>{netLabel}</span><strong>{Math.abs(daily?.netCalories ?? 0)}</strong><small>kcal</small></article></div>}</section>;
}
