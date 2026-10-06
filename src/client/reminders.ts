import { useEffect } from "react";

export type ReminderSettings = {
  enabled: boolean;
  times: string[];
};

const DEFAULT_TIMES = ["07:00", "12:00", "18:00"];
const REMINDER_EVENT = "reminder-settings-changed";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const REMINDER_INTERVAL_MS = 15_000;

const defaults = (): ReminderSettings => ({
  enabled: false,
  times: [...DEFAULT_TIMES],
});

function isReminderSettings(value: unknown): value is ReminderSettings {
  if (typeof value !== "object" || value === null) return false;

  const settings = value as Record<string, unknown>;
  return (
    typeof settings.enabled === "boolean" &&
    Array.isArray(settings.times) &&
    settings.times.length === DEFAULT_TIMES.length &&
    settings.times.every(
      (time): time is string =>
        typeof time === "string" && TIME_PATTERN.test(time),
    )
  );
}

export const reminderKey = (userId: string) =>
  `lifebalance-reminders:${userId}`;

export function readReminders(userId: string): ReminderSettings {
  try {
    const stored = localStorage.getItem(reminderKey(userId));
    const value: unknown = JSON.parse(stored ?? "null");
    return isReminderSettings(value) ? value : defaults();
  } catch {
    return defaults();
  }
}

export function storeReminders(userId: string, settings: ReminderSettings) {
  localStorage.setItem(reminderKey(userId), JSON.stringify(settings));
  window.dispatchEvent(new Event(REMINDER_EVENT));
}

export const notificationsSupported = () =>
  window.isSecureContext &&
  "Notification" in window &&
  "serviceWorker" in navigator;

export async function notificationWorker() {
  await navigator.serviceWorker.register("/reminders-sw.js");
  return navigator.serviceWorker.ready;
}

function currentTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function reminderTag(userId: string, date: Date, time: string) {
  const day = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  return `${userId}:${day}:${time}`;
}

// Independent from the Diary page so visiting that section is never required.
export function ReminderObserver({ userId }: { userId: string }) {
  useEffect(() => {
    let active = true;
    let pending = false;
    const sent = new Set<string>();

    async function tick() {
      const settings = readReminders(userId);
      if (
        pending ||
        !settings.enabled ||
        !notificationsSupported() ||
        Notification.permission !== "granted"
      ) {
        return;
      }

      const now = new Date();
      const time = currentTime(now);
      if (!settings.times.includes(time)) return;

      const tag = reminderTag(userId, now, time);
      const marker = `${reminderKey(userId)}:last`;
      try {
        if (sent.has(tag) || localStorage.getItem(marker) === tag) return;
      } catch {
        if (sent.has(tag)) return;
      }

      pending = true;
      try {
        const worker = await notificationWorker();
        if (!active || !readReminders(userId).enabled) return;

        await worker.showNotification("LifeBalance · ถึงเวลามื้ออาหาร", {
          body: `อย่าลืมทานและบันทึกมื้ออาหาร (${time})`,
          tag,
          data: { url: "/" },
        });
        sent.add(tag);

        try {
          localStorage.setItem(marker, tag);
        } catch {
          // In-memory deduplication remains available when storage is blocked.
        }
      } catch {
        // Permission may have been revoked after opting in.
      } finally {
        pending = false;
      }
    }

    void tick();
    const timer = window.setInterval(() => void tick(), REMINDER_INTERVAL_MS);
    const refresh = () => void tick();

    window.addEventListener(REMINDER_EVENT, refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener(REMINDER_EVENT, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [userId]);

  return null;
}
