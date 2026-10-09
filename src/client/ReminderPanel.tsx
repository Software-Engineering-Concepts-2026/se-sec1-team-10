import { useState } from "react";
import { UiIcon } from "./Ui";
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
    <section className="reminder-panel ref-reminder" aria-label="เตือนมื้ออาหาร">
      <p className="ref-info-note"><UiIcon name="info" />
        ใช้เวลาของอุปกรณ์นี้ และต้องเปิดแอปไว้เพื่อรับการแจ้งเตือน เบราว์เซอร์อาจหยุดทำงานเมื่อแอปปิดหรือพักอยู่
      </p>
      <FeedbackMessage value={feedback} />
      <fieldset disabled={busy}>
        <section className="ref-reminder-times"><h3>ตั้งเวลาเตือนอาหาร</h3>
          {settings.times.map((time, index) => {
            const inputId = `reminder-time-${index + 1}`;
            return (
              <label key={inputId} htmlFor={inputId}>
                <span className="reminder-meal-label"><UiIcon name={index === 2 ? "clock" : "calendar"} /> มื้อที่ {index + 1}<small className="reminder-time-24h">24 ชม. {time}</small></span>
                <input
                  id={inputId}
                  className="reminder-time-input"
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
        </section>
        <section className="ref-notification-status"><h3>สถานะการแจ้งเตือนของเบราว์เซอร์</h3><p className="reminder-permission-status"><UiIcon name="bell" /> {supported ? Notification.permission === "granted" ? "อนุญาตแล้ว" : Notification.permission === "denied" ? "ถูกบล็อก" : "ยังไม่ได้อนุญาต" : "ไม่รองรับ"}</p><p className="reminder-enabled-status">{settings.enabled ? "เปิดเตือนทั้ง 3 มื้อ" : "ปิดการเตือน"}</p>
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
        </section>
      </fieldset>
    </section>
  );
}
