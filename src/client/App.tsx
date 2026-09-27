<<<<<<< HEAD
import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { ApiError } from './api';
import { accountApi } from './Account';
import { AccountPanel } from './AccountPanel';
import { DashboardPanel } from './DashboardPanel';
import { ReminderObserver } from './reminders';
const ExercisePanel = lazy(() => import('./ExercisePanel').then(module => ({ default: module.ExercisePanel })));
const MealPanel = lazy(() => import('./MealPanel').then(module => ({ default: module.MealPanel })));
const WeeklySummaryPanel = lazy(() => import('./WeeklySummaryPanel').then(module => ({ default: module.WeeklySummaryPanel })));
const GoalPanel = lazy(() => import('./GoalPanel').then(module => ({ default: module.GoalPanel })));
const FoodHistoryPanel = lazy(() => import('./FoodHistoryPanel').then(module => ({ default: module.FoodHistoryPanel })));
const FavoriteMealsPanel = lazy(() => import('./FavoriteMealsPanel').then(module => ({ default: module.FavoriteMealsPanel })));
const ReminderPanel = lazy(() => import('./ReminderPanel').then(module => ({ default: module.ReminderPanel })));
const HealthTrendPanel = lazy(() => import('./HealthTrendPanel').then(module => ({ default: module.HealthTrendPanel })));
=======
import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import type { PublicUser } from "../shared/contracts";
import { api, ApiError } from "./api";
import { DashboardPanel } from "./DashboardPanel";
import { ReminderObserver } from "./reminders";
import { AccountPanel } from "./AccountPanel";
import { FeedbackMessage, Field, type Feedback } from "./FormFeedback";
const ExercisePanel = lazy(() =>
  import("./ExercisePanel").then((module) => ({
    default: module.ExercisePanel,
  })),
);
const MealPanel = lazy(() =>
  import("./MealPanel").then((module) => ({ default: module.MealPanel })),
);
const WeeklySummaryPanel = lazy(() =>
  import("./WeeklySummaryPanel").then((module) => ({
    default: module.WeeklySummaryPanel,
  })),
);
const FoodHistoryPanel = lazy(() =>
  import("./FoodHistoryPanel").then((module) => ({
    default: module.FoodHistoryPanel,
  })),
);
const FavoriteMealsPanel = lazy(() =>
  import("./FavoriteMealsPanel").then((module) => ({
    default: module.FavoriteMealsPanel,
  })),
);
const HealthTrendPanel = lazy(() =>
  import("./HealthTrendPanel").then((module) => ({
    default: module.HealthTrendPanel,
  })),
);
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e

type MobileSection = "today" | "diary" | "progress" | "account";

