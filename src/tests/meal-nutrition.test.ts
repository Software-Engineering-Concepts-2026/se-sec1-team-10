import { describe, expect, it } from 'vitest';
import { mealSchema } from '../shared/contracts.js';
import { calculateMeal, scaleReferenceNutrients } from '../server/meal.js';

const usda200 = { name: 'Rice', amount: 200, unit: 'g', referenceAmount: 100, referenceUnit: 'g', source: 'usda-fdc', referenceNutrients: { caloriesKcal: 120, carbsGrams: 20, sugarGrams: 4, proteinGrams: 5, fatGrams: 2 } } as const;
const meal = (ingredients: unknown[]) => mealSchema.parse({ name: 'Test', mealType: 'lunch', activityDate: '2026-09-20', ingredients });

describe('meal reference nutrition', () => {
  it('scales USDA 200 g from a 100 g reference and ignores client aggregates', () => {
    const calculated = calculateMeal(meal([{ ...usda200, totalCalories: 99999, carbsGrams: 99999 }]));
    expect(calculated.totalCalories).toBe(240);
    expect(calculated.ingredients[0]).toMatchObject({ caloriesKcal: 240, carbsGrams: 40, sugarGrams: 8, proteinGrams: 10, fatGrams: 4 });
    expect(calculateMeal(meal([{ ...usda200, amount: 100 }])).ingredients[0].caloriesKcal).toBe(120);
  });
  it('keeps unknown nutrients null instead of inventing zero', () => {
    expect(scaleReferenceNutrients({ ...usda200.referenceNutrients, sugarGrams: null }, 200, 100).sugarGrams).toBeNull();
    expect(() => calculateMeal(meal([{ ...usda200, referenceNutrients: { ...usda200.referenceNutrients, sugarGrams: null } }]))).toThrow(/ครบ/);
  });
  it('rejects invalid quantities and a fabricated all-zero meal', () => {
    expect(() => meal([{ ...usda200, amount: 0 }])).toThrow();
    expect(() => meal([{ ...usda200, amount: Infinity }])).toThrow();
    expect(() => calculateMeal(meal([{ ...usda200, referenceNutrients: { caloriesKcal: 0, carbsGrams: 0, sugarGrams: 0, proteinGrams: 0, fatGrams: 0 } }]))).toThrow(/ไม่มีข้อมูล/);
  });
  it('adapts old flat ingredient values to an explicit legacy serving, never 100 g', () => {
    const legacy = meal([{ name: 'Old meal', carbsGrams: 10, sugarGrams: 1, proteinGrams: 2, fatGrams: 3 }]).ingredients[0];
    expect(legacy).toMatchObject({ amount: 1, unit: 'serving', referenceAmount: 1, referenceUnit: 'serving', source: 'legacy' });
    expect(calculateMeal(meal([legacy])).totalCalories).toBe(75);
  });
  it('accepts complete manual 100 g basis and rejects missing manual nutrients', () => {
    const manual = { ...usda200, source: 'manual', amount: 75, referenceAmount: 100 };
    expect(calculateMeal(meal([manual])).ingredients[0].caloriesKcal).toBe(90);
    expect(() => meal([{ ...manual, referenceNutrients: { ...manual.referenceNutrients, fatGrams: null } }])).toThrow(/กรอกเอง/);
  });
});
