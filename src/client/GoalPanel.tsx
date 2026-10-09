import { useMemo, useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { activityLabels, dailyMacroTargets, estimateGoal, goalEstimateIssue, goalLabels, goalProfileChanged, type GoalSettingsInput } from '../shared/goals';
import { ApiError, api } from './api';
import { FeedbackMessage, type Feedback } from './FormFeedback';
import { UiIcon } from './Ui';

const defaults: GoalSettingsInput = { mode: 'maintain', formulaSex: 'female', activityLevel: 'moderate', targetMode: 'recommended' };

export function GoalPanel({ user, onSaved }: { user: PublicUser; onSaved: (user: PublicUser) => void }) {
  const initialSettings: GoalSettingsInput = user.goalSettings
    ? { mode: user.goalSettings.mode, formulaSex: user.goalSettings.formulaSex, activityLevel: user.goalSettings.activityLevel, targetMode: user.goalSettings.targetMode }
    : (user.dailyCalorieTarget != null ? { ...defaults, targetMode: 'manual' as const } : defaults);
  const [settings, setSettings] = useState<GoalSettingsInput>(initialSettings);
  const [formulaSex, setFormulaSex] = useState(user.goalSettings?.formulaSex ?? '');
  const [manualCalories, setManualCalories] = useState(String(user.dailyCalorieTarget ?? ''));
  const [targetWeight, setTargetWeight] = useState(String(user.targetWeightKg ?? user.weightKg ?? ''));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const profile = { age: user.age, weightKg: user.weightKg, heightCm: user.heightCm };
  const issue = goalEstimateIssue(profile, settings.mode);
  const estimate = useMemo(() => formulaSex ? estimateGoal(profile, settings) : null, [user.age, user.weightKg, user.heightCm, settings, formulaSex]);
  const currentIsManual = user.goalSettings?.targetMode === 'manual' || (!user.goalSettings && user.dailyCalorieTarget != null);
  const profileChanged = goalProfileChanged(profile, user.goalSettings);
  const nextCalories = settings.targetMode === 'manual' ? Number(manualCalories) : estimate?.targetKcal;
  const nextMacros = dailyMacroTargets(nextCalories, settings.mode);
  const difference = user.weightKg != null && user.targetWeightKg != null ? Math.round((user.weightKg - user.targetWeightKg) * 10) / 10 : null;

  function update<K extends keyof GoalSettingsInput>(key: K, value: GoalSettingsInput[K]) {
    setSettings(current => ({ ...current, [key]: value }));
  }
  function applyEstimate() {
    if (!estimate) return;
    setSettings(current => ({ ...current, targetMode: 'recommended' }));
    setFeedback({ error: false, message: 'แสดงค่าประมาณใหม่แล้ว กดบันทึกเป้าหมายเพื่อยืนยัน' });
  }
  async function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    try {
      const result = await api<{ user: PublicUser }>('/goals', {
        targetWeightKg: Number(targetWeight),
        ...(settings.targetMode === 'manual' ? { dailyCalorieTarget: Number(manualCalories) } : {}),
        goalSettings: { mode: settings.mode, formulaSex: settings.formulaSex, activityLevel: settings.activityLevel, targetMode: settings.targetMode },
      }, 'PUT');
      setManualCalories(String(result.user.dailyCalorieTarget ?? ''));
      onSaved(result.user); setFeedback({ error: false, message: 'บันทึกเป้าหมายเรียบร้อยแล้ว' });
    } catch (error) {
      setFeedback(error instanceof ApiError ? { message: error.message, error: true, fields: error.fields } : { message: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง', error: true });
    } finally { setBusy(false); }
  }

  return <section className="goal-panel ref-goal-card" aria-label="ตั้งเป้าหมาย">
    <FeedbackMessage value={feedback} />
    <form onSubmit={saveGoals}>
      <fieldset disabled={busy} className="goal-form">
        <fieldset className="goal-settings-group">
          <legend>ตั้งค่าการคำนวณ</legend>
          <div className="goal-baseline"><span>TDEE · พลังงานที่ใช้ต่อวันโดยประมาณ</span><strong>{estimate ? `${estimate.tdeeKcal.toLocaleString()} kcal/วัน` : 'ยังประเมินไม่ได้'}</strong></div>
          {issue && <p className="goal-note" role="status">{issue}</p>}
          <div className="goal-mode-options ref-goal-modes" role="radiogroup" aria-label="เลือกแนวทางเป้าหมาย">{Object.entries(goalLabels).map(([key, label]) => <label key={key} className={settings.mode === key ? 'selected' : ''}><input type="radio" name="goalMode" value={key} checked={settings.mode === key} onChange={() => update('mode', key as GoalSettingsInput['mode'])} /><UiIcon name={key === "maintain" ? "scale" : key === "lose" ? "target" : "strength"} size={25} /><strong>{label}</strong></label>)}</div>
          <div className="goal-choice-grid">
            <label>เพศที่ใช้ในสูตรคำนวณ<select required value={formulaSex} onChange={e => { setFormulaSex(e.target.value); update('formulaSex', e.target.value as GoalSettingsInput['formulaSex']); }}><option value="" disabled>เลือกเพื่อคำนวณ TDEE</option><option value="female">หญิง</option><option value="male">ชาย</option></select></label>
            <label className="goal-activity-field">ระดับกิจกรรม<select value={settings.activityLevel} onChange={e => update('activityLevel', e.target.value as GoalSettingsInput['activityLevel'])}>{Object.entries(activityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          </div>
          <details className="goal-explanation"><summary>วิธีคำนวณ</summary><p>{goalLabels[settings.mode]}ใช้ TDEE เป็นฐาน: ลดน้ำหนักประมาณ 90%, รักษาน้ำหนัก 100%, เพิ่มกล้ามเนื้อประมาณ 105% ขึ้นกับเพศที่ใช้ในสูตรและระดับกิจกรรม</p><p>สัดส่วนสารอาหารเป็นค่าตั้งต้นของแอปภายในช่วงอ้างอิงผู้ใหญ่: คาร์บ 45–65%, โปรตีน 10–35%, ไขมัน 20–35% ไม่ใช่สัดส่วนเฉพาะที่เหมาะกับทุกคน คำนวณกรัมจากเป้าหมายพลังงาน โดยคาร์บและโปรตีน 4 kcal/กรัม ไขมัน 9 kcal/กรัม</p><p>การเพิ่มกล้ามเนื้อต้องพิจารณาการฝึกแรงต้านร่วมด้วย แนวทางโปรตีนสำหรับผู้ที่ออกกำลังกายอยู่ที่ประมาณ 1.4–2.0 กรัม/กก./วัน เป้าหมายแบบเปอร์เซ็นต์นี้ยังไม่ได้ปรับตามการฝึกหรือสุขภาพเฉพาะบุคคล</p><p>อ้างอิง: <a href="https://www.nationalacademies.org/read/10872/chapter/13" target="_blank" rel="noreferrer">DRI / AMDR</a> · <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC5477153/" target="_blank" rel="noreferrer">ISSN โปรตีนและการออกกำลังกาย</a> · <a href="https://www.fda.gov/files/food/published/Food-Labeling-Guide-%28PDF%29.pdf" target="_blank" rel="noreferrer">FDA การแปลงพลังงาน</a></p></details>
          <div className="goal-target-options" role="radiogroup" aria-label="วิธีตั้งเป้าพลังงาน">
            <label><input type="radio" name="targetMode" checked={settings.targetMode === 'recommended'} onChange={() => update('targetMode', 'recommended')} disabled={!estimate} /> ใช้ค่าประมาณ {estimate ? `${estimate.targetKcal.toLocaleString()} kcal/วัน` : ''}</label>
            <label><input type="radio" name="targetMode" checked={settings.targetMode === 'manual'} onChange={() => update('targetMode', 'manual')} /> กำหนดเอง</label>
          </div>
          {settings.targetMode === 'manual' && <label className="goal-manual-field">เป้าหมายพลังงานต่อวัน (kcal)<input type="number" min={1000} max={10000} step={1} required value={manualCalories} onChange={e => setManualCalories(e.target.value)} /><small>กำหนดได้ตั้งแต่ 1,000 ถึง 10,000 kcal</small></label>}
          <label className="goal-weight-field">น้ำหนักเป้าหมาย (กก.)<input type="number" min={0.1} max={500} step="0.1" required value={targetWeight} onChange={e => setTargetWeight(e.target.value)} /></label>
        </fieldset>
        <section className="goal-outcome-group" aria-label="ผลลัพธ์หลังบันทึก">
        <div className="ref-goal-compare"><small>เป้าหมายพลังงาน</small><p>ปัจจุบัน: {user.dailyCalorieTarget?.toLocaleString() ?? 'ยังไม่ได้ตั้ง'} kcal/วัน</p><strong>หลังบันทึก: {nextMacros?.caloriesKcal.toLocaleString() ?? '—'} kcal/วัน</strong>
          {profileChanged && <p>ข้อมูลส่วนตัวเปลี่ยนจากตอนคำนวณครั้งล่าสุด</p>}
          {currentIsManual && user.dailyCalorieTarget != null && settings.targetMode === 'recommended' && <p>เป้าหมายปัจจุบันจะเปลี่ยนเมื่อคุณบันทึก</p>}
          {profileChanged && <button className="secondary" type="button" onClick={applyEstimate} disabled={!estimate}>ใช้ค่าประมาณใหม่</button>}
        </div>
        <section className="goal-macro-preview" aria-label="เป้าหมายสารอาหารหลังบันทึก"><h3>สารอาหารหลังบันทึก</h3>{nextMacros ? <><div className="goal-macro-targets">{(['carbs', 'protein', 'fat'] as const).map((key, index) => <div key={key} className={`goal-macro-item ref-${key}`}><span>{['คาร์บ', 'โปรตีน', 'ไขมัน'][index]} · {Math.round(nextMacros.shares[key] * 100)}%</span><strong>{Math.round(nextMacros.grams[key]).toLocaleString()} <small>กรัม/วัน</small></strong></div>)}</div><p>ค่าตั้งต้นโดยประมาณ · เปลี่ยนเป้าหมายจริงเมื่อกดบันทึก</p></> : <p>ระบุเป้าหมายพลังงานที่ถูกต้องเพื่อดูปริมาณสารอาหาร</p>}</section>
        <p className="goal-safety-note">ค่าประมาณเป็นจุดเริ่มต้น ไม่รับประกันผลลัพธ์ และไม่ใช่คำแนะนำทางการแพทย์ สำหรับผู้ใหญ่ที่ไม่ได้ตั้งครรภ์หรือให้นมบุตร</p>
        {!issue && formulaSex && !estimate && <p role="alert" className="goal-note">ข้อมูลร่างกายอยู่นอกช่วงที่ระบบประมาณได้ กรุณาตรวจข้อมูลส่วนตัว</p>}
        <button className="primary" type="submit" disabled={!estimate}>{busy ? 'กำลังบันทึก…' : 'บันทึกเป้าหมาย'}</button>
        </section>
      </fieldset>
    </form>
    {user.targetWeightKg != null && <div className="goal-progress-summary"><p>น้ำหนักปัจจุบัน {user.weightKg ?? '—'} / เป้าหมาย {user.targetWeightKg} กก.</p><p>{difference === null ? 'บันทึกน้ำหนักปัจจุบันเพื่อเทียบกับเป้าหมาย' : difference === 0 ? 'น้ำหนักตรงกับเป้าหมายแล้ว' : `ห่างจากเป้าหมาย ${Math.abs(difference)} กก.`}</p></div>}
  </section>;
}
