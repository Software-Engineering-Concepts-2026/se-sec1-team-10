import { useEffect, useState, type FormEvent } from 'react';
import { activityOptions } from '../shared/activities';
import type { PublicExercise, PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';

type DailySummary = {
  date: string; exercises: PublicExercise[]; caloriesConsumed: number;
  caloriesBurned: number; netCalories: number;
};
const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const activityLabel = (id: string) => activityOptions.find(option => option.id === id)?.label ?? id;

export function ExercisePanel({ user }: { user: PublicUser }) {
  const [date, setDate] = useState(localDate);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [activityType, setActivityType] = useState<string>(activityOptions[0].id);
  const [durationMinutes, setDurationMinutes] = useState('30');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  async function loadSummary(selectedDate = date) {
    try {
      const result = await api<DailySummary>(`/exercises/daily?date=${encodeURIComponent(selectedDate)}`);
      setSummary(result);
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'โหลดข้อมูลการออกกำลังกายไม่ได้', error: true });
    }
  }
  useEffect(() => {
    void loadSummary(date);
    const refresh = () => { void loadSummary(); };
    window.addEventListener('daily-calories-updated', refresh);
    return () => window.removeEventListener('daily-calories-updated', refresh);
  }, [date]);

  async function saveExercise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const body = { activityType, durationMinutes: Number(durationMinutes), activityDate: date };
    try {
      await api(editingId ? `/exercises/${editingId}` : '/exercises', body, editingId ? 'PUT' : 'POST');
      setEditingId(null); setActivityType(activityOptions[0].id); setDurationMinutes('30');
      setMessage({ text: editingId ? 'แก้ไขกิจกรรมแล้ว' : 'บันทึกกิจกรรมแล้ว', error: false });
      await loadSummary();
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
      await loadSummary();
    } catch (error) {
      setMessage({ text: error instanceof ApiError ? error.message : 'ลบกิจกรรมไม่ได้', error: true });
    } finally { setBusy(false); }
  }

  return <section className="card exercise-panel" aria-labelledby="exercise-title">
    <div className="exercise-heading"><div><span className="eyebrow">DAILY ACTIVITY</span><h2 id="exercise-title">การออกกำลังกาย</h2><p className="muted">บันทึกกิจกรรม แล้วระบบจะคำนวณพลังงานจากน้ำหนักล่าสุดของคุณ</p></div>
      <label className="compact-field">วันที่<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    {message && <div className={`feedback ${message.error ? 'error' : 'success'}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    {user.weightKg === null && <div className="feedback error" role="alert">กรุณาบันทึกน้ำหนักในข้อมูลส่วนตัวก่อนเพิ่มกิจกรรม</div>}
    <div className="calorie-cards">
      <div><span>รับประทาน</span><strong>{summary?.caloriesConsumed ?? 0}</strong><small>kcal</small></div>
      <div><span>เผาผลาญ</span><strong>{summary?.caloriesBurned ?? 0}</strong><small>kcal</small></div>
      <div className="net-calories"><span>Net Calories</span><strong>{summary?.netCalories ?? 0}</strong><small>kcal</small></div>
    </div>
    <form className="exercise-form" onSubmit={saveExercise}>
      <label className="compact-field">กิจกรรม<select value={activityType} onChange={event => setActivityType(event.target.value)}>{activityOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label className="compact-field">ระยะเวลา (นาที)<input type="number" min="1" max="1440" step="1" value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} required /></label>
      <button className="primary" type="submit" disabled={busy || user.weightKg === null}>{busy ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'เพิ่มกิจกรรม'}</button>
      {editingId && <button className="secondary" type="button" onClick={() => { setEditingId(null); setActivityType(activityOptions[0].id); setDurationMinutes('30'); }}>ยกเลิก</button>}
    </form>
    <div className="exercise-list"><h3>กิจกรรมของวันที่เลือก</h3>
      {!summary?.exercises.length ? <p className="empty-state">ยังไม่มีกิจกรรมในวันนี้</p> : summary.exercises.map(exercise => <article key={exercise.id}>
        <div><strong>{activityLabel(exercise.activityType)}</strong><span>{exercise.durationMinutes} นาที · {exercise.caloriesBurned} kcal</span></div>
        <div className="row-actions"><button type="button" onClick={() => { setEditingId(exercise.id); setActivityType(exercise.activityType); setDurationMinutes(String(exercise.durationMinutes)); }}>แก้ไข</button><button type="button" onClick={() => void removeExercise(exercise.id)} disabled={busy}>ลบ</button></div>
      </article>)}
    </div>
  </section>;
}
