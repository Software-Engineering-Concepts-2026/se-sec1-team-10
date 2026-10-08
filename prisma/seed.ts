import { Prisma, PrismaClient } from '@prisma/client';
import { catalogFoods } from './foodCatalogData.js';
import { normalizeFoodSearch } from '../src/server/foodCatalog.js';

const prisma = new PrismaClient();

// Updates are limited to sourced foods carrying a stable catalog key.

async function main() {
  for (const food of catalogFoods) {
    const curatedFields = {
      name: food.name,
      aliases: [...new Set(food.aliases.map(normalizeFoodSearch).filter(Boolean))],
      caloriesKcal: food.caloriesKcal,
      carbsGrams: food.carbsGrams,
      sugarGrams: food.sugarGrams,
      proteinGrams: food.proteinGrams,
      fatGrams: food.fatGrams,
      servingAmount: 100,
      servingUnit: 'g',
      servingWeightGrams: 100,
      sourceName: food.sourceName,
      sourceUrl: food.sourceUrl,
      isCustom: false,
      createdByUserId: null,
    };

    await prisma.food.upsert({
      where: { catalogKey: food.catalogKey },
      create: { ...curatedFields, catalogKey: food.catalogKey },
      update: curatedFields,
    });
  }
  console.log(`Food catalog seeded: ${catalogFoods.length} sourced foods.`);
}

main()
  .catch((error: unknown) => {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNKNOWN';
    console.error(`Food catalog seed failed (${code}).`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
