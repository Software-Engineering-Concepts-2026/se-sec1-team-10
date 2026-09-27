<<<<<<< HEAD
import { useState, type FormEvent } from 'react';
import type { PublicUser } from '../shared/contracts';
import { accountApi, type AccountProfile } from './Account';
import { ApiError } from './api';

type ProfileForm = Record<keyof AccountProfile, string>;
type Feedback = { message: string; error: boolean; fields?: Record<string, string[]> } | null;

const formFromUser = (user: PublicUser): ProfileForm => ({
	displayName: user.displayName,
	age: user.age === null ? '' : String(user.age),
	weightKg: user.weightKg === null ? '' : String(user.weightKg),
	heightCm: user.heightCm === null ? '' : String(user.heightCm),
});

function ProfileField({
	name, label, value, type = 'text', min, max, step, maxLength, error, onChange,
}: {
	name: keyof AccountProfile;
	label: string;
	value: string;
	type?: string;
	min?: number;
	max?: number;
	step?: string;
	maxLength?: number;
	error?: string[];
	onChange: (value: string) => void;
}) {
	const errorId = `${name}-error`;
	return <label className="field" htmlFor={name}>
		<span>{label}</span>
		<input id={name} name={name} type={type} value={value} min={min} max={max} step={step}
			maxLength={maxLength} required aria-invalid={Boolean(error)}
			aria-describedby={error ? errorId : undefined} onChange={event => onChange(event.target.value)} />
		{error && <small id={errorId} className="field-error">{error[0]}</small>}
	</label>;
}

export function AccountPanel({ user, onSaved, onSessionExpired }: {
	user: PublicUser;
	onSaved: (user: PublicUser) => void;
	onSessionExpired?: () => void;
}) {
	const [form, setForm] = useState(() => formFromUser(user));
	const [busy, setBusy] = useState(false);
	const [feedback, setFeedback] = useState<Feedback>(null);

	function updateField(name: keyof AccountProfile, value: string) {
		setForm(current => ({ ...current, [name]: value }));
		setFeedback(null);
	}

	async function saveProfile(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setBusy(true);
		setFeedback(null);
		try {
			const profile: AccountProfile = {
				displayName: form.displayName.trim(),
				age: Number(form.age),
				weightKg: Number(form.weightKg),
				heightCm: Number(form.heightCm),
			};
			const result = await accountApi.updateProfile(profile);
			setForm(formFromUser(result.user));
			onSaved(result.user);
			window.dispatchEvent(new Event('profile-updated'));
			setFeedback({ error: false, message: 'บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว' });
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) onSessionExpired?.();
			setFeedback(error instanceof ApiError
				? { error: true, message: error.message, fields: error.fields }
				: { error: true, message: 'เกิดข้อผิดพลาด กรุณาลองอีกครั้ง' });
		} finally {
			setBusy(false);
		}
	}

	return <div className="account-panel">
		<h3>ข้อมูลส่วนตัว</h3>
		<p className="muted">แก้ไขข้อมูลที่ใช้ในการคำนวณสุขภาพ</p>
		{feedback && <div className={`feedback ${feedback.error ? 'error' : 'success'}`}
			role={feedback.error ? 'alert' : 'status'}>{feedback.message}</div>}
		<form onSubmit={saveProfile}>
			<fieldset disabled={busy}>
				<ProfileField name="displayName" label="ชื่อที่ใช้แสดง" value={form.displayName}
					maxLength={80} error={feedback?.fields?.displayName}
					onChange={value => updateField('displayName', value)} />
				<ProfileField name="age" label="อายุ (ปี)" type="number" value={form.age}
					min={1} max={120} step="1" error={feedback?.fields?.age}
					onChange={value => updateField('age', value)} />
				<div className="field-row">
					<ProfileField name="weightKg" label="น้ำหนัก (กก.)" type="number" value={form.weightKg}
						min={0.1} max={500} step="0.1" error={feedback?.fields?.weightKg}
						onChange={value => updateField('weightKg', value)} />
					<ProfileField name="heightCm" label="ส่วนสูง (ซม.)" type="number" value={form.heightCm}
						min={30} max={250} step="0.1" error={feedback?.fields?.heightCm}
						onChange={value => updateField('heightCm', value)} />
				</div>
				<button className="primary" type="submit">
					{busy ? 'กำลังบันทึก…' : 'บันทึกข้อมูลส่วนตัว →'}
				</button>
			</fieldset>
		</form>
	</div>;
