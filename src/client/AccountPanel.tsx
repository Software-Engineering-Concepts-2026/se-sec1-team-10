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
}
