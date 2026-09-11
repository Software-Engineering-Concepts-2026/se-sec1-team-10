import { activityOptions } from '../shared/activities.js';
import type { ExerciseRecord, PublicExercise } from '../shared/contracts.js';

export function calculateExerciseCalories(activityType: string, weightKg: number, durationMinutes: number) {
  const activity = activityOptions.find(option => option.id === activityType);
  if (!activity || weightKg <= 0 || durationMinutes <= 0) throw new Error('Invalid exercise calculation input');
  return Math.round((activity.met * 3.5 * weightKg / 200) * durationMinutes);
}

export function publicExercise(record: ExerciseRecord): PublicExercise {
  return {
    id: record.id, activityType: record.activityType, durationMinutes: record.durationMinutes,
    activityDate: record.activityDate, weightKg: record.weightKg, caloriesBurned: record.caloriesBurned,
  };
}

export function dateBounds(value: string) {
  const start = new Date(`${value}T00:00:00.000Z`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}
