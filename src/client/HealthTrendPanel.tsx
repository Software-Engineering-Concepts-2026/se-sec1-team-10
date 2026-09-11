import { useEffect, useState } from 'react';
import { api } from './api';
type Point = { date: string; weightKg: number; bmi: number };
export function HealthTrendPanel() { const [points, setPoints] = useState<Point[]>([]); useEffect(() => { void api<{ points: Point[] }>('/health-history').then(r => setPoints(r.points)).catch(() => setPoints([])); }, []); const max = Math.max(1, ...points.map(p => p.weightKg)); return <section className="card trend-panel"><span className="eyebrow">HEALTH TREND</span><h2>แนวโน้มน้ำหนักและ BMI</h2>{points.length ? <div className="trend-chart">{points.map(point => <div key={point.date}><span style={{ height: `${point.weightKg / max * 100}%` }} /><small>{point.date.slice(5)}</small><b>{point.weightKg} กก. · BMI {point.bmi}</b></div>)}</div> : <p className="empty-state">บันทึกข้อมูลส่วนตัวเพื่อเริ่มสร้างกราฟแนวโน้ม</p>}</section>;
}