function MobileNav({
  active,
  onChange,
}: {
  active: MobileSection;
  onChange: (section: MobileSection) => void;
}) {
  const items: { id: MobileSection; icon: string; label: string }[] = [
    { id: "today", icon: "home", label: "วันนี้" },
    { id: "diary", icon: "plus", label: "บันทึก" },
    { id: "progress", icon: "chart", label: "ความคืบหน้า" },
    { id: "account", icon: "user", label: "บัญชี" },
  ];
  return (
    <nav className="mobile-nav" aria-label="เมนูหลัก">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <use href={`#icon-${item.icon}`} />
            </svg>
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}
function IconSprite() {
  return (
    <svg aria-hidden="true" width="0" height="0" className="icon-sprite">
      <symbol id="icon-home" viewBox="0 0 24 24">
        <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1V10Z" />
      </symbol>
      <symbol id="icon-plus" viewBox="0 0 24 24">
        <path d="M12 5v14M5 12h14" />
      </symbol>
      <symbol id="icon-chart" viewBox="0 0 24 24">
        <path d="M5 19V9m7 10V5m7 14v-7" />
      </symbol>
      <symbol id="icon-user" viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.4 3-5 7-5s6.3 1.6 7 5" />
      </symbol>
    </svg>
  );
}
function asFeedback(error: unknown): Feedback {
  return error instanceof ApiError
    ? { message: error.message, error: true, fields: error.fields }
    : { message: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", error: true };
}

export function App() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootError, setBootError] = useState(false);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mobileSection, setMobileSection] = useState<MobileSection>("today");
  const [visitedSections, setVisitedSections] = useState<Set<MobileSection>>(
    () => new Set(["today"]),
  );
  const [diaryView, setDiaryView] = useState<"food" | "activity" | "history">(
    "food",
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  function navigate(section: MobileSection) {
    setVisitedSections((current) =>
      current.has(section) ? current : new Set(current).add(section),
    );
    setMobileSection(section);
  }

  async function loadSession() {
<<<<<<< HEAD
    setLoading(true); setBootError(false);
    try { setUser((await accountApi.current()).user); }
    catch (error) {
      if (!(error instanceof ApiError && error.status === 401)) setBootError(true);
    } finally { setLoading(false); }
=======
    setLoading(true);
    setBootError(false);
    try {
      setUser((await api<{ user: PublicUser }>("/auth/me")).user);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setBootError(true);
    } finally {
      setLoading(false);
    }
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e
  }
  useEffect(() => {
    void loadSession();
  }, []);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (mode === "register" && values.password !== values.confirmPassword) {
      setFeedback({
        error: true,
        message: "รหัสผ่านทั้งสองช่องไม่ตรงกัน",
        fields: { confirmPassword: ["กรุณายืนยันรหัสผ่านให้ตรงกัน"] },
      });
      setBusy(false);
      return;
    }
    try {
<<<<<<< HEAD
      if (mode === 'register') {
        await accountApi.register({ email: String(values.email), password: String(values.password), displayName: String(values.displayName) });
        setMode('login'); form.reset();
        setFeedback({ error: false, message: 'สมัครสมาชิกสำเร็จ เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของคุณได้เลย' });
      } else {
        setUser((await accountApi.login({ email: String(values.email), password: String(values.password) })).user);
=======
      if (mode === "register") {
        await api("/auth/register", {
          email: values.email,
          password: values.password,
          displayName: values.displayName,
        });
        setMode("login");
        form.reset();
        setFeedback({
          error: false,
          message:
            "สมัครสมาชิกสำเร็จ เข้าสู่ระบบด้วยอีเมลและรหัสผ่านของคุณได้เลย",
        });
      } else {
        setUser(
          (
            await api<{ user: PublicUser }>("/auth/login", {
              email: values.email,
              password: values.password,
            })
          ).user,
        );
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e
        setFeedback(null);
      }
    } catch (error) {
      setFeedback(asFeedback(error));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
<<<<<<< HEAD
    try { await accountApi.logout(); setUser(null); setMode('login'); setFeedback(null); setMobileSection('today'); setVisitedSections(new Set(['today'])); setSettingsView(null); }
    catch (error) { setFeedback(asFeedback(error)); }
    finally { setBusy(false); }
=======
    try {
      await api("/auth/logout", {});
      setUser(null);
      setMode("login");
      setFeedback(null);
      setMobileSection("today");
      setVisitedSections(new Set(["today"]));
    } catch (error) {
      setFeedback(asFeedback(error));
    } finally {
      setBusy(false);
    }
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e
  }

  return (
    <div className="app-shell">
      <IconSprite />
      <header className="topbar">
        <a className="brand" href="/" aria-label="LifeBalance หน้าหลัก">
          <span className="brand-icon" aria-hidden="true">
            lb
          </span>
          LifeBalance<span className="brand-dot">.</span>
        </a>
        <span className="topbar-note">สุขภาพที่ดี เริ่มจากทุกวัน</span>
        {user && (
          <button className="text-button" onClick={logout} disabled={busy}>
            ออกจากระบบ ↗
          </button>
        )}
      </header>
      <main>
        {loading ? (
          <div className="loading" role="status">
            กำลังโหลดข้อมูล…
          </div>
<<<<<<< HEAD
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
        <ReminderObserver userId={user.id} />
        <div className={`mobile-page ${mobileSection === 'today' ? 'is-active' : ''}`}>
        <section className="profile-heading"><span className="eyebrow">YOUR DAILY BALANCE</span><h1>สวัสดี, {user.displayName} <span>✦</span></h1><p className="muted">วันนี้ดูแลตัวเองได้อีกนิดนะ</p></section>
        <DashboardPanel user={user} />
        <button type="button" className="mobile-quick-log" onClick={() => navigate('diary')}>＋ บันทึกอาหารของวันนี้</button>
        </div>
        {visitedSections.has('account') && <Suspense fallback={<div className={`mobile-page ${mobileSection === 'account' ? 'is-active' : ''} loading`} role="status">กำลังเตรียมพื้นที่…</div>}><div className={`mobile-page ${mobileSection === 'account' ? 'is-active' : ''}`}>
        <div className="profile-grid">
          <aside className="card profile-summary"><div className="avatar" aria-hidden="true">{user.displayName.slice(0, 1)}</div><h2>{user.displayName}</h2><p className="email">{user.email}</p><span className="status-chip">บัญชีของคุณ</span><hr /><h3>ข้อมูลล่าสุด</h3><dl><div><dt>อายุ</dt><dd>{user.age === null ? 'ยังไม่ระบุ' : `${user.age} ปี`}</dd></div><div><dt>น้ำหนัก</dt><dd>{user.weightKg === null ? 'ยังไม่ระบุ' : `${user.weightKg} กก.`}</dd></div><div><dt>ส่วนสูง</dt><dd>{user.heightCm === null ? 'ยังไม่ระบุ' : `${user.heightCm} ซม.`}</dd></div><div><dt>BMI</dt><dd>{user.bmi === null ? 'ต้องระบุน้ำหนักและส่วนสูง' : user.bmi.toFixed(1)}</dd></div></dl></aside>
          <section className="card profile-form"><span className="eyebrow">SETTINGS</span><h2>ตั้งค่า</h2><p className="muted">เลือกหัวข้อที่ต้องการแก้ไข</p>
            <div className="settings-menu" aria-label="หัวข้อตั้งค่า">
              <button type="button" className="secondary" onClick={() => setSettingsView(current => current === 'profile' ? null : 'profile')}>ข้อมูลส่วนตัว <span>›</span></button>
              <button type="button" className="secondary" onClick={() => setSettingsView(current => current === 'goals' ? null : 'goals')}>เป้าหมายสุขภาพ <span>›</span></button>
              <button type="button" className="secondary" onClick={() => setSettingsView(current => current === 'reminders' ? null : 'reminders')}>แจ้งเตือนมื้ออาหาร <span>›</span></button>
            </div>
            {settingsView === 'profile' && <div className="settings-detail"><AccountPanel user={user} onSaved={setUser} onSessionExpired={() => setUser(null)} /></div>}
            {settingsView === 'goals' && <div className="settings-detail"><GoalPanel user={user} onSaved={setUser} /></div>}
            {settingsView === 'reminders' && <div className="settings-detail"><ReminderPanel userId={user.id} /></div>}
=======
        ) : bootError ? (
          <section className="card connection-error">
            <h1>ยังเชื่อมต่อระบบไม่ได้</h1>
            <p>กรุณาลองอีกครั้งในอีกสักครู่</p>
            <button className="primary" onClick={loadSession}>
              ลองอีกครั้ง
            </button>
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e
          </section>
        ) : !user ? (
          <div className="auth-layout">
            <section className="intro">
              <span className="eyebrow">YOUR EVERYDAY WELLBEING</span>
              <h1>
                ดูแลตัวเอง
                <br />
                ให้เป็นเรื่อง<span className="accent">ง่าย</span>
              </h1>
              <p>
                เริ่มต้นดูแลสุขภาพในแบบของคุณ
                <br />
                ด้วยข้อมูลส่วนตัวที่พร้อมสำหรับทุกก้าวต่อไป
              </p>
              <div className="balance-art" aria-hidden="true">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="art-center">
                  สมดุลที่ดี
                  <br />
                  <strong>เริ่มที่คุณ</strong>
                </div>
                <span className="art-leaf leaf-one" />
                <span className="art-leaf leaf-two" />
                <span className="art-dot" />
              </div>
              <span className="intro-footer">
                ทีละก้าว · ในทุกวัน · ในแบบของคุณ
              </span>
            </section>
            <section className="card auth-card" aria-labelledby="auth-title">
              <div
                className="mode-switch"
                aria-label="เลือกเข้าสู่ระบบหรือสมัครสมาชิก"
              >
                <button
                  aria-pressed={mode === "login"}
                  disabled={busy}
                  onClick={() => {
                    setMode("login");
                    setFeedback(null);
                  }}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  aria-pressed={mode === "register"}
                  disabled={busy}
                  onClick={() => {
                    setMode("register");
                    setFeedback(null);
                  }}
                >
                  สมัครสมาชิก
                </button>
              </div>
              <span className="eyebrow card-eyebrow">
                LET’S FIND YOUR BALANCE
              </span>
              <h2 id="auth-title">
                {mode === "login" ? "ยินดีต้อนรับกลับมา" : "เริ่มต้นดูแลตัวเอง"}
              </h2>
              <p className="muted">
                {mode === "login"
                  ? "เข้าสู่ระบบเพื่อจัดการข้อมูลสุขภาพของคุณ"
                  : "สร้างบัญชีของคุณ ใช้เวลาเพียงนิดเดียว"}
              </p>
              <FeedbackMessage value={feedback} />
              <form key={mode} onSubmit={authenticate}>
                <fieldset disabled={busy}>
                  {mode === "register" && (
                    <Field
                      name="displayName"
                      label="ชื่อที่ใช้แสดง"
                      autoComplete="nickname"
                      maxLength={80}
                      placeholder="คุณชื่ออะไร"
                      error={feedback?.fields?.displayName}
                    />
                  )}
                  <Field
                    name="email"
                    label="อีเมล"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                    error={feedback?.fields?.email}
                  />
                  <Field
                    name="password"
                    label="รหัสผ่าน"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    error={feedback?.fields?.password}
                  />
                  {mode === "register" && (
                    <Field
                      name="confirmPassword"
                      label="ยืนยันรหัสผ่าน"
                      type="password"
                      minLength={8}
                      maxLength={128}
                      autoComplete="new-password"
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      error={feedback?.fields?.confirmPassword}
                    />
                  )}
                  <button className="primary" type="submit">
                    {busy
                      ? "กำลังดำเนินการ…"
                      : mode === "login"
                        ? "เข้าสู่ระบบ →"
                        : "สร้างบัญชี →"}
                  </button>
                </fieldset>
              </form>
              <div className="privacy-note">
                <span aria-hidden="true">◇</span>{" "}
                ข้อมูลสุขภาพเป็นเรื่องส่วนตัวของคุณ
                <br />
                <small>ระบบออกจากเซสชันเมื่อไม่ใช้งาน 30 นาที</small>
              </div>
            </section>
          </div>
        ) : (
          <div className="profile-layout">
            <ReminderObserver userId={user.id} />
            <div
              className={`mobile-page ${mobileSection === "today" ? "is-active" : ""}`}
            >
              <section className="profile-heading">
                <span className="eyebrow">YOUR DAILY BALANCE</span>
                <h1>
                  สวัสดี, {user.displayName} <span>✦</span>
                </h1>
                <p className="muted">วันนี้ดูแลตัวเองได้อีกนิดนะ</p>
              </section>
              <DashboardPanel user={user} />
              <button
                type="button"
                className="mobile-quick-log"
                onClick={() => navigate("diary")}
              >
                ＋ บันทึกอาหารของวันนี้
              </button>
            </div>
            {visitedSections.has("account") && (
              <div
                className={`mobile-page ${mobileSection === "account" ? "is-active" : ""}`}
              >
                <AccountPanel
                  user={user}
                  busy={busy}
                  setBusy={setBusy}
                  onUserChanged={setUser}
                />
              </div>
            )}
            {visitedSections.has("progress") && (
              <Suspense
                fallback={
                  <div
                    className={`mobile-page ${mobileSection === "progress" ? "is-active" : ""} loading`}
                    role="status"
                  >
                    กำลังโหลดความคืบหน้า…
                  </div>
                }
              >
                <div
                  className={`mobile-page ${mobileSection === "progress" ? "is-active" : ""}`}
                >
                  <section className="profile-heading">
                    <span className="eyebrow">YOUR PROGRESS</span>
                    <h1>ความคืบหน้าของคุณ</h1>
                    <p className="muted">
                      ติดตามแนวโน้มและผลลัพธ์จากเป้าหมายที่ตั้งไว้
                    </p>
                  </section>
                  <HealthTrendPanel />
                  <WeeklySummaryPanel />
                </div>
              </Suspense>
            )}
            {visitedSections.has("diary") && (
              <Suspense
                fallback={
                  <div
                    className={`mobile-page ${mobileSection === "diary" ? "is-active" : ""} loading`}
                    role="status"
                  >
                    กำลังโหลดบันทึก…
                  </div>
                }
              >
                <div
                  className={`mobile-page ${mobileSection === "diary" ? "is-active" : ""}`}
                >
                  <div
                    className="diary-switcher"
                    role="tablist"
                    aria-label="หมวดบันทึก"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diaryView === "food"}
                      className={diaryView === "food" ? "active" : ""}
                      onClick={() => setDiaryView("food")}
                    >
                      อาหาร
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diaryView === "activity"}
                      className={diaryView === "activity" ? "active" : ""}
                      onClick={() => setDiaryView("activity")}
                    >
                      กิจกรรม
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={diaryView === "history"}
                      className={diaryView === "history" ? "active" : ""}
                      onClick={() => setDiaryView("history")}
                    >
                      ประวัติ
                    </button>
                  </div>
                  <div
                    className={`diary-view ${diaryView === "food" ? "is-active" : ""}`}
                  >
                    <MealPanel userId={user.id} />
                    <FavoriteMealsPanel userId={user.id} />
                  </div>
                  <div
                    className={`diary-view ${diaryView === "activity" ? "is-active" : ""}`}
                  >
                    <ExercisePanel user={user} />
                  </div>
                  <div
                    className={`diary-view ${diaryView === "history" ? "is-active" : ""}`}
                  >
                    <FoodHistoryPanel />
                  </div>
                </div>
              </Suspense>
            )}
            <MobileNav active={mobileSection} onChange={navigate} />
          </div>
        )}
      </main>
      <footer className="site-footer">
        <span>LifeBalance © 2026</span>
        <span>พื้นที่เล็ก ๆ สำหรับสุขภาพที่ดีของคุณ</span>
      </footer>
    </div>
  );
}
