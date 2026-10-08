import { describe, expect, it } from 'vitest';
import { calorieBudget, dailyMacroTargets, estimateGoal, goalEstimateIssue, goalProfileChanged, type GoalSettingsInput, type GoalSettings } from '../shared/goals.js';
import { goalSchema } from '../shared/contracts.js';

const profile = { age: 30, weightKg: 70, heightCm: 175 };
const settings: GoalSettingsInput = { mode: 'maintain', formulaSex: 'male', activityLevel: 'moderate', targetMode: 'recommended' };
const saved: GoalSettings = { ...settings, tdeeKcal: 2638, profileSnapshot: profile, startWeightKg: 70, updatedAt: '2026-10-06T00:00:00.000Z' };

describe('adult TDEE and food-intake goals', () => {
  it('uses Mifflin-St Jeor with explicit sex and activity, including fractional height', () => {
    expect(estimateGoal(profile, settings)).toMatchObject({ restingKcal: 1649, tdeeKcal: 2638, targetKcal: 2638 });
    expect(estimateGoal(profile, { ...settings, formulaSex: 'female' })).toMatchObject({ restingKcal: 1483, tdeeKcal: 2372 });
    expect(estimateGoal(profile, { ...settings, activityLevel: 'low' })?.tdeeKcal).toBe(2308);
    expect(estimateGoal(profile, { ...settings, activityLevel: 'high' })?.tdeeKcal).toBe(2968);
  });
  it('offers distinct moderate presets rather than predicting weight loss', () => {
    expect(estimateGoal(profile, { ...settings, mode: 'lose' })?.targetKcal).toBe(2374);
    expect(estimateGoal(profile, { ...settings, mode: 'gain-muscle' })?.targetKcal).toBe(2770);
  });
  it('does not estimate for children, incomplete profiles or nonfinite input', () => {
    for (const invalid of [{ ...profile, age: 17 }, { ...profile, weightKg: null }, { ...profile, heightCm: NaN }, { ...profile, weightKg: Infinity }]) expect(estimateGoal(invalid, settings)).toBeNull();
    expect(estimateGoal({ ...profile, weightKg: 1, heightCm: 30 }, settings)).toBeNull();
  });
  it('does not recommend a deficit for an underweight profile', () => {
    expect(goalEstimateIssue({ ...profile, weightKg: 50 }, 'lose')).toContain('18.5');
    expect(estimateGoal({ ...profile, weightKg: 50 }, { ...settings, mode: 'lose' })).toBeNull();
  });
  it('rejects forged saved estimates and incomplete manual targets', () => {
    expect(goalSchema.safeParse({ targetWeightKg: 70, goalSettings: settings }).success).toBe(true);
    expect(goalSchema.safeParse({ targetWeightKg: 70, goalSettings: { ...settings, tdeeKcal: 9999 } }).success).toBe(false);
    expect(goalSchema.safeParse({ targetWeightKg: 70, goalSettings: { ...settings, targetMode: 'manual' } }).success).toBe(false);
    expect(goalSchema.safeParse({ targetWeightKg: 70, dailyCalorieTarget: 900 }).success).toBe(false);
    expect(goalSchema.safeParse({ targetWeightKg: 70, dailyCalorieTarget: 2000 }).success).toBe(true);
  });
  it('does not add exercise calories a second time to new TDEE goals', () => {
    expect(calorieBudget(2638, 2000, 600, saved)).toEqual({ countedCalories: 2000, remaining: 638 });
    expect(calorieBudget(2638, 2000, 0, saved)).toEqual({ countedCalories: 2000, remaining: 638 });
    expect(calorieBudget(2638, 2800, 600, saved).remaining).toBe(-162);
    expect(calorieBudget(2000, 1800, 400)).toEqual({ countedCalories: 1400, remaining: 600 });
    expect(calorieBudget(null, 1800, 400, saved).remaining).toBeNull();
  });
  it('detects profile changes without mutating the saved target or starting weight', () => {
    expect(goalProfileChanged(profile, saved)).toBe(false);
    expect(goalProfileChanged({ ...profile, weightKg: 68 }, saved)).toBe(true);
    expect(goalProfileChanged({ ...profile, age: 31 }, saved)).toBe(true);
    expect(saved.tdeeKcal).toBe(2638);
    expect(saved.startWeightKg).toBe(70);
  });
});

describe('daily macro starting points', () => {
  it.each(['maintain', 'lose', 'gain-muscle'] as const)('allocates the full calorie budget within adult AMDR for %s', mode => {
    const result = dailyMacroTargets(2000, mode)!;
    expect(result.shares.carbs + result.shares.protein + result.shares.fat).toBeCloseTo(1);
    expect(result.shares.carbs).toBeGreaterThanOrEqual(0.45);
    expect(result.shares.carbs).toBeLessThanOrEqual(0.65);
    expect(result.shares.protein).toBeGreaterThanOrEqual(0.1);
    expect(result.shares.protein).toBeLessThanOrEqual(0.35);
    expect(result.shares.fat).toBeGreaterThanOrEqual(0.2);
    expect(result.shares.fat).toBeLessThanOrEqual(0.35);
    expect(result.grams.carbs * 4 + result.grams.protein * 4 + result.grams.fat * 9).toBeCloseTo(2000);
  });
  it('uses the saved or manually entered calorie target without rounding internal grams', () => {
    expect(dailyMacroTargets(2000, 'maintain')?.grams).toEqual({ carbs: 250, protein: 100, fat: 2000 * 0.3 / 9 });
    const loss = dailyMacroTargets(2424, 'lose')!;
    const gain = dailyMacroTargets(2828, 'gain-muscle')!;
    expect(loss.grams.protein).toBe(151.5);
    expect(gain.grams.protein).toBe(176.75);
    expect(gain.grams.fat).toBeCloseTo(94.2666666667);
    expect(dailyMacroTargets(2000, 'lose')?.grams).toEqual(dailyMacroTargets(2000, 'gain-muscle')?.grams);
  });
  it('uses the balanced starting point for legacy goals and rejects missing/invalid budgets', () => {
    expect(dailyMacroTargets(2000)?.mode).toBe('maintain');
    expect(dailyMacroTargets(2000, null)?.grams.protein).toBe(100);
    for (const target of [null, undefined, 0, -1, 999, 10001, 2000.5, NaN, Infinity]) expect(dailyMacroTargets(target)).toBeNull();
    expect(dailyMacroTargets(1000)).not.toBeNull();
    expect(dailyMacroTargets(10000)).not.toBeNull();
  });
});
