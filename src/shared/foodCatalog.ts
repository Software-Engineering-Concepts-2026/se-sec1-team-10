import type { ReferenceNutrients } from './contracts.js';

export type CatalogFood = {
  id: string;
  name: string;
  nutrientsPer100g: ReferenceNutrients;
  source: 'food-catalog';
  sourceName: string | null;
  url: string | null;
  imageUrl: string | null;
};

/** Exact references remain account-scoped and distinguish ambiguous aliases. */
export type CatalogReference = CatalogFood & { aliases: string[] };
export type CatalogMatch = {
  index: number;
  name: string;
  status: 'matched' | 'not-found' | 'ambiguous' | 'incomplete';
  food?: CatalogFood;
};
