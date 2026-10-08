import { Prisma, PrismaClient } from '@prisma/client';
import { catalogFoods } from './foodCatalogData.js';
import { normalizeFoodSearch } from '../src/server/foodCatalog.js';

const prisma = new PrismaClient();
// A shared database update only inserts missing curated keys. Existing foods are preserved.
async function main() {
  const result = await prisma.food.createMany({
    skipDuplicates: true,
    data: catalogFoods.map(food => ({
      ...food,
      aliases: [...new Set(food.aliases.map(normalizeFoodSearch).filter(Boolean))],
      servingAmount: 100, servingUnit: 'g', servingWeightGrams: 100,
      isCustom: false, createdByUserId: null,
    })),
  });
  console.log(`Added ${result.count} missing sourced foods; existing records unchanged.`);
}
main().catch((error: unknown) => {
  const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : 'UNKNOWN';
  console.error(`Food catalog update failed (${code}).`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
