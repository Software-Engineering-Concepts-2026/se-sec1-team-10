import type { MealInput } from '../shared/contracts';
export type FavoriteMeal = Pick<MealInput, 'name' | 'mealType' | 'ingredients'>;
const key = (userId: string) => `lifebalance-favorites:${userId}`;
function valid(value: unknown): value is FavoriteMeal {
  if (!value || typeof value !== 'object') return false;
  const item = value as FavoriteMeal;
  return typeof item.name === 'string' && item.name.length > 0 && item.name.length <= 120 &&
    ['breakfast', 'lunch', 'dinner', 'snack'].includes(item.mealType) &&
    Array.isArray(item.ingredients) && item.ingredients.length > 0 && item.ingredients.length <= 20 &&
    item.ingredients.every(ingredient => ingredient && typeof ingredient.name === 'string' && ingredient.name.length > 0 && ingredient.name.length <= 120 &&
      typeof ingredient.amount === 'number' && Number.isFinite(ingredient.amount) && ingredient.amount > 0 && ingredient.amount <= 100000 &&
      typeof ingredient.referenceAmount === 'number' && Number.isFinite(ingredient.referenceAmount) && ingredient.referenceAmount > 0 && ingredient.referenceAmount <= 100000 &&
      ['g', 'serving'].includes(ingredient.unit) && ingredient.unit === ingredient.referenceUnit &&
      ['usda-fdc', 'ai-estimate', 'legacy'].includes(ingredient.source) && ingredient.referenceNutrients && typeof ingredient.referenceNutrients === 'object');
}
function normalize(value: unknown): FavoriteMeal | null {
  if (valid(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const old = value as { name?: unknown; mealType?: unknown; ingredients?: unknown };
  if (typeof old.name !== 'string' || !['breakfast', 'lunch', 'dinner', 'snack'].includes(String(old.mealType)) || !Array.isArray(old.ingredients)) return null;
  const ingredients = old.ingredients.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Record<string, unknown>;
    const values = ['carbsGrams', 'sugarGrams', 'proteinGrams', 'fatGrams'].map(key => source[key]);
    if (!values.every(value => typeof value === 'number' && Number.isFinite(value) && value >= 0)) return [];
    const [carbsGrams, sugarGrams, proteinGrams, fatGrams] = values as number[];
    return [{ name: String(source.name ?? ''), amount: 1, unit: 'serving' as const, referenceAmount: 1, referenceUnit: 'serving' as const, source: 'legacy' as const, referenceNutrients: { caloriesKcal: carbsGrams * 4 + proteinGrams * 4 + fatGrams * 9, carbsGrams, sugarGrams, proteinGrams, fatGrams } }];
  });
  const next = { name: old.name, mealType: old.mealType, ingredients } as FavoriteMeal;
  return valid(next) ? next : null;
}
export function readFavorites(userId: string): FavoriteMeal[] {
  try { const items: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? '[]'); return Array.isArray(items) ? items.flatMap(item => { const favorite = normalize(item); return favorite ? [favorite] : []; }).slice(0, 30) : []; }
  catch { return []; }
}
export function rememberFavorite(userId: string, meal: FavoriteMeal) {
  try {
    if (!valid(meal)) return;
    localStorage.setItem(key(userId), JSON.stringify([meal, ...readFavorites(userId).filter(item => item.name !== meal.name)].slice(0, 30)));
    window.dispatchEvent(new Event('favorites-updated'));
  } catch { /* Saving a meal must still succeed when browser storage is unavailable. */ }
}
