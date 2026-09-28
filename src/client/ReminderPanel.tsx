import { useState } from 'react';
import { notificationsSupported, notificationWorker, readReminders, storeReminders, type ReminderSettings } from './reminders';

export function ReminderPanel({ userId }: { userId: string }) {
  const [settings, setSettings] = useState(() => readReminders(userId));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  function save(next: ReminderSettings) {
    try { storeReminders(userId, next); setSettings(next); setMessage('บันทึกการตั้งค่าแล้ว'); }
    catch { setMessage('บันทึกการตั้งค่าบนอุปกรณ์นี้ไม่ได้ โปรดตรวจการอนุญาตพื้นที่จัดเก็บ'); }
  }
  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') { setMessage(permission === 'denied' ? 'การแจ้งเตือนถูกบล็อก เปิดสิทธิ์ในตั้งค่าเว็บไซต์ของเบราว์เซอร์แล้วลองอีกครั้ง' : 'ยังไม่ได้อนุญาตการแจ้งเตือน'); return; }
      await notificationWorker();
      save({ ...settings, enabled: true });
    } catch { setMessage('เปิดการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง'); }
    finally { setBusy(false); }
  }
  const supported = notificationsSupported();
  return <section className="card reminder-panel"><span className="eyebrow">MEAL REMINDERS</span><h2>แจ้งเตือนมื้ออาหาร</h2>
    <p className="muted">ตั้งเวลาตามเวลาบนอุปกรณ์นี้ ต้องเปิดแอปค้างไว้ การปิดแอปหรือพักการทำงานของเบราว์เซอร์อาจทำให้ไม่ได้รับแจ้งเตือน</p>
    <div>{settings.times.map((time, index) => <label key={index}>มื้อที่ {index + 1}<input type="time" value={time} onChange={event => { if (event.target.value) save({ ...settings, times: settings.times.map((value, i) => i === index ? event.target.value : value) }); }} /></label>)}</div>
    {supported ? <button type="button" className="secondary" disabled={busy} onClick={() => settings.enabled ? save({ ...settings, enabled: false }) : void enable()}>{busy ? 'กำลังเปิด…' : settings.enabled ? 'ปิดแจ้งเตือนมื้ออาหาร' : 'เปิดแจ้งเตือนมื้ออาหาร'}</button> : <p role="status">เบราว์เซอร์นี้ยังไม่รองรับการแจ้งเตือน ต้องใช้ HTTPS หรือเปิดบน localhost</p>}
    {message && <p className="feedback" role="status">{message}</p>}
  </section>;
}
