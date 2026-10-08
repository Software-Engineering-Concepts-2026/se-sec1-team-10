import {
  lazy,
  Suspense,
  useState,
  useEffect,
  type Dispatch,
  type ChangeEvent,
  type FormEvent,
  type SetStateAction,
} from "react";
import type { PublicUser } from "../shared/contracts";
import { ApiError } from "./api";
import { accountApi } from "./Account";
import { FeedbackMessage, Field, type Feedback } from "./FormFeedback";
import { ProfileAvatar } from "./ProfileAvatar";

import { UiIcon, PageHeading } from './Ui';

const GoalPanel = lazy(() =>
  import("./GoalPanel").then((module) => ({ default: module.GoalPanel })),
);
const ReminderPanel = lazy(() =>
  import("./ReminderPanel").then((module) => ({
    default: module.ReminderPanel,
  })),
);

export function AccountPanel({
  user,
  busy,
  setBusy,
  onUserChanged,
  onLogout,
}: {
  onLogout: () => void;
  user: PublicUser;
  busy: boolean;
  setBusy: Dispatch<SetStateAction<boolean>>;
  onUserChanged: Dispatch<SetStateAction<PublicUser | null>>;
}) {
  const [settingsView, setSettingsView] = useState<
    "profile" | "goals" | "reminders" | null
  >(null);
  const [profileExpanded, setProfileExpanded] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [accountNotice, setAccountNotice] = useState("");
  const [avatarDraft, setAvatarDraft] = useState<string | null | undefined>(undefined);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarDecoding, setAvatarDecoding] = useState(false);
  const [avatarFeedback, setAvatarFeedback] = useState("");
  const [weightDraft, setWeightDraft] = useState(String(user.weightKg ?? ""));
  useEffect(() => {
    if (settingsView === 'profile') setWeightDraft(String(user.weightKg ?? ""));
  }, [settingsView, user.weightKg]);

  async function prepareAvatar(file: File): Promise<string> {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('เลือกรูป JPG, PNG หรือ WEBP เท่านั้น');
    if (file.size > 5 * 1024 * 1024) throw new Error('รูปต้องมีขนาดไม่เกิน 5 MB');
    const source = await createImageBitmap(file).catch(() => { throw new Error('ไฟล์รูปไม่ถูกต้อง'); });
    try {
      if (!source.width || !source.height) throw new Error('ไฟล์รูปไม่ถูกต้อง');
      const side = Math.min(source.width, source.height);
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ไม่สามารถเตรียมรูปได้');
      context.fillStyle = '#fff'; context.fillRect(0, 0, 256, 256);
      context.drawImage(source, (source.width - side) / 2, (source.height - side) / 2, side, side, 0, 0, 256, 256);
      for (const quality of [0.82, 0.68, 0.52, 0.38]) {
        const data = canvas.toDataURL('image/jpeg', quality);
        if (data.length <= 149_000) return data;
      }
      throw new Error('ลดขนาดรูปไม่สำเร็จ กรุณาเลือกรูปอื่น');
    } finally { source.close(); }
  }

  async function saveAvatar() {
    if (avatarDraft === undefined || avatarBusy || avatarDecoding || busy) return;
    setAvatarBusy(true); setBusy(true); setAvatarFeedback("");
    try {
      const result = await accountApi.updateAvatar(avatarDraft);
      onUserChanged(result.user); setAvatarDraft(undefined); setAvatarFeedback('บันทึกรูปโปรไฟล์แล้ว');
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onUserChanged(null);
      setAvatarFeedback(error instanceof ApiError ? error.message : 'บันทึกรูปไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally { setAvatarBusy(false); setBusy(false); }
  }

  async function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || avatarBusy || avatarDecoding || busy) return;
    setAvatarDecoding(true); setBusy(true); setAvatarFeedback("");
    try { setAvatarDraft(await prepareAvatar(file)); }
    catch (error) { setAvatarFeedback(error instanceof Error ? error.message : 'ไฟล์รูปไม่ถูกต้อง'); }
    finally { setAvatarDecoding(false); setBusy(false); }
  }

  useEffect(() => { window.scrollTo(0, 0); }, [settingsView]);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || avatarBusy || avatarDecoding) return;
    setBusy(true);
    setFeedback(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await accountApi.updateProfile({
        displayName: String(values.displayName).trim(),
        age: Number(values.age),
        weightKg: Number(values.weightKg),
        heightCm: Number(values.heightCm),
      });
      onUserChanged(result.user);
      window.dispatchEvent(new Event("profile-updated"));
      setAccountNotice("บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว");
      setSettingsView(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        onUserChanged(null);
      setFeedback(
        error instanceof ApiError
          ? { message: error.message, error: true, fields: error.fields }
          : { message: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", error: true },
      );
    } finally {
      setBusy(false);
    }
  }

  const logoutButton = <button type="button" className="text-button ref-logout" aria-label="ออกจากระบบ ↗" disabled={busy || avatarBusy || avatarDecoding} onClick={onLogout}>ออกจากระบบ <UiIcon name="logout" size={16} /></button>;
  const metric = (value: number | null, unit: string) => value == null ? '—' : `${value} ${unit}`;
  return <div className="ref-account">
    {settingsView === null ? <>
      <PageHeading title="บัญชี" />
      {accountNotice && <p className="feedback success" role="status">{accountNotice}</p>}
      <section className="ref-profile-card">
        <ProfileAvatar user={{ ...user, avatarImageData: avatarDraft === undefined ? user.avatarImageData : avatarDraft }} size={72} className="account-profile-avatar" /><h2>{user.displayName}</h2><p className="email">{user.email}</p>
        <div className="profile-photo-actions"><label className="text-button">{avatarDecoding ? 'กำลังเตรียมรูป…' : user.avatarImageData ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}<input className="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || avatarBusy || avatarDecoding} onChange={event => void chooseAvatar(event)} /></label>{user.avatarImageData && <button className="text-button" type="button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => { setAvatarDraft(null); setAvatarFeedback('เลือกลบรูปแล้ว กดบันทึกเพื่อยืนยัน'); }}>ลบรูป</button>}{avatarDraft !== undefined && <><button type="button" className="text-button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => void saveAvatar()}>{avatarBusy ? 'กำลังบันทึก…' : 'บันทึกรูป'}</button><button type="button" className="text-button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => { setAvatarDraft(undefined); setAvatarFeedback(''); }}>ยกเลิก</button></>}</div>
        {avatarFeedback && <p className="profile-photo-error" role="status">{avatarFeedback}</p>}
        <button type="button" className="text-button profile-toggle" aria-expanded={profileExpanded} onClick={() => setProfileExpanded(v => !v)}>{profileExpanded ? 'ซ่อนข้อมูลโปรไฟล์' : 'ดูข้อมูลโปรไฟล์'}</button>
        {profileExpanded && <div className="ref-profile-details"><h3>ข้อมูลล่าสุด</h3><p>อายุ {metric(user.age,'ปี')} · น้ำหนัก {metric(user.weightKg,'กก.')} · ส่วนสูง {metric(user.heightCm,'ซม.')} · BMI {user.bmi?.toFixed(1) ?? '—'}</p></div>}
      </section>
      <div className="ref-menu" aria-label="หัวข้อตั้งค่า">{([{id:'profile', icon:'user', title:'ข้อมูลส่วนตัว', detail:'ข้อมูลพื้นฐานของคุณ'}, {id:'goals', icon:'target', title:'เป้าหมายสุขภาพ', detail:'ตั้งเป้าพลังงานและน้ำหนัก'}, {id:'reminders', icon:'bell', title:'แจ้งเตือนมื้ออาหาร', detail:'ตั้งเวลาสำหรับอุปกรณ์นี้'}] as const).map(item => <button type="button" key={item.id} onClick={() => { setFeedback(null); setAccountNotice(''); setSettingsView(item.id); }}><UiIcon name={item.icon} /><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="ref-chevron" aria-hidden="true">›</span></button>)}</div>
      <div className="ref-logout-area">{logoutButton}</div>
    </> : <>
      <PageHeading title={settingsView === 'profile' ? 'ข้อมูลส่วนตัว' : settingsView === 'goals' ? 'ตั้งเป้าหมาย' : 'เตือนมื้ออาหาร'} onBack={() => setSettingsView(null)} />
      {settingsView === 'profile' && <section className="ref-form profile-form"><p className="muted">กรอกข้อมูลให้ครบ แล้วบันทึกเมื่อพร้อม</p><FeedbackMessage value={feedback} />
            <div className="profile-photo-editor"><ProfileAvatar user={{ ...user, avatarImageData: avatarDraft === undefined ? user.avatarImageData : avatarDraft }} size={88} className="profile-photo-preview" /><div className="profile-photo-actions"><label className="text-button">{avatarDecoding ? 'กำลังเตรียมรูป…' : user.avatarImageData ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}<input className="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || avatarBusy || avatarDecoding} onChange={event => void chooseAvatar(event)} /></label>{user.avatarImageData && <button type="button" className="text-button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => { setAvatarDraft(null); setAvatarFeedback('เลือกลบรูปแล้ว กดบันทึกเพื่อยืนยัน'); }}>ลบรูป</button>}{avatarDraft !== undefined && <><button type="button" className="text-button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => void saveAvatar()}>{avatarBusy ? 'กำลังบันทึก…' : 'บันทึกรูป'}</button><button type="button" className="text-button" disabled={busy || avatarBusy || avatarDecoding} onClick={() => { setAvatarDraft(undefined); setAvatarFeedback(''); }}>ยกเลิก</button></>}</div></div>{avatarFeedback && <p className="profile-photo-error" role="status">{avatarFeedback}</p>}
            <form onSubmit={saveProfile}>
              <fieldset disabled={busy || avatarBusy || avatarDecoding}>
                <Field
                  name="displayName"
                  label="ชื่อที่ใช้แสดง"
                  defaultValue={user.displayName}
                  maxLength={80}
                  autoComplete="nickname"
                  error={feedback?.fields?.displayName}
                />
                <Field
                  name="age"
                  label="อายุ (ปี)"
                  type="number"
                  min={1}
                  max={120}
                  step="1"
                  defaultValue={user.age ?? ""}
                  error={feedback?.fields?.age}
                />
                <div className="field-row">
                  <label className="field" htmlFor="weightKg">
                    <span>น้ำหนัก (กก.)</span>
                    <span className="field-input"><input id="weightKg" name="weightKg" aria-label="น้ำหนัก (กก.)" type="number" min={0.1} max={500} step="0.1" required value={weightDraft} onChange={(event) => setWeightDraft(event.target.value)} aria-invalid={!!feedback?.fields?.weightKg} aria-describedby={feedback?.fields?.weightKg ? 'weightKg-error' : undefined} /></span>
                    {feedback?.fields?.weightKg && <small id="weightKg-error" className="field-error">{feedback.fields.weightKg[0]}</small>}
                  </label>
                  <Field
                    name="heightCm"
                    label="ส่วนสูง (ซม.)"
                    type="number"
                    min={30}
                    max={250}
                    step="0.1"
                    defaultValue={user.heightCm ?? ""}
                    error={feedback?.fields?.heightCm}
                  />
                </div>
                <button className="primary" type="submit">
                  {busy ? "กำลังบันทึก…" : "บันทึกข้อมูลส่วนตัว →"}
                </button>
              </fieldset>
            </form>
      </section>}
      {settingsView === 'goals' && <Suspense fallback={<p role="status">กำลังโหลดเป้าหมาย…</p>}><GoalPanel user={user} onSaved={(nextUser) => { onUserChanged(nextUser); setAccountNotice('บันทึกเป้าหมายเรียบร้อยแล้ว'); setSettingsView(null); }} /></Suspense>}
      {settingsView === 'reminders' && <Suspense fallback={<p role="status">กำลังโหลดการแจ้งเตือน…</p>}><ReminderPanel userId={user.id} /></Suspense>}
    </>}
  </div>;
}
