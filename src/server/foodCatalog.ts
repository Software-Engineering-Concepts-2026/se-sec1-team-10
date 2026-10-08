import type { Food } from '@prisma/client';
import type { CatalogFood } from '../shared/foodCatalog.js';

/** Alias keys share the same normalization during seed and search. */
export function normalizeFoodSearch(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Preserve missing nutrients; never guess the weight of a plate or piece. */
export function catalogFood(food: Food): CatalogFood | null {
  const grams = food.servingWeightGrams ?? (food.servingUnit === 'g' ? food.servingAmount : null);
  if (grams === null || !Number.isFinite(grams) || grams <= 0) return null;
  const scale = (value: number | null) => value === null ? null : Math.round(value * 100 / grams * 100) / 100;
  return {
    id: food.id, name: food.name, source: 'food-catalog',
    sourceName: food.sourceName, url: food.sourceUrl, imageUrl: food.imageUrl,
    nutrientsPer100g: {
      caloriesKcal: scale(food.caloriesKcal), carbsGrams: scale(food.carbsGrams),
      sugarGrams: scale(food.sugarGrams), proteinGrams: scale(food.proteinGrams), fatGrams: scale(food.fatGrams),
    },
  };
}
