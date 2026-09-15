import { useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';
export function GoalPanel({ user, onSaved }: { user: PublicUser; onSaved: (user: PublicUser) => void }) {
  const [weight, setWeight] = useState(String(user.targetWeightKg ?? ''));
  const [calories, setCalories] = useState(String(user.dailyCalorieTarget ?? ''));
  const [message, setMessage] = useState('');
  async function save(event: FormEvent) { event.preventDefault(); try { const result = await api<{ user: PublicUser }>('/goals', { targetWeightKg: Number(weight), dailyCalorieTarget: Number(calories) }, 'PUT'); onSaved(result.user); setMessage('บันทึกเป้าหมายแล้ว'); } catch (e) { setMessage(e instanceof ApiError ? e.message : 'บันทึกไม่ได้'); } }
  const difference = user.weightKg != null && user.targetWeightKg != null ? Math.round((user.weightKg - user.targetWeightKg) * 10) / 10 : null;
  return <section className="card goal-panel"><span className="eyebrow">MY GOALS</span><h2>เป้าหมายสุขภาพ</h2><form onSubmit={save}><div className="goal-fields"><label>น้ำหนักเป้าหมาย (กก.)<input type="number" min="0.1" step="0.1" required value={weight} onChange={e => setWeight(e.target.value)} /></label><label>เป้าหมายพลังงานต่อวัน<input type="number" min="1" required value={calories} onChange={e => setCalories(e.target.value)} /></label></div><button className="secondary">บันทึกเป้าหมาย</button></form>{user.targetWeightKg && <><p>น้ำหนักปัจจุบัน {user.weightKg ?? '—'} / เป้าหมาย {user.targetWeightKg} กก.</p><p>{difference === null ? 'บันทึกน้ำหนักปัจจุบันเพื่อเทียบกับเป้าหมาย' : difference === 0 ? 'น้ำหนักตรงกับเป้าหมายแล้ว' : `ห่างจากเป้าหมาย ${Math.abs(difference)} กก.`}</p></>}{message && <small>{message}</small>}</section>;
}
