import { useEffect, useRef, useState, type FormEvent } from 'react';
import { activityOptions } from '../shared/activities';
import type { PublicExercise, PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';
import { UiIcon } from './Ui';
import { localDate } from './mealHelpers';

type DailySummary = {
  date: string; exercises: PublicExercise[]; caloriesConsumed: number;
  caloriesBurned: number; netCalories: number;
};
const activityLabel = (id: string) => activityOptions.find(option => option.id === id)?.label ?? id;

export function ExercisePanel({ user, onSaved, initialDate, compactHistory = false }: { user: PublicUser; onSaved?: (message: string) => void; initialDate?: string; compactHistory?: boolean }) {
  const [date, setDate] = useState(initialDate ?? localDate);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [activityType, setActivityType] = useState<string>(activityOptions[0].id);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [formOpen, setFormOpen] = useState(!compactHistory);
  const requestSequence = useRef(0);
  const [loading, setLoading] = useState(true);

  async function loadSummary(selectedDate = date) {
    const request = ++requestSequence.current;
    setLoading(true);
    try {
      const result = await api<DailySummary>(`/exercises/daily?date=${encodeURIComponent(selectedDate)}`);
      if (request === requestSequence.current) setSummary(result.date === selectedDate ? result : null);
    } catch (error) {
      if (request === requestSequence.current) setMessage({ text: error instanceof ApiError ? error.message : 'โหลดข้อมูลการออกกำลังกายไม่ได้', error: true });
    } finally {
      if (request === requestSequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    setSummary(null);
    setEditingId(null);
    setActivityType(activityOptions[0].id);
    setDurationMinutes('30');
    void loadSummary(date);
    const refresh = () => { void loadSummary(date); };
    window.addEventListener('daily-calories-updated', refresh);
    return () => { requestSequence.current++; window.removeEventListener('daily-calories-updated', refresh); };
  }, [date]);

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const body = { activityType, durationMinutes: Number(durationMinutes), activityDate: date };
    try {
      await api(editingId ? `/exercises/${editingId}` : '/exercises', body, editingId ? 'PUT' : 'POST');
      setEditingId(null); setActivityType(activityOptions[0].id); setDurationMinutes('30');
      const successMessage = editingId ? 'แก้ไขกิจกรรมแล้ว' : 'บันทึกกิจกรรมแล้ว';
      setMessage({ text: successMessage, error: false });
      window.dispatchEvent(new Event('daily-calories-updated'));
      if (compactHistory) setFormOpen(false);
      if (onSaved) onSaved(successMessage);
      else await loadSummary(date);
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'บันทึกกิจกรรมไม่ได้', error: true });
    } finally { setBusy(false); }
  }
  async function removeExercise(id: string) {
    setBusy(true); setMessage(null);
    try {
      await api(`/exercises/${id}`, {}, 'DELETE');
      if (editingId === id) setEditingId(null);
      setMessage({ text: 'ลบกิจกรรมแล้ว', error: false });
      await loadSummary(date); window.dispatchEvent(new Event('daily-calories-updated'));
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'ลบกิจกรรมไม่ได้', error: true });
    } finally { setBusy(false); }
  }

  return <section className="card exercise-panel ref-exercise" aria-labelledby="exercise-title">
    <div className="exercise-heading"><div><h2 id="exercise-title">กิจกรรม</h2><p className="muted">พลังงานคำนวณจากน้ำหนักล่าสุดของคุณ</p></div>
      {!compactHistory && <label className="compact-field">วันที่<input aria-label="วันที่" type="date" value={date} disabled={busy} onChange={event => { if (event.target.value) { setDate(event.target.value); setSummary(null); setEditingId(null); setActivityType(activityOptions[0].id); setDurationMinutes('30'); setMessage(null); } }} /><small>{new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`))}</small></label>}</div>
    {message && <div className={`feedback ${message.error ? 'error' : 'success'}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    {user.weightKg === null && <div className="feedback error" role="alert">กรุณาบันทึกน้ำหนักก่อนเพิ่มกิจกรรม</div>}
    {compactHistory && !formOpen && <button type="button" className="secondary" onClick={() => { setEditingId(null); setFormOpen(true); }}>+ บันทึกกิจกรรม</button>}
    {formOpen && <form className="exercise-form" onSubmit={saveExercise}>
      <label className="compact-field">กิจกรรม<select value={activityType} onChange={event => setActivityType(event.target.value)}>{activityOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="compact-field">ระยะเวลา (นาที)<input type="number" min="1" max="1440" step="1" value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} required /></label>
      <button className="primary" type="submit" disabled={busy || user.weightKg === null}>{busy ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มกิจกรรม'}</button>
      {(editingId || compactHistory) && <button className="secondary" type="button" disabled={busy} onClick={() => { setEditingId(null); setActivityType(activityOptions[0].id); setDurationMinutes('30'); setFormOpen(false); }}>ยกเลิก</button>}
    </form>}
    <div className="exercise-list"><h3>กิจกรรมของวันที่เลือก</h3>
      {loading ? <p role="status">กำลังโหลดกิจกรรม…</p> : summary?.date !== date ? <p className="empty-state">โหลดกิจกรรมวันที่เลือกไม่ได้</p> : !summary.exercises.length ? <p className="empty-state">ยังไม่มีกิจกรรมในวันที่เลือก</p> : summary.exercises.map(exercise => <article key={exercise.id}>
        <span className={`exercise-kind-icon kind-${exercise.activityType}`} aria-hidden="true"><UiIcon name={exercise.activityType === 'walking' || exercise.activityType === 'running' ? 'run' : exercise.activityType === 'cycling' ? 'bike' : exercise.activityType === 'strength' ? 'strength' : 'yoga'} size={22} /></span>
        <div><strong>{activityLabel(exercise.activityType)}</strong><span>{exercise.durationMinutes} นาที · {exercise.caloriesBurned} kcal</span></div>
        <div className="row-actions"><button type="button" aria-label={`แก้ไข ${activityLabel(exercise.activityType)}`} disabled={busy || loading} onClick={() => { setEditingId(exercise.id); setActivityType(exercise.activityType); setDurationMinutes(String(exercise.durationMinutes)); setFormOpen(true); }}><UiIcon name="edit" size={17} /></button><button type="button" aria-label={`ลบ ${activityLabel(exercise.activityType)}`} onClick={() => void removeExercise(exercise.id)} disabled={busy || loading}><UiIcon name="trash" size={17} /></button></div>
      </article>)}
    </div>
    {summary?.date === date && !loading ? <div className="calorie-cards" aria-label="สรุปพลังงานประจำวัน">
      <div><span>รับประทาน</span><strong>{summary.caloriesConsumed}</strong><small>kcal</small></div>
      <div><span>เผาผลาญ</span><strong>{summary.caloriesBurned}</strong><small>kcal</small></div>
      <div className="net-calories"><span>พลังงานสุทธิ</span><strong>{summary.netCalories}</strong><small>kcal</small></div>
    </div> : <p role={loading ? 'status' : undefined}>{loading ? 'กำลังโหลดสรุปพลังงาน…' : 'ยังแสดงสรุปพลังงานของวันที่เลือกไม่ได้'}</p>}
  </section>;
}
