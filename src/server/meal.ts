import type { MealRecord, PublicMeal } from '../shared/contracts.js';

export function calculateMealCalories(ingredients: MealRecord['ingredients'] | { carbsGrams: number; proteinGrams: number; fatGrams: number }[]) {
  return Math.round(ingredients.reduce((total, ingredient) => total + ingredient.carbsGrams * 4 + ingredient.proteinGrams * 4 + ingredient.fatGrams * 9, 0));
}

export function publicMeal(record: MealRecord): PublicMeal {
  return {
    id: record.id, name: record.name, mealType: record.mealType, imageData: record.imageData ?? null,
    activityDate: record.activityDate, totalCalories: record.totalCalories,
    ingredients: record.ingredients.map(({ id, name, carbsGrams, sugarGrams, proteinGrams, fatGrams }) => ({
      id, name, carbsGrams, sugarGrams, proteinGrams, fatGrams,
    })),
  };
}
