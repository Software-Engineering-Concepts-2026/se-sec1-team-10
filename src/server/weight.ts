import type { PublicWeightLog, WeightLogRecord } from '../shared/contracts.js';
import { calculateBmi } from './health.js';

export function weightDate(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function weightHistoryStart(now: Date): Date {
  const start = new Date(`${weightDate(now)}T00:00:00.000Z`);
  start.setUTCFullYear(start.getUTCFullYear() - 1);
  return start;
}

/** Shared date validation for creating and editing dated weight records. */
export function weightDateIssue(date: string, now: Date) {
  if (date > weightDate(now)) {
    return { message: 'ไม่สามารถบันทึกน้ำหนักในอนาคตได้', errors: { date: ['เลือกวันนี้หรือวันที่ผ่านมา'] } };
  }
  if (date < weightHistoryStart(now).toISOString().slice(0, 10)) {
    return { message: 'บันทึกน้ำหนักย้อนหลังได้ไม่เกิน 1 ปี', errors: { date: ['เลือกวันที่ภายใน 1 ปีที่ผ่านมา'] } };
  }
  return null;
}

// loggedAt stores the selected calendar day plus a time to order multiple entries that day.
export function weightTimestamp(date: string, now: Date): Date {
  const localClock = new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(11);
  return new Date(`${date}T${localClock}`);
}

export function publicWeightLog(log: WeightLogRecord): PublicWeightLog {
  return { id: log.id, date: log.loggedAt.toISOString().slice(0, 10), weightKg: log.weightKg, heightCm: log.heightCm, bmi: calculateBmi(log.weightKg, log.heightCm) };
}