=======
import {
  lazy,
  Suspense,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import type { PublicUser } from "../shared/contracts";
import { api, ApiError } from "./api";
import { FeedbackMessage, Field, type Feedback } from "./FormFeedback";

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
}: {
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

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await api<{ user: PublicUser }>(
        "/profile",
        {
          displayName: values.displayName,
          age: Number(values.age),
          weightKg: Number(values.weightKg),
          heightCm: Number(values.heightCm),
        },
        "PUT",
      );
      onUserChanged(result.user);
      window.dispatchEvent(new Event("profile-updated"));
      setFeedback({
        error: false,
        message: "บันทึกข้อมูลส่วนตัวเรียบร้อยแล้ว",
      });
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

  return (
    <div className="profile-grid">
      <aside className="card profile-summary">
        <div className="avatar" aria-hidden="true">
          {user.displayName.slice(0, 1)}
        </div>
        <h2>{user.displayName}</h2>
        <p className="email">{user.email}</p>
        <button
          type="button"
          className="secondary profile-toggle"
          aria-expanded={profileExpanded}
          onClick={() => setProfileExpanded((current) => !current)}
        >
          {profileExpanded ? "ซ่อนข้อมูลโปรไฟล์" : "ดูข้อมูลโปรไฟล์"}{" "}
          <span aria-hidden="true">{profileExpanded ? "⌃" : "›"}</span>
        </button>
        {profileExpanded && (
          <>
            <span className="status-chip">บัญชีของคุณ</span>
            <hr />
            <h3>ข้อมูลล่าสุด</h3>
            <dl>
              <div>
                <dt>อายุ</dt>
                <dd>{user.age === null ? "ยังไม่ระบุ" : `${user.age} ปี`}</dd>
              </div>
              <div>
                <dt>น้ำหนัก</dt>
                <dd>
                  {user.weightKg === null
                    ? "ยังไม่ระบุ"
                    : `${user.weightKg} กก.`}
                </dd>
              </div>
              <div>
                <dt>ส่วนสูง</dt>
                <dd>
                  {user.heightCm === null
                    ? "ยังไม่ระบุ"
                    : `${user.heightCm} ซม.`}
                </dd>
              </div>
              <div>
                <dt>BMI</dt>
                <dd>
                  {user.bmi === null
                    ? "ต้องระบุน้ำหนักและส่วนสูง"
                    : user.bmi.toFixed(1)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </aside>
      <section className="card profile-form">
        <span className="eyebrow">SETTINGS</span>
        <h2>ตั้งค่า</h2>
        <p className="muted">เลือกหัวข้อที่ต้องการแก้ไข</p>
        <div className="settings-menu" aria-label="หัวข้อตั้งค่า">
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setSettingsView((current) =>
                current === "profile" ? null : "profile",
              )
            }
          >
            ข้อมูลส่วนตัว <span>›</span>
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setSettingsView((current) =>
                current === "goals" ? null : "goals",
              )
            }
          >
            เป้าหมายสุขภาพ <span>›</span>
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setSettingsView((current) =>
                current === "reminders" ? null : "reminders",
              )
            }
          >
            แจ้งเตือนมื้ออาหาร <span>›</span>
          </button>
        </div>
        {settingsView === "profile" && (
          <div className="settings-detail">
            <h3>ข้อมูลส่วนตัว</h3>
            <p className="muted">กรอกข้อมูลให้ครบ แล้วบันทึกเมื่อพร้อม</p>
            <FeedbackMessage value={feedback} />
            <form onSubmit={saveProfile}>
              <fieldset disabled={busy}>
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
                  <Field
                    name="weightKg"
                    label="น้ำหนัก (กก.)"
                    type="number"
                    min={0.1}
                    max={500}
                    step="0.1"
                    defaultValue={user.weightKg ?? ""}
                    error={feedback?.fields?.weightKg}
                  />
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
          </div>
        )}
        {settingsView === "goals" && (
          <div className="settings-detail">
            <Suspense
              fallback={
                <div className="loading" role="status">
                  กำลังโหลดเป้าหมาย…
                </div>
              }
            >
              <GoalPanel user={user} onSaved={onUserChanged} />
            </Suspense>
          </div>
        )}
        {settingsView === "reminders" && (
          <div className="settings-detail">
            <Suspense
              fallback={
                <div className="loading" role="status">
                  กำลังโหลดการแจ้งเตือน…
                </div>
              }
            >
              <ReminderPanel userId={user.id} />
            </Suspense>
          </div>
        )}
      </section>
    </div>
  );
>>>>>>> bfbbb22a05d659215cc302faf906a8f73907430e
}
