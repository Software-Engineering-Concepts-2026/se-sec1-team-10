import { describe, expect, it } from 'vitest';
import type { Food } from '@prisma/client';
import { catalogFood, normalizeFoodSearch } from '../server/foodCatalog.js';

const food: Food = {
  id: 'rice', name: 'Rice', aliases: ['ข้าวสวย'], caloriesKcal: 260, carbsGrams: 56, sugarGrams: null,
  proteinGrams: 6, fatGrams: 0.6, servingAmount: 200, servingUnit: 'g',
  servingWeightGrams: null, sourceName: 'Reference', sourceUrl: 'https://example.org/reference',
  catalogKey: null, imageUrl: null, createdByUserId: null, isCustom: false,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('food catalog gram references', () => {
  it('normalizes alias searches without removing Thai marks', () => {
    expect(normalizeFoodSearch('  WHITE   Rice  ')).toBe('white rice');
    expect(normalizeFoodSearch('ข้าวสวย')).toBe('ข้าวสวย');
  });
  it('normalizes a measured portion to 100g and preserves unknown sugar', () => {
    expect(catalogFood(food)).toMatchObject({ source: 'food-catalog', nutrientsPer100g: {
      caloriesKcal: 130, carbsGrams: 28, sugarGrams: null, proteinGrams: 3, fatGrams: 0.3,
    } });
  });
  it('does not guess the weight of a legacy plate', () => {
    expect(catalogFood({ ...food, servingAmount: 1, servingUnit: 'จาน' })).toBeNull();
  });
  it('uses measured gram weight when the unit is a plate', () => {
    expect(catalogFood({ ...food, servingAmount: 1, servingUnit: 'จาน', servingWeightGrams: 200 })?.nutrientsPer100g.caloriesKcal).toBe(130);
  });
  it('rejects a zero or invalid weight', () => {
    expect(catalogFood({ ...food, servingWeightGrams: 0 })).toBeNull();
    expect(catalogFood({ ...food, servingWeightGrams: Infinity })).toBeNull();
  });
});
