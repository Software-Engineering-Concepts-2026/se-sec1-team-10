export const goalModes = ['maintain', 'lose', 'gain-muscle'] as const;
export const formulaSexes = ['male', 'female'] as const;
export const activityLevels = ['low', 'moderate', 'high'] as const;
export const targetModes = ['recommended', 'manual'] as const;

export type GoalSettingsInput = {
  mode: typeof goalModes[number];
  formulaSex: typeof formulaSexes[number];
  activityLevel: typeof activityLevels[number];
  targetMode: typeof targetModes[number];
};
export type GoalProfile = { age: number | null; weightKg: number | null; heightCm: number | null };
export type GoalSettings = GoalSettingsInput & {
  tdeeKcal: number;
  profileSnapshot: { age: number; weightKg: number; heightCm: number };
  startWeightKg: number;
  updatedAt: string;
};
export const goalLabels = { maintain: 'รักษาน้ำหนัก / สมดุล', lose: 'ลดน้ำหนัก', 'gain-muscle': 'เพิ่มกล้ามเนื้อ' };
export const activityLabels = {
  low: 'กิจกรรมน้อย — นั่งเป็นส่วนใหญ่',
  moderate: 'กิจกรรมปานกลาง — เดินและออกกำลังกายบ้าง',
  high: 'กิจกรรมมาก — เคลื่อนไหวหรือฝึกสม่ำเสมอ',
};
// PAL presets within the NIH Body Weight Planner's typical range. They include activity.
const activityFactors = { low: 1.4, moderate: 1.6, high: 1.8 };
// Conservative app presets, not a prediction of weight or muscle gain.
const goalFactors = { maintain: 1, lose: 0.9, 'gain-muscle': 1.05 };

// App starting points within adult AMDR ranges, not goal-specific clinical prescriptions.
// DRI: https://www.nationalacademies.org/read/10872/chapter/13 (Table C-5).
export const macroPresets = {
  maintain: { carbs: 0.5, protein: 0.2, fat: 0.3 },
  lose: { carbs: 0.45, protein: 0.25, fat: 0.3 },
  'gain-muscle': { carbs: 0.45, protein: 0.25, fat: 0.3 },
} as const;

export function dailyMacroTargets(caloriesKcal: number | null | undefined, mode?: GoalSettingsInput['mode'] | null) {
  if (caloriesKcal == null || !Number.isFinite(caloriesKcal) || !Number.isInteger(caloriesKcal) || caloriesKcal < 1000 || caloriesKcal > 10000) return null;
  const selectedMode = mode ?? 'maintain';
  const shares = macroPresets[selectedMode];
  // General energy factors for setting approximate targets; keep precision until display.
  return {
    caloriesKcal, mode: selectedMode, shares,
    grams: { carbs: caloriesKcal * shares.carbs / 4, protein: caloriesKcal * shares.protein / 4, fat: caloriesKcal * shares.fat / 9 },
  };
}

export function goalEstimateIssue(profile: GoalProfile, mode: GoalSettingsInput['mode']): string | null {
  const { age, weightKg, heightCm } = profile;
  if (age == null || weightKg == null || heightCm == null) return 'กรุณาบันทึกอายุ น้ำหนัก และส่วนสูงในข้อมูลส่วนตัวก่อน';
  if (!Number.isFinite(age) || !Number.isFinite(weightKg) || !Number.isFinite(heightCm) || age < 18 || age > 120 || weightKg <= 0 || heightCm <= 0) return 'การประมาณ TDEE นี้ใช้สำหรับผู้ใหญ่อายุ 18 ปีขึ้นไปที่มีข้อมูลร่างกายถูกต้อง';
  if (mode === 'lose' && weightKg / (heightCm / 100) ** 2 < 18.5) return 'ระบบไม่แนะนำเป้าหมายลดน้ำหนักเมื่อ BMI ต่ำกว่า 18.5';
  return null;
}

export function estimateGoal(profile: GoalProfile, settings: GoalSettingsInput) {
  if (goalEstimateIssue(profile, settings.mode)) return null;
  const restingKcal = 10 * profile.weightKg! + 6.25 * profile.heightCm! - 5 * profile.age! + (settings.formulaSex === 'male' ? 5 : -161);
  const tdeeKcal = Math.round(restingKcal * activityFactors[settings.activityLevel]);
  if (!Number.isFinite(tdeeKcal) || tdeeKcal < 1000 || tdeeKcal > 10000) return null;
  return { restingKcal: Math.round(restingKcal), tdeeKcal, targetKcal: Math.min(10000, Math.max(1000, Math.round(tdeeKcal * goalFactors[settings.mode]))) };
}

export function goalProfileChanged(profile: GoalProfile, settings?: GoalSettings | null) {
  return !!settings && (profile.age !== settings.profileSnapshot.age || profile.weightKg !== settings.profileSnapshot.weightKg || profile.heightCm !== settings.profileSnapshot.heightCm);
}

export function calorieBudget(target: number | null | undefined, consumed: number, burned: number, settings?: GoalSettings | null) {
  // Preserve existing net-energy goals until the user opts into the new goal setup.
  const countedCalories = settings ? consumed : consumed - burned;
  return { countedCalories, remaining: target == null ? null : target - countedCalories };
}
