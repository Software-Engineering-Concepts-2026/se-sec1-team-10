import { useEffect } from 'react';

export type ReminderSettings = { enabled: boolean; times: string[] };
const defaults = (): ReminderSettings => ({ enabled: false, times: ['08:00', '12:00', '18:00'] });
export const reminderKey = (userId: string) => `lifebalance-reminders:${userId}`;
export function readReminders(userId: string): ReminderSettings {
  try {
    const value = JSON.parse(localStorage.getItem(reminderKey(userId)) ?? 'null');
    if (value && typeof value.enabled === 'boolean' && Array.isArray(value.times) && value.times.length === 3 && value.times.every((time: unknown) => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return value;
  } catch { /* Storage can be unavailable or contain old data. */ }
  return defaults();
}
export function storeReminders(userId: string, settings: ReminderSettings) {
  localStorage.setItem(reminderKey(userId), JSON.stringify(settings));
  window.dispatchEvent(new Event('reminder-settings-changed'));
}
export const notificationsSupported = () => window.isSecureContext && 'Notification' in window && 'serviceWorker' in navigator;
export async function notificationWorker() {
  await navigator.serviceWorker.register('/reminders-sw.js');
  return navigator.serviceWorker.ready;
}

// Independent from the Diary page so visiting that section is never required.
export function ReminderObserver({ userId }: { userId: string }) {
  useEffect(() => {
    let active = true;
    let pending = false;
    const sent = new Set<string>();
    async function tick() {
      const settings = readReminders(userId);
      if (pending || !settings.enabled || !notificationsSupported() || Notification.permission !== 'granted') return;
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!settings.times.includes(time)) return;
      const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      const tag = `${userId}:${day}:${time}`;
      const marker = `${reminderKey(userId)}:last`;
      try { if (sent.has(tag) || localStorage.getItem(marker) === tag) return; } catch { if (sent.has(tag)) return; }
      pending = true;
      try {
        const worker = await notificationWorker();
        if (!active || !readReminders(userId).enabled) return;
        await worker.showNotification('LifeBalance · ถึงเวลามื้ออาหาร', { body: `อย่าลืมทานและบันทึกมื้ออาหาร (${time})`, tag, data: { url: '/' } });
        sent.add(tag);
        try { localStorage.setItem(marker, tag); } catch { /* In-memory dedupe remains. */ }
      } catch { /* Permission may have been revoked after opting in. */ }
      finally { pending = false; }
    }
    void tick();
    const timer = window.setInterval(() => void tick(), 15000);
    const refresh = () => void tick();
    window.addEventListener('reminder-settings-changed', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('reminder-settings-changed', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [userId]);
  return null;
}
