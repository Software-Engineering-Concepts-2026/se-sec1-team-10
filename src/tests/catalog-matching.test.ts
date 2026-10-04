import { describe, expect, it } from 'vitest';
import { matchCatalogIngredients } from '../server/catalogMatching.js';
import { calculatedIngredient } from '../server/meal.js';
import type { MealInput } from '../shared/contracts.js';
import type { CatalogReference } from '../shared/foodCatalog.js';

const rice: CatalogReference = {
  id: 'rice', name: 'ข้าวสวย', aliases: ['cooked rice'], source: 'food-catalog',
  sourceName: 'Reference', url: 'https://example.org/reference', imageUrl: null,
  nutrientsPer100g: { caloriesKcal: 130, carbsGrams: 28, sugarGrams: 0, proteinGrams: 3, fatGrams: 0.3 },
};
const estimate: MealInput['ingredients'][number] = {
  name: 'COOKED   RICE', amount: 200, unit: 'g', referenceAmount: 200, referenceUnit: 'g', source: 'ai-estimate',
  referenceNutrients: { caloriesKcal: 999, carbsGrams: 50, sugarGrams: 5, proteinGrams: 1, fatGrams: 50 },
};

describe('AI component catalog matching', () => {
  it('uses catalog values and retains gram portions rather than image estimates', () => {
    const result = matchCatalogIngredients([estimate], [rice]);
    expect(result.catalogMatches[0]).toMatchObject({ index: 0, status: 'matched', food: { id: 'rice' } });
    expect(result.ingredients[0]).toMatchObject({ source: 'food-catalog', amount: 200, referenceAmount: 100, unit: 'g' });
    expect(calculatedIngredient(result.ingredients[0])).toMatchObject({ caloriesKcal: 260, carbsGrams: 56 });
    expect(calculatedIngredient({ ...result.ingredients[0], amount: 100 }).caloriesKcal).toBe(130);
  });
  it('does not substitute a similar food or a different preparation', () => {
    const original = { ...estimate, name: 'raw rice' };
    const result = matchCatalogIngredients([original], [rice]);
    expect(result.catalogMatches[0].status).toBe('not-found');
    expect(result.ingredients[0]).toEqual(original);
  });
  it('does not choose between two different records with the same alias', () => {
    const result = matchCatalogIngredients([estimate], [rice, { ...rice, id: 'other-rice', name: 'Other cooked rice' }]);
    expect(result.catalogMatches[0].status).toBe('ambiguous');
    expect(result.ingredients[0].source).toBe('ai-estimate');
  });
  it('preserves unknown values and does not label an incomplete reference as matched', () => {
    const result = matchCatalogIngredients([estimate], [{ ...rice, nutrientsPer100g: { ...rice.nutrientsPer100g, sugarGrams: null } }]);
    expect(result.catalogMatches[0].status).toBe('incomplete');
    expect(result.ingredients[0]).toEqual(estimate);
  });
  it('matches a known meal component and keeps an unmatched component as its AI estimate', () => {
    const chicken = { ...estimate, name: 'cooked chicken', amount: 120 };
    const result = matchCatalogIngredients([estimate, chicken], [rice]);
    expect(result.catalogMatches.map(match => match.status)).toEqual(['matched', 'not-found']);
    expect(result.ingredients[0]).toMatchObject({ source: 'food-catalog', amount: 200, referenceAmount: 100 });
    expect(result.ingredients[1]).toEqual(chicken);
  });
  it('deduplicates the same record and keeps metadata aligned with repeated components', () => {
    const result = matchCatalogIngredients([estimate, { ...estimate, amount: 50 }], [rice, rice]);
    expect(result.catalogMatches.map(match => [match.index, match.status])).toEqual([[0, 'matched'], [1, 'matched']]);
    expect(result.ingredients.map(ingredient => ingredient.amount)).toEqual([200, 50]);
  });
});
