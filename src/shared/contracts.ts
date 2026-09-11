import { z } from 'zod';

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
};
