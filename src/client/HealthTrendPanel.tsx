import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';
import { formatDisplayDate } from './formatDisplay';
import { localDate } from './mealHelpers';

type Point = { id: string; date: string; weightKg: number; heightCm: number; bmi: number };
type WeightLogResult = { logs: Point[] };
type WeightMutation = { log?: Point; user: PublicUser; message?: string };
const yearAgo = () => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

export function HealthTrendPanel({ user, onUserChanged, onOpenAccount }: { user: PublicUser; onUserChanged?: (user: PublicUser) => void; onOpenAccount?: () => void }) {
  const [metric, setMetric] = useState<'weight' | 'bmi'>('weight');
  const [range, setRange] = useState(180);
  const [logs, setLogs] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [date, setDate] = useState(localDate);
  const [weight, setWeight] = useState('');
  const [saving, setSaving] = useState(false);
  const loadSequence = useRef(0);

  async function loadLogs() {
    const request = ++loadSequence.current;
    setLoading(true);
    try { const result = await api<WeightLogResult>('/weight-logs'); if (request === loadSequence.current) { setLogs(result.logs); setError(''); } }
    catch (e) { if (request === loadSequence.current) setError(e instanceof ApiError ? e.message : 'โหลดประวัติน้ำหนักไม่ได้'); }
    finally { if (request === loadSequence.current) setLoading(false); }
  }
  useEffect(() => {
    void loadLogs();
    const refresh = () => { void loadLogs(); };
    window.addEventListener('profile-updated', refresh);
    return () => window.removeEventListener('profile-updated', refresh);
  }, []);

  const startWeight = user.goalSettings?.startWeightKg;
  const change = startWeight != null && user.weightKg != null ? Math.round((user.weightKg - startWeight) * 10) / 10 : null;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range);
  const shown = useMemo(() => {
    const byDate = new Map<string, Point>();
    for (const point of logs) if (new Date(`${point.date}T12:00:00`).getTime() >= cutoff.getTime()) {
      // API returns newest logs first, so keep the first entry for each day.
      if (!byDate.has(point.date)) byDate.set(point.date, point);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, range]);
  const value = (point: Point) => metric === 'weight' ? point.weightKg : point.bmi;
  const values = shown.map(value);
  if (metric === 'weight' && user.targetWeightKg != null) values.push(user.targetWeightKg);
  const bottom = values.length ? Math.floor(Math.min(...values) - 2) : 0;
  const top = values.length ? Math.ceil(Math.max(...values) + 2) : 1;
  const y = (n: number) => 174 - (n - bottom) / (top - bottom) * 142;
  const times = shown.map(point => new Date(`${point.date}T12:00:00`).getTime());
  const x = (index: number) => times.length < 2 ? 170 : 38 + (times[index] - times[0]) / Math.max(1, times[times.length - 1] - times[0]) * 282;
  const path = shown.map((point,index) => `${index ? 'L' : 'M'} ${x(index)} ${y(value(point))}`).join(' ');
  const areaPath = shown.length ? `${path} L ${x(shown.length - 1)} 174 L ${x(0)} 174 Z` : '';

  function beginEdit(log: Point) { setEditingId(log.id); setDate(log.date); setWeight(String(log.weightKg)); setFormOpen(true); setNotice(''); setError(''); }
  function cancelEdit() { setEditingId(null); setFormOpen(false); setDate(localDate()); setWeight(''); setError(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const result = await api<WeightMutation>(editingId ? `/weight-logs/${encodeURIComponent(editingId)}` : '/weight-logs', { date, weightKg: Number(weight) }, editingId ? 'PUT' : 'POST');
      loadSequence.current += 1;
      setLogs(current => result.log ? [result.log, ...current.filter(log => log.id !== result.log!.id)] : current);
      onUserChanged?.(result.user);
      setEditingId(null); setFormOpen(false); setDate(localDate()); setWeight(''); setNotice(editingId ? 'แก้ไขบันทึกน้ำหนักแล้ว' : 'บันทึกน้ำหนักแล้ว');
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) { setError(e instanceof ApiError ? e.message : 'บันทึกน้ำหนักไม่ได้'); }
    finally { setSaving(false); }
  }
  async function remove(log: Point) {
    if (!window.confirm(`ลบบันทึกน้ำหนักวันที่ ${formatDisplayDate(log.date)} (${log.weightKg} กก.) หรือไม่`)) return;
    setError(''); setNotice(''); setDeletingId(log.id);
    try {
      const result = await api<WeightMutation>(`/weight-logs/${encodeURIComponent(log.id)}`, {}, 'DELETE');
      loadSequence.current += 1;
      setLogs(current => current.filter(item => item.id !== log.id)); onUserChanged?.(result.user);
      if (editingId === log.id) cancelEdit();
      setNotice('ลบบันทึกน้ำหนักแล้ว'); window.dispatchEvent(new Event('profile-updated'));
    } catch (e) { setError(e instanceof ApiError ? e.message : 'ลบบันทึกน้ำหนักไม่ได้'); }
    finally { setDeletingId(null); }
  }

  return <section className="trend-panel ref-trend" aria-labelledby="trend-title">
    <h2 id="trend-title">ความคืบหน้า: น้ำหนัก / BMI</h2>
    <div className="trend-goal-stats ref-trend-stats">{[
      ['น้ำหนักเริ่มต้น', startWeight != null ? `${startWeight} กก.` : '—'], ['น้ำหนักปัจจุบัน', user.weightKg != null ? `${user.weightKg} กก.` : '—'], ['เป้าหมาย', user.targetWeightKg != null ? `${user.targetWeightKg} กก.` : 'ยังไม่ได้ตั้ง'], ['เปลี่ยนจากวันเริ่มต้น', change == null ? '—' : `${change > 0 ? '+' : ''}${change} กก.`],
    ].map(([label,number]) => <div key={label} className="ref-stat"><span>{label}</span><strong>{number}</strong></div>)}</div>
    <div className="ref-chart-controls"><div className="ref-chart-tabs" role="group" aria-label="เลือกข้อมูลกราฟ"><button type="button" aria-pressed={metric === 'weight'} onClick={() => setMetric('weight')}>น้ำหนัก</button><button type="button" aria-pressed={metric === 'bmi'} onClick={() => setMetric('bmi')}>BMI</button></div><div className="ref-chart-ranges" role="group" aria-label="ช่วงเวลากราฟ">{[[30,'1 เดือน'],[90,'3 เดือน'],[180,'6 เดือน'],[365,'1 ปี']].map(([days,label]) => <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(Number(days))}>{label}</button>)}</div></div>
    {loading ? <p role="status">กำลังโหลดแนวโน้ม…</p> : error && logs.length === 0 ? <p role="alert" className="feedback error">{error}</p> : shown.length ? <div className="ref-trend-chart"><h3>{metric === 'weight' ? 'กราฟน้ำหนัก (กก.)' : 'กราฟ BMI'}</h3><svg viewBox="0 0 350 215" role="img" aria-label={metric === 'weight' ? 'กราฟน้ำหนักรายวัน' : 'กราฟ BMI รายวัน'}>
      {[0,1,2,3].map(i => { const n = bottom + (top-bottom) * i / 3; return <g key={i}><line x1="38" x2="320" y1={y(n)} y2={y(n)} stroke="#e6eeea" /><text x="29" y={y(n)+4} textAnchor="end" fill="#697570" fontSize="10">{n.toFixed(1)}</text></g>; })}
      {metric === 'weight' && user.targetWeightKg != null && <g className="trend-target-line"><line x1="38" x2="320" y1={y(user.targetWeightKg)} y2={y(user.targetWeightKg)} stroke="#76b684" strokeDasharray="4 4" /><text x="40" y={y(user.targetWeightKg)-5} fill="#00883d" fontSize="10">เป้าหมาย {user.targetWeightKg} กก.</text></g>}
      <path d={areaPath} fill="#009b45" fillOpacity=".12" stroke="none" /><path d={path} stroke="#009b45" strokeWidth="2.5" fill="none" />{shown.map((point,index) => <circle key={point.id} cx={x(index)} cy={y(value(point))} r="3.5" fill="white" stroke="#009b45" strokeWidth="2"><title>{formatDisplayDate(point.date)}: {point.weightKg} กก. · BMI {point.bmi}</title></circle>)}
      {[...new Set([0,Math.floor((shown.length-1)/2),shown.length-1])].map(index => <text key={index} x={x(index)} y="199" fontSize="10" textAnchor="middle" fill="#697570">{formatDisplayDate(shown[index].date)}</text>)}
    </svg><p className="ref-note">น้ำหนักล่าสุดของแต่ละวัน · {shown.length} วันที่มีข้อมูล</p></div> : <p className="empty-state">ยังไม่มีน้ำหนักในช่วงนี้ บันทึกน้ำหนักด้านล่างเพื่อเริ่มดูแนวโน้ม</p>}
    {error && logs.length > 0 && <p className="feedback error" role="alert">{error}</p>}{notice && <p className="feedback success" role="status">{notice}</p>}
    <section className="ref-weight-logs" aria-labelledby="weight-logs-title"><h3 id="weight-logs-title">ประวัติน้ำหนักย้อนหลัง 1 ปี</h3>
      {user.heightCm == null && <div className="feedback error" role="status">ต้องเพิ่มส่วนสูงในข้อมูลบัญชีก่อนบันทึกน้ำหนัก เพื่อคำนวณ BMI ได้ถูกต้อง {onOpenAccount && <button type="button" className="diary-link" onClick={onOpenAccount}>ไปที่บัญชี</button>}</div>}
      {!formOpen && <button className="secondary ref-add-weight" type="button" disabled={user.heightCm == null} onClick={() => { setDate(localDate()); setWeight(''); setEditingId(null); setFormOpen(true); setError(''); }}>บันทึกน้ำหนัก</button>}
      {formOpen && <form className="ref-weight-form" onSubmit={save}><label className="compact-field">วันที่<input aria-label="วันที่" type="date" value={date} min={yearAgo()} max={localDate()} required onChange={e => setDate(e.target.value)} /><small>{formatDisplayDate(date)}</small></label><label className="compact-field">น้ำหนัก (กก.)<input type="number" min="1" max="500" step="0.1" value={weight} required onChange={e => setWeight(e.target.value)} /></label><button className="primary" type="submit" disabled={saving || deletingId !== null}>{saving ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'บันทึกน้ำหนัก'}</button><button className="secondary" type="button" disabled={saving || deletingId !== null} onClick={cancelEdit}>ยกเลิก</button></form>}
      {loading ? <p role="status">กำลังโหลดรายการ…</p> : error && logs.length === 0 ? <button type="button" className="diary-link" onClick={() => void loadLogs()}>ลองโหลดประวัติอีกครั้ง</button> : logs.length ? <div className="ref-weight-log-list">{logs.map(log => <article key={log.id}><div><strong>{formatDisplayDate(log.date)}</strong><span>{log.weightKg} กก. · BMI {log.bmi.toFixed(1)}</span></div><div className="row-actions"><button type="button" aria-label={`แก้ไขน้ำหนัก ${formatDisplayDate(log.date)}`} disabled={saving || deletingId !== null} onClick={() => beginEdit(log)}>แก้ไข</button><button type="button" aria-label={`ลบน้ำหนัก ${formatDisplayDate(log.date)}`} disabled={saving || deletingId !== null} onClick={() => void remove(log)}>ลบ</button></div></article>)}</div> : <p className="empty-state">ยังไม่มีรายการน้ำหนัก</p>}
    </section>
    <section className="ref-form"><h3>ข้อมูลเพิ่มเติม</h3><p>ส่วนสูง <strong>{user.heightCm ?? '—'} ซม.</strong></p><p>BMI ปัจจุบัน <strong>{user.bmi?.toFixed(1) ?? '—'}</strong></p><p>หากน้ำหนักเปลี่ยนจนกระทบเป้าหมาย กรุณาตรวจทานเป้าหมายในหน้าบัญชีด้วยตนเอง</p></section>
  </section>;
}
