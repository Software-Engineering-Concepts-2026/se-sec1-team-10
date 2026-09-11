import { useEffect, useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { api, ApiError } from './api';
import { ExercisePanel } from './ExercisePanel';
import { MealPanel } from './MealPanel';
import { WeeklySummaryPanel } from './WeeklySummaryPanel';
import { DashboardPanel } from './DashboardPanel';
import { GoalPanel } from './GoalPanel';
import { FoodHistoryPanel } from './FoodHistoryPanel';
import { FavoriteMealsPanel } from './FavoriteMealsPanel';
import { ReminderPanel } from './ReminderPanel';
import { HealthTrendPanel } from './HealthTrendPanel';

type Feedback = { message: string; error: boolean; fields?: Record<string, string[]> } | null;
function FeedbackMessage({ value }: { value: Feedback }) {
  return value ? <div className={`feedback ${value.error ? 'error' : 'success'}`} role={value.error ? 'alert' : 'status'}>{value.message}</div> : null;
}
function Field({ name, label, type = 'text', defaultValue, error, ...props }: {
  name: string; label: string; type?: string; defaultValue?: string | number;
  error?: string[]; autoComplete?: string; min?: number; max?: number; minLength?: number;
  maxLength?: number; step?: string; placeholder?: string;
}) {
  return <label className="field" htmlFor={name}>
    <span>{label}</span>
    <input id={name} name={name} type={type} defaultValue={defaultValue} required
      aria-invalid={!!error} aria-describedby={error ? `${name}-error` : undefined} {...props} />
    {error && <small id={`${name}-error`} className="field-error">{error[0]}</small>}
  </label>;
}
function asFeedback(error: unknown): Feedback {
  return error instanceof ApiError ? { message: error.message, error: true, fields: error.fields }
    : { message: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง', error: true };
}

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function loadSession() {
    setLoading(true); setBootError(false);
    try { setUser((await api<{ user: PublicUser }>('/auth/me')).user); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setBootError(true);
    } finally { setLoading(false); }
  }
  useEffect(() => { void loadSession(); }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (mode === 'register' && values.password !== values.confirmPassword) {
      setFeedback({ error: true, message: 'รหัสผ่านทั้งสองช่องไม่ตรงกัน', fields: { confirmPassword: ['กรุณายืนยันรหัสผ่านให้ตรงกัน'] } });
      setBusy(false); return;
    }
    try {
      if (mode === 'register') {
        await api('/auth/register', { email: values.email, password: values.password, displayName: values.displayName });
        setMode('login'); form.reset();
        setFeedback({ error: false, message: 'สมัครสมาชิกสำเร็จ เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของคุณได้เลย' });
      } else {
        setUser((await api<{ user: PublicUser }>('/auth/login', { email: values.email, password: values.password })).user);
        setFeedback(null);
      }
    } catch (error) { setFeedback(asFeedback(error)); }
    finally { setBusy(false); }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setFeedback(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ user: PublicUser }>('/profile', {
        displayName: values.displayName, age: Number(values.age),
        weightKg: Number(values.weightKg), heightCm: Number(values.heightCm),
      }, 'PUT');
      setUser(result.user); setFeedback({ error: false, message: 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว' });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setUser(null);
      setFeedback(asFeedback(error));
    } finally { setBusy(false); }
  }
  async function logout() {
    setBusy(true);
    try { await api('/auth/logout', {}); setUser(null); setMode('login'); setFeedback(null); }
    catch (error) { setFeedback(asFeedback(error)); }
    finally { setBusy(false); }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="/" aria-label="LifeBalance หน้าหลัก"><span className="brand-icon" aria-hidden="true">lb</span>LifeBalance<span className="brand-dot">.</span></a>
      <span className="topbar-note">สุขภาพที่ดี เริ่มจากทุกวัน</span>
      {user && <button className="text-button" onClick={logout} disabled={busy}>ออกจากระบบ ↗</button>}
    </header>
    <main>
      {loading ? <div className="loading" role="status">กำลังโหลดข้อมูล…</div> : bootError ?
        <section className="card connection-error"><h1>ยังเชื่อมต่อระบบไม่ได้</h1><p>กรุณาลองอีกครั้งในอีกสักครู่</p><button className="primary" onClick={loadSession}>ลองอีกครั้ง</button></section> :
      !user ? <div className="auth-layout">
        <section className="intro">
          <span className="eyebrow">YOUR EVERYDAY WELLBEING</span>
          <h1>ดูแลตัวเอง<br />ให้เป็นเรื่อง<span className="accent">ง่าย</span></h1>
          <p>เริ่มต้นดูแลสุขภาพในแบบของคุณ<br />ด้วยข้อมูลส่วนตัวที่พร้อมสำหรับทุกก้าวต่อไป</p>
          <div className="balance-art" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="art-center">สมดุลที่ดี<br /><strong>เริ่มที่คุณ</strong></div><span className="art-leaf leaf-one" /><span className="art-leaf leaf-two" /><span className="art-dot" /></div>
          <span className="intro-footer">ทีละก้าว · ในทุกวัน · ในแบบของคุณ</span>
        </section>
        <section className="card auth-card" aria-labelledby="auth-title">
          <div className="mode-switch" aria-label="เลือกเข้าสู่ระบบหรือสมัครสมาชิก">
            <button aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setFeedback(null); }}>เข้าสู่ระบบ</button>
            <button aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setFeedback(null); }}>สมัครสมาชิก</button>
          </div>
          <span className="eyebrow card-eyebrow">LET’S FIND YOUR BALANCE</span>
          <h2 id="auth-title">{mode === 'login' ? 'ยินดีต้อนรับกลับมา' : 'เริ่มต้นดูแลตัวเอง'}</h2>
          <p className="muted">{mode === 'login' ? 'เข้าสู่ระบบเพื่อจัดการข้อมูลสุขภาพของคุณ' : 'สร้างบัญชีของคุณ ใช้เวลาเพียงนิดเดียว'}</p>
          <FeedbackMessage value={feedback} />
          <form key={mode} onSubmit={authenticate}>
            <fieldset disabled={busy}>
              {mode === 'register' && <Field name="displayName" label="ชื่อที่ใช้แสดง" autoComplete="nickname" maxLength={80} placeholder="คุณชื่ออะไร" error={feedback?.fields?.displayName} />}
              <Field name="email" label="อีเมล" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" error={feedback?.fields?.email} />
              <Field name="password" label="รหัสผ่าน" type="password" minLength={8} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="อย่างน้อย 8 ตัวอักษร" error={feedback?.fields?.password} />
              {mode === 'register' && <Field name="confirmPassword" label="ยืนยันรหัสผ่าน" type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="กรอกรหัสผ่านอีกครั้ง" error={feedback?.fields?.confirmPassword} />}
              <button className="primary" type="submit">{busy ? 'กำลังดำเนินการ…' : mode === 'login' ? 'เข้าสู่ระบบ →' : 'สร้างบัญชี →'}</button>
            </fieldset>
          </form>
          <div className="privacy-note"><span aria-hidden="true">◇</span> ข้อมูลสุขภาพเป็นเรื่องส่วนตัวของคุณ<br /><small>ระบบออกจากเซสชันเมื่อไม่ใช้งาน 30 นาที</small></div>
        </section>
      </div> : <div className="profile-layout">
        <section className="profile-heading"><span className="eyebrow">MY WELLBEING PROFILE</span><h1>สวัสดี, {user.displayName}</h1><p className="muted">ข้อมูลที่เป็นปัจจุบัน ช่วยให้การคำนวณสุขภาพตรงกับคุณ</p></section>
        <div className="profile-grid">
          <aside className="card profile-summary"><div className="avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</div><h2>{user.displayName}</h2><p className="email">{user.email}</p><span className="status-chip">บัญชีของคุณ</span><hr /><h3>ข้อมูลล่าสุด</h3><dl><div><dt>อายุ</dt><dd>{user.age === null ? 'ยังไม่ระบุ' : `${user.age} ปี`}</dd></div><div><dt>น้ำหนัก</dt><dd>{user.weightKg === null ? 'ยังไม่ระบุ' : `${user.weightKg} กก.`}</dd></div><div><dt>ส่วนสูง</dt><dd>{user.heightCm === null ? 'ยังไม่ระบุ' : `${user.heightCm} ซม.`}</dd></div><div><dt>BMI</dt><dd>{user.bmi === null ? 'ต้องระบุน้ำหนักและส่วนสูง' : user.bmi.toFixed(1)}</dd></div></dl></aside>
          <section className="card profile-form"><span className="eyebrow">PERSONAL INFORMATION</span><h2>ข้อมูลส่วนตัว</h2><p className="muted">กรอกข้อมูลให้ครบ แล้วบันทึกเมื่อพร้อม</p><FeedbackMessage value={feedback} />
            <form onSubmit={saveProfile}><fieldset disabled={busy}>
              <Field name="displayName" label="ชื่อที่ใช้แสดง" defaultValue={user.displayName} maxLength={80} autoComplete="nickname" error={feedback?.fields?.displayName} />
              <Field name="age" label="อายุ (ปี)" type="number" min={1} max={120} step="1" defaultValue={user.age ?? ''} error={feedback?.fields?.age} />
              <div className="field-row"><Field name="weightKg" label="น้ำหนัก (กก.)" type="number" min={0.1} max={500} step="0.1" defaultValue={user.weightKg ?? ''} error={feedback?.fields?.weightKg} /><Field name="heightCm" label="ส่วนสูง (ซม.)" type="number" min={30} max={250} step="0.1" defaultValue={user.heightCm ?? ''} error={feedback?.fields?.heightCm} /></div>
              <button className="primary" type="submit">{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูลส่วนตัว →'}</button>
            </fieldset></form>
          </section>
        </div>
        <DashboardPanel user={user} />
        <GoalPanel user={user} onSaved={setUser} />
        <HealthTrendPanel />
        <WeeklySummaryPanel />
        <MealPanel />
        <FavoriteMealsPanel />
        <ReminderPanel />
        <FoodHistoryPanel />
        <ExercisePanel user={user} />
      </div>}
    </main>
    <footer className="site-footer"><span>LifeBalance © 2026</span><span>พื้นที่เล็ก ๆ สำหรับสุขภาพที่ดีของคุณ</span></footer>
  </div>;
}
