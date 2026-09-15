import { useEffect, useState } from 'react';
import { api, ApiError } from './api';
type Point = { date: string; weightKg: number; bmi: number };
export function HealthTrendPanel() {
  const [points, setPoints] = useState<Point[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const load = () => { void api<{ points: Point[] }>('/health-history').then(r => {
      if (!active) return;
      const days = new Map<string, Point>();
      r.points.forEach(point => days.set(point.date, point));
      setPoints([...days.values()].sort((a, b) => a.date.localeCompare(b.date))); setError('');
    }).catch(e => { if (active) setError(e instanceof ApiError ? e.message : 'โหลดประวัติไม่ได้'); }); };
    load(); window.addEventListener('profile-updated', load);
    return () => { active = false; window.removeEventListener('profile-updated', load); };
  }, []);
  const max = Math.max(1, ...points.map(p => p.weightKg));
  return <section className="card trend-panel"><span className="eyebrow">HEALTH TREND</span><h2>แนวโน้มน้ำหนักและ BMI</h2><p className="muted">ข้อมูลย้อนหลัง 1 ปี · น้ำหนักล่าสุดของแต่ละวัน</p>{error ? <p role="alert" className="feedback error">{error}</p> : points.length ? <div className="trend-scroll" tabIndex={0} role="region" aria-label="กราฟน้ำหนัก เลื่อนเพื่อดูข้อมูลย้อนหลัง"><div className="trend-chart" style={{ minWidth: Math.max(250, points.length * 65) }}>{points.map(point => <div key={point.date}><span style={{ height: `${point.weightKg / max * 100}%` }} /><small>{point.date.slice(5)}</small><b>{point.weightKg} กก. · BMI {point.bmi}</b></div>)}</div></div> : <p className="empty-state">บันทึกน้ำหนักในหน้าบัญชีเพื่อเริ่มดูแนวโน้ม</p>}</section>;
}
