import { describe, expect, it } from 'vitest';
import type { Food } from '@prisma/client';
import { catalogFood, normalizeFoodSearch } from '../server/foodCatalog.js';
import { catalogFoods } from '../../prisma/foodCatalogData.js';

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
  it('keeps sourced catalog keys unique and all gram references complete', () => {
    expect(catalogFoods).toHaveLength(25);
    expect(new Set(catalogFoods.map(item => item.catalogKey)).size).toBe(catalogFoods.length);
    for (const item of catalogFoods) {
      for (const value of [item.caloriesKcal, item.carbsGrams, item.sugarGrams, item.proteinGrams, item.fatGrams]) {
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(new URL(item.sourceUrl).hostname).toMatch(/(^|\.)usda\.gov$/);
    }
  });
  it('separates cooked and raw pork references and scales each measured portion', () => {
    const raw = catalogFoods.find(item => item.catalogKey === 'usda-ndb-10060')!;
    const cooked = catalogFoods.find(item => item.catalogKey === 'usda-ndb-10061')!;
    expect(cooked.aliases).not.toContain('สันในหมูดิบ');
    expect(raw.caloriesKcal).toBe(109);
    expect(cooked).toMatchObject({ caloriesKcal: 143, proteinGrams: 26.17 });
    const normalized = catalogFood({ ...food, ...cooked, servingAmount: 100, servingWeightGrams: 100 });
    expect(normalized?.nutrientsPer100g).toMatchObject({ caloriesKcal: 143, proteinGrams: 26.17 });
  });
});
