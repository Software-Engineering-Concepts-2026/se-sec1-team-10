import { z } from 'zod';
import { activityOptions } from './activities.js';

export const loginSchema = z.object({
  email: z.string().trim().email('กรุณากรอกอีเมลให้ถูกต้อง').max(254).transform(v => v.toLowerCase()),
  password: z.string().min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร').max(128, 'รหัสผ่านยาวเกินไป'),
});
export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(1, 'กรุณากรอกชื่อที่ใช้แสดง').max(80, 'ชื่อต้องไม่เกิน 80 ตัวอักษร'),
});
export const profileSchema = z.object({
  displayName: registerSchema.shape.displayName,
  age: z.number().int('อายุต้องเป็นจำนวนเต็ม').min(1).max(120),
  weightKg: z.number().positive('น้ำหนักต้องมากกว่า 0').max(500),
  heightCm: z.number().min(30, 'ส่วนสูงต้องไม่น้อยกว่า 30 ซม.').max(250),
}).strict();

export type ProfileInput = z.infer<typeof profileSchema>;
export type PublicUser = {
  id: string; email: string; displayName: string;
  age: number | null; weightKg: number | null; heightCm: number | null;
  bmi: number | null;
  targetWeightKg?: number | null; dailyCalorieTarget?: number | null;
};
export const goalSchema = z.object({ targetWeightKg: z.number().positive().max(500), dailyCalorieTarget: z.number().int().min(1).max(100000) }).strict();
export type GoalInput = z.infer<typeof goalSchema>;

const activityIds = activityOptions.map(activity => activity.id) as [string, ...string[]];
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'กรุณาระบุวันที่ให้ถูกต้อง').refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'กรุณาระบุวันที่ให้ถูกต้อง');
export const exerciseSchema = z.object({
  activityType: z.enum(activityIds, { error: 'กรุณาเลือกกิจกรรม' }),
  durationMinutes: z.number().int('ระยะเวลาต้องเป็นจำนวนเต็ม').min(1, 'ระยะเวลาต้องอย่างน้อย 1 นาที').max(1440),
  activityDate: dateSchema,
}).strict();
export const dailyExerciseQuerySchema = z.object({
  date: dateSchema,
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type ExerciseRecord = ExerciseInput & {
  id: string; userId: string; weightKg: number; caloriesBurned: number;
  createdAt: Date; updatedAt: Date;
};
export type PublicExercise = Omit<ExerciseRecord, 'userId' | 'createdAt' | 'updatedAt'>;

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const nutrientGrams = z.number().min(0, 'ต้องไม่น้อยกว่า 0').max(10000, 'จำนวนมากเกินไป');
export const mealIngredientSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อส่วนประกอบ').max(120),
  carbsGrams: nutrientGrams,
  sugarGrams: nutrientGrams,
  proteinGrams: nutrientGrams,
  fatGrams: nutrientGrams,
}).strict();
export const mealSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่ออาหาร').max(120),
  mealType: z.enum(mealTypes, { error: 'กรุณาเลือกมื้ออาหาร' }),
  activityDate: dateSchema,
  imageData: z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'รูปภาพไม่ถูกต้อง').max(300_000, 'รูปภาพมีขนาดใหญ่เกินไป').nullable().optional(),
  ingredients: z.array(mealIngredientSchema).min(1, 'ต้องมีส่วนประกอบอย่างน้อย 1 รายการ').max(20),
}).strict();
export type MealInput = z.infer<typeof mealSchema>;
export type MealIngredientRecord = z.infer<typeof mealIngredientSchema> & { id: string };
export type MealRecord = Omit<MealInput, 'ingredients'> & { id: string; userId: string; totalCalories: number; createdAt: Date; updatedAt: Date; ingredients: MealIngredientRecord[] };
export type PublicMeal = Omit<MealRecord, 'userId' | 'createdAt' | 'updatedAt'>;
