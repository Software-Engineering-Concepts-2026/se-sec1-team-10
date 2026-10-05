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
export const historyQuerySchema = z.object({ from: dateSchema, to: dateSchema }).refine(value => value.from <= value.to, 'ช่วงวันที่ไม่ถูกต้อง');
export const pagedMealHistoryQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
  q: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(100000).default(0),
}).refine(value => value.from <= value.to, 'ช่วงวันที่ไม่ถูกต้อง');
export type ExerciseInput = z.infer<typeof exerciseSchema>;
export type ExerciseRecord = ExerciseInput & {
  id: string; userId: string; weightKg: number; caloriesBurned: number;
  createdAt: Date; updatedAt: Date;
};
export type PublicExercise = Omit<ExerciseRecord, 'userId' | 'createdAt' | 'updatedAt'>;

const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const nutrientValue = z.number().finite('สารอาหารต้องเป็นตัวเลข').min(0, 'ต้องไม่น้อยกว่า 0').max(10000, 'จำนวนมากเกินไป');
const nullableNutrientValue = nutrientValue.nullable();
export const foodUnitSchema = z.enum(['g', 'serving']);
export const ingredientSourceSchema = z.enum(['usda-fdc', 'ai-estimate', 'legacy', 'manual', 'food-catalog']);
export const referenceNutrientsSchema = z.object({
  caloriesKcal: nullableNutrientValue,
  carbsGrams: nullableNutrientValue,
  sugarGrams: nullableNutrientValue,
  proteinGrams: nullableNutrientValue,
  fatGrams: nullableNutrientValue,
}).strict();
export const mealIngredientSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อส่วนประกอบ').max(120),
  amount: z.number().finite('ปริมาณต้องเป็นตัวเลข').gt(0, 'ปริมาณต้องมากกว่า 0').max(100000, 'ปริมาณมากเกินไป'),
  unit: foodUnitSchema,
  referenceAmount: z.number().finite('ปริมาณอ้างอิงต้องเป็นตัวเลข').gt(0, 'ปริมาณอ้างอิงต้องมากกว่า 0').max(100000, 'ปริมาณอ้างอิงมากเกินไป'),
  referenceUnit: foodUnitSchema,
  source: ingredientSourceSchema,
  referenceNutrients: referenceNutrientsSchema,
}).strip().refine(value => value.unit === value.referenceUnit, 'หน่วยปริมาณต้องตรงกับหน่วยอ้างอิง').refine(value => value.source !== 'manual' || (value.unit === 'g' && value.referenceAmount === 100 && value.referenceUnit === 'g' && Object.values(value.referenceNutrients).every(nutrient => nutrient !== null)), 'ข้อมูลที่กรอกเองต้องระบุสารอาหารต่อ 100 กรัมให้ครบ');
// Compatibility for an already deployed client. It represents one saved serving,
// never a guessed 100 g reference.
const legacyMealIngredientSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อส่วนประกอบ').max(120),
  carbsGrams: nutrientValue,
  sugarGrams: nutrientValue,
  proteinGrams: nutrientValue,
  fatGrams: nutrientValue,
}).strict().transform(value => ({
  name: value.name, amount: 1, unit: 'serving' as const, referenceAmount: 1,
  referenceUnit: 'serving' as const, source: 'legacy' as const,
  referenceNutrients: {
    caloriesKcal: value.carbsGrams * 4 + value.proteinGrams * 4 + value.fatGrams * 9,
    carbsGrams: value.carbsGrams, sugarGrams: value.sugarGrams,
    proteinGrams: value.proteinGrams, fatGrams: value.fatGrams,
  },
}));
export const mealSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่ออาหาร').max(120),
  mealType: z.enum(mealTypes, { error: 'กรุณาเลือกมื้ออาหาร' }),
  activityDate: dateSchema,
  imageData: z.string().regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, 'รูปภาพไม่ถูกต้อง').max(300_000, 'รูปภาพมีขนาดใหญ่เกินไป').nullable().optional(),
  ingredients: z.array(z.union([mealIngredientSchema, legacyMealIngredientSchema])).min(1, 'ต้องมีส่วนประกอบอย่างน้อย 1 รายการ').max(20),
}).strict();
export type MealInput = z.infer<typeof mealSchema>;
export type FoodUnit = z.infer<typeof foodUnitSchema>;
export type IngredientSource = z.infer<typeof ingredientSourceSchema>;
export type ReferenceNutrients = z.infer<typeof referenceNutrientsSchema>;
export type MealIngredientRecord = z.infer<typeof mealIngredientSchema> & ReferenceNutrients & { id: string };
export type MealRecord = Omit<MealInput, 'ingredients'> & { id: string; userId: string; totalCalories: number; createdAt: Date; updatedAt: Date; ingredients: MealIngredientRecord[] };
export type PublicMeal = Omit<MealRecord, 'userId' | 'createdAt' | 'updatedAt'>;
