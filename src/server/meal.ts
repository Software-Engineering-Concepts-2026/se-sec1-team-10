import type { MealInput, MealRecord, PublicMeal, ReferenceNutrients } from '../shared/contracts.js';

const keys = ['caloriesKcal', 'carbsGrams', 'sugarGrams', 'proteinGrams', 'fatGrams'] as const;

export function scaleReferenceNutrients(reference: ReferenceNutrients, amount: number, referenceAmount: number): ReferenceNutrients {
  const factor = amount / referenceAmount;
  return Object.fromEntries(keys.map(key => [key, reference[key] === null ? null : Math.round(reference[key] * factor * 100) / 100])) as ReferenceNutrients;
}

export function calculatedIngredient(input: MealInput['ingredients'][number]) {
  const nutrients = scaleReferenceNutrients(input.referenceNutrients, input.amount, input.referenceAmount);
  return { ...input, ...nutrients };
}

export function calculateMeal(input: MealInput) {
  const ingredients = input.ingredients.map(calculatedIngredient);
  if (ingredients.some(ingredient => keys.some(key => ingredient[key] === null))) throw new Error('ข้อมูลโภชนาการของส่วนประกอบยังไม่ครบ');
  const totalCalories = Math.round(ingredients.reduce((total, ingredient) => total + (ingredient.caloriesKcal ?? 0), 0));
  if (totalCalories === 0 && ingredients.every(ingredient => ingredient.carbsGrams === 0 && ingredient.proteinGrams === 0 && ingredient.fatGrams === 0)) throw new Error('ไม่สามารถบันทึกมื้ออาหารที่ไม่มีข้อมูลโภชนาการได้');
  return { ingredients, totalCalories };
}

export function publicMeal(record: MealRecord): PublicMeal {
  return { id: record.id, name: record.name, mealType: record.mealType, imageData: record.imageData ?? null,
    activityDate: record.activityDate, totalCalories: record.totalCalories,
    ingredients: record.ingredients.map(({ id, ...ingredient }) => ({ id, ...ingredient })) };
}
