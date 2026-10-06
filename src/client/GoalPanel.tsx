import { useState, type FormEvent } from "react";
import type { PublicUser } from "../shared/contracts";
import { ApiError, api } from "./api";
import { FeedbackMessage, Field, type Feedback } from "./FormFeedback";

export function GoalPanel({
  user,
  onSaved,
}: {
  user: PublicUser;
  onSaved: (user: PublicUser) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function saveGoals(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    const values = Object.fromEntries(new FormData(event.currentTarget));

    try {
      const result = await api<{ user: PublicUser }>(
        "/goals",
        {
          targetWeightKg: Number(values.targetWeightKg),
          dailyCalorieTarget: Number(values.dailyCalorieTarget),
        },
        "PUT",
      );
      onSaved(result.user);
      setFeedback({ error: false, message: "บันทึกเป้าหมายเรียบร้อยแล้ว" });
    } catch (error) {
      setFeedback(
        error instanceof ApiError
          ? { message: error.message, error: true, fields: error.fields }
          : { message: "เกิดข้อผิดพลาด กรุณาลองอีกครั้ง", error: true },
      );
    } finally {
      setBusy(false);
    }
  }

  const difference =
    user.weightKg != null && user.targetWeightKg != null
      ? Math.round((user.weightKg - user.targetWeightKg) * 10) / 10
      : null;

  return (
    <section className="card goal-panel">
      <span className="eyebrow">MY GOALS</span>
      <h2>เป้าหมายสุขภาพ</h2>
      <FeedbackMessage value={feedback} />
      <form onSubmit={saveGoals}>
        <fieldset disabled={busy}>
          <div className="goal-fields">
            <Field
              name="targetWeightKg"
              label="น้ำหนักเป้าหมาย (กก.)"
              type="number"
              min={0.1}
              max={500}
              step="0.1"
              defaultValue={user.targetWeightKg ?? ""}
              error={feedback?.fields?.targetWeightKg}
            />
            <Field
              name="dailyCalorieTarget"
              label="เป้าหมายพลังงานต่อวัน (กิโลแคลอรี)"
              type="number"
              min={1}
              max={100000}
              step="1"
              defaultValue={user.dailyCalorieTarget ?? ""}
              error={feedback?.fields?.dailyCalorieTarget}
            />
          </div>
          <button className="secondary" type="submit">
            {busy ? "กำลังบันทึก…" : "บันทึกเป้าหมาย"}
          </button>
        </fieldset>
      </form>
      {user.targetWeightKg != null && (
        <div className="goal-progress-summary">
          <p>
            น้ำหนักปัจจุบัน {user.weightKg ?? "—"} / เป้าหมาย {user.targetWeightKg} กก.
          </p>
          <p>
            {difference === null
              ? "บันทึกน้ำหนักปัจจุบันเพื่อเทียบกับเป้าหมาย"
              : difference === 0
                ? "น้ำหนักตรงกับเป้าหมายแล้ว"
                : `ห่างจากเป้าหมาย ${Math.abs(difference)} กก.`}
          </p>
        </div>
      )}
    </section>
  );
}
