import type { MealInput } from '../shared/contracts.js';
import type { CatalogFood, CatalogMatch, CatalogReference } from '../shared/foodCatalog.js';
import { normalizeFoodSearch } from './foodCatalog.js';

const validNutrients = (food: CatalogFood) => Object.values(food.nutrientsPer100g).every(value =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0,
);

export function matchCatalogIngredients(
  ingredients: MealInput['ingredients'],
  references: CatalogReference[],
): { ingredients: MealInput['ingredients']; catalogMatches: CatalogMatch[] } {
  const catalogMatches: CatalogMatch[] = [];
  const matchedIngredients = ingredients.map((ingredient, index) => {
    const term = normalizeFoodSearch(ingredient.name);
    const candidates = new Map<string, CatalogReference>();
    for (const reference of references) {
      if (normalizeFoodSearch(reference.name) === term || reference.aliases.some(alias => normalizeFoodSearch(alias) === term)) {
        candidates.set(reference.id, reference);
      }
    }
    const list = [...candidates.values()];
    if (list.length === 0) {
      catalogMatches.push({ index, name: ingredient.name, status: 'not-found' });
      return ingredient;
    }
    if (list.length > 1) {
      catalogMatches.push({ index, name: ingredient.name, status: 'ambiguous' });
      return ingredient;
    }
    const reference = list[0];
    if (!validNutrients(reference)) {
      catalogMatches.push({ index, name: ingredient.name, status: 'incomplete', food: reference });
      return ingredient;
    }
    catalogMatches.push({ index, name: ingredient.name, status: 'matched', food: reference });
    return {
      ...ingredient,
      name: reference.name.slice(0, 120),
      amount: ingredient.amount,
      unit: 'g' as const,
      referenceAmount: 100,
      referenceUnit: 'g' as const,
      source: 'food-catalog' as const,
      referenceNutrients: reference.nutrientsPer100g,
    };
  });
  return { ingredients: matchedIngredients, catalogMatches };
}
