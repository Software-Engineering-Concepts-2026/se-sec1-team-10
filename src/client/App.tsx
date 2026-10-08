import { lazy, Suspense, useEffect, useState, type FormEvent } from "react";
import type { PublicUser } from "../shared/contracts";
import { ApiError } from "./api";
import { accountApi } from "./Account";
import { DashboardPanel } from "./DashboardPanel";
import { ReminderObserver } from "./reminders";
import { AccountPanel } from "./AccountPanel";
import { FeedbackMessage, Field, type Feedback } from "./FormFeedback";
import { BrandMark, BrandWordmark, LeafBackdrop, UiIcon } from './Ui';
import { ProfileAvatar } from './ProfileAvatar';
const DiaryPanel = lazy(() =>
  import("./DiaryPanel").then((module) => ({ default: module.DiaryPanel })),
);
const WeeklySummaryPanel = lazy(() =>
  import("./WeeklySummaryPanel").then((module) => ({
    default: module.WeeklySummaryPanel,
  })),
);
const HealthTrendPanel = lazy(() =>
  import("./HealthTrendPanel").then((module) => ({
    default: module.HealthTrendPanel,
  })),
);

type MobileSection = "today" | "diary" | "progress" | "account";

function MobileNav({
  active,
  onChange,
}: {
  active: MobileSection;
  onChange: (section: MobileSection) => void;
}) {
  const items: { id: MobileSection; icon: string; label: string }[] = [
    { id: "today", icon: "home", label: "หน้าแรก" },
    { id: "diary", icon: "plus", label: "บันทึก" },
    { id: "progress", icon: "chart", label: "ความคืบหน้า" },
    { id: "account", icon: "user", label: "บัญชี" },
  ];
  return (
    <nav className="mobile-nav ref-nav" aria-label="เมนูหลัก">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={active === item.id ? "active" : ""}
          aria-current={active === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <UiIcon name={item.icon} />
          {item.label}
        </button>
      ))}
    </nav>
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
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  function navigate(section: MobileSection) {
    setVisitedSections((current) =>
      current.has(section) ? current : new Set(current).add(section),
    );
    setMobileSection(section);
  }

  useEffect(() => { window.scrollTo(0, 0); }, [mobileSection]);

  async function loadSession() {
    setLoading(true);
    setBootError(false);
    try {
      setUser((await accountApi.current()).user);
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 401))
        setBootError(true);
    } finally {
      setLoading(false);
    }
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
      if (mode === "register") {
        await accountApi.register({
          email: String(values.email),
          password: String(values.password),
          displayName: String(values.displayName),
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
            await accountApi.login({
              email: String(values.email),
              password: String(values.password),
            })
          ).user,
        );
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
    try {
      await accountApi.logout();
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
  }

  return (
    <div className={`app-shell ref-app ${!user ? 'ref-guest' : ''}`}>

      <main>
        {loading ? (
          <div className="loading ref-boot" role="status">
            <BrandMark large /><h1>กำลังเชื่อมต่อ</h1>
            <span className="ref-spinner" aria-hidden="true" />
            <p>กำลังตรวจสอบข้อมูลของคุณ กรุณารอสักครู่…</p>
          </div>
        ) : bootError ? (
          <section className="card connection-error">
            <h1>ยังเชื่อมต่อระบบไม่ได้</h1>
            <p>กรุณาลองอีกครั้งในอีกสักครู่</p>
            <button className="primary" onClick={loadSession}>
              ลองอีกครั้ง
            </button>
          </section>
        ) : !user ? (
          <div className="ref-auth">
            <LeafBackdrop />
            <a className="ref-auth-brand" href="/" aria-label="LifeBalance หน้าหลัก"><BrandMark large /><BrandWordmark /><span>ดูแลสุขภาพให้สมดุล<br />ในแบบของคุณ</span></a>

            <section className="ref-auth-form" aria-labelledby="auth-title">

              <h2 id="auth-title" className="ref-auth-title">{mode === 'login' ? 'ยินดีต้อนรับกลับมา' : 'เริ่มต้นดูแลตัวเอง'}</h2>
              <FeedbackMessage value={feedback} />
              <form key={mode} onSubmit={authenticate}>
                <fieldset disabled={busy}>
                  {mode === "register" && (
                    <Field
                      icon="user"
                      name="displayName"
                      label="ชื่อที่ใช้แสดง"
                      autoComplete="nickname"
                      maxLength={80}
                      placeholder="คุณชื่ออะไร"
                      error={feedback?.fields?.displayName}
                    />
                  )}
                  <Field
                    icon="mail"
                    name="email"
                    label="อีเมล"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    placeholder="you@example.com"
                    error={feedback?.fields?.email}
                  />
                  <Field
                    icon="lock"
                    revealPassword
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
                      icon="lock"
                      revealPassword
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
              <p className="ref-auth-switch">{mode === 'login' ? 'ยังไม่มีบัญชี?' : 'มีบัญชีอยู่แล้ว?'}{' '}<button className="text-button" disabled={busy} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setFeedback(null); }}>{mode === 'login' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}</button></p>
            </section>
          </div>
        ) : (
          <div className="profile-layout">
            <ReminderObserver userId={user.id} />
            <div
              className={`mobile-page ${mobileSection === "today" ? "is-active" : ""}`}
            >
              <section className="ref-heading ref-greeting">
                <div className="ref-greeting-copy"><BrandMark /><h1>สวัสดีครับ<br />{user.displayName} <UiIcon name="leaf" size={19} /></h1></div>
                <button type="button" className="ref-avatar" aria-label="เปิดบัญชีของคุณ" onClick={() => navigate('account')}><ProfileAvatar user={user} size={44} /></button>
              </section>
              <DashboardPanel user={user} />
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
                  onLogout={logout}
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
                  <HealthTrendPanel user={user} onUserChanged={setUser} onOpenAccount={() => navigate("account")} />
                  <WeeklySummaryPanel user={user} />
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
                  <DiaryPanel user={user} active={mobileSection === "diary"} />
                </div>
              </Suspense>
            )}
            <MobileNav active={mobileSection} onChange={navigate} />
          </div>
        )}
      </main>

    </div>
  );
}
