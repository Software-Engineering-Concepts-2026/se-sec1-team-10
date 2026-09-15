import type { MealInput } from '../shared/contracts';
export type FavoriteMeal = Pick<MealInput, 'name' | 'mealType' | 'ingredients'>;
const key = (userId: string) => `lifebalance-favorites:${userId}`;
function valid(value: unknown): value is FavoriteMeal {
  if (!value || typeof value !== 'object') return false;
  const item = value as FavoriteMeal;
  return typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 120 &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(item.mealType) &&
    Array.isArray(item.ingredients) && item.ingredients.length > 0 && item.ingredients.length <= 20 &&
    item.ingredients.every(ingredient => ingredient && typeof ingredient.name === 'string' &&
      ingredient.name.length > 0 && ingredient.name.length <= 120 &&
      [ingredient.carbsGrams, ingredient.sugarGrams, ingredient.proteinGrams, ingredient.fatGrams]
        .every(grams => typeof grams === 'number' && Number.isFinite(grams) && grams >= 0 && grams <= 10000));
}
export function readFavorites(userId: string): FavoriteMeal[] {
  try { const items: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? '[]'); return Array.isArray(items) ? items.filter(valid).slice(0, 30) : []; }
  catch { return []; }
}
export function rememberFavorite(userId: string, meal: FavoriteMeal) {
  try {
    if (!valid(meal)) return;
    localStorage.setItem(key(userId), JSON.stringify([meal, ...readFavorites(userId).filter(item => item.name !== meal.name)].slice(0, 30)));
    window.dispatchEvent(new Event('favorites-updated'));
  } catch { /* Saving a meal must still succeed when browser storage is unavailable. */ }
}
