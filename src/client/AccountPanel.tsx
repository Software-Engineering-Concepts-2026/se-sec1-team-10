import {
  lazy,
  Suspense,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import type { PublicUser } from "../shared/contracts";
import { ApiError } from "./api";
import { accountApi } from "./Account";
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
      const result = await accountApi.updateProfile({
        displayName: String(values.displayName).trim(),
        age: Number(values.age),
        weightKg: Number(values.weightKg),
        heightCm: Number(values.heightCm),
      });
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
}
