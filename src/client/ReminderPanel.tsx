import { useState } from "react";
import {
  notificationsSupported,
  notificationWorker,
  readReminders,
  storeReminders,
  type ReminderSettings,
} from "./reminders";
import { FeedbackMessage, type Feedback } from "./FormFeedback";

export function ReminderPanel({
  userId,
}: {
  userId: string;
}) {
  const [settings, setSettings] = useState(() => readReminders(userId));
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  function saveSettings(next: ReminderSettings) {
    try {
      storeReminders(userId, next);
      setSettings(next);
      setFeedback({ error: false, message: "บันทึกการตั้งค่าเรียบร้อยแล้ว" });
    } catch {
      setFeedback({
        error: true,
        message: "บันทึกการตั้งค่าบนอุปกรณ์นี้ไม่ได้ โปรดตรวจการอนุญาตพื้นที่จัดเก็บ",
      });
    }
  }

  async function enable() {
    setBusy(true);
    setFeedback(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setFeedback({
          error: true,
          message:
            permission === "denied"
              ? "การแจ้งเตือนถูกบล็อก เปิดสิทธิ์ในตั้งค่าเว็บไซต์ของเบราว์เซอร์แล้วลองอีกครั้ง"
              : "ยังไม่ได้อนุญาตการแจ้งเตือน",
        });
        return;
      }
      await notificationWorker();
      saveSettings({ ...settings, enabled: true });
    } catch {
      setFeedback({
        error: true,
        message: "เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง",
      });
    } finally {
      setBusy(false);
    }
  }

  const supported = notificationsSupported();
  return (
    <section className="card reminder-panel">
      <span className="eyebrow">MEAL REMINDERS</span>
      <h2>แจ้งเตือนมื้ออาหาร</h2>
      <p className="muted">
        ตั้งเวลาตามเวลาบนอุปกรณ์นี้ ต้องเปิดแอปค้างไว้ การปิดแอปหรือพักการทำงานของเบราว์เซอร์อาจทำให้ไม่ได้รับแจ้งเตือน
      </p>
      <FeedbackMessage value={feedback} />
      <fieldset disabled={busy}>
        <div>
          {settings.times.map((time, index) => {
            const inputId = `reminder-time-${index + 1}`;
            return (
              <label key={inputId} htmlFor={inputId}>
                มื้อที่ {index + 1}
                <input
                  id={inputId}
                  type="time"
                  value={time}
                  onChange={(event) => {
                    const nextTime = event.target.value;
                    if (!nextTime) return;
                    saveSettings({
                      ...settings,
                      times: settings.times.map((currentTime, currentIndex) =>
                        currentIndex === index ? nextTime : currentTime,
                      ),
                    });
                  }}
                />
              </label>
            );
          })}
        </div>
        {supported ? (
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() =>
              settings.enabled
                ? saveSettings({ ...settings, enabled: false })
                : void enable()
            }
          >
            {busy
              ? "กำลังเปิด…"
              : settings.enabled
                ? "ปิดแจ้งเตือนมื้ออาหาร"
                : "เปิดแจ้งเตือนมื้ออาหาร"}
          </button>
        ) : (
          <p role="status">
            เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน ต้องใช้ HTTPS หรือเปิดบน localhost
          </p>
        )}
      </fieldset>
    </section>
  );
}
