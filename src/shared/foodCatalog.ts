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
