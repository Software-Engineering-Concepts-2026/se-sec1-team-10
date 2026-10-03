-- Keep existing per-serving data untouched until an actual gram weight is known.
ALTER TABLE "Food"
  ADD COLUMN "servingWeightGrams" DOUBLE PRECISION,
  ADD COLUMN "sourceName" TEXT,
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "catalogKey" TEXT;

CREATE UNIQUE INDEX "Food_catalogKey_key" ON "Food"("catalogKey");
ALTER TABLE "Food" ADD CONSTRAINT "Food_servingWeightGrams_check"
  CHECK ("servingWeightGrams" IS NULL OR "servingWeightGrams" > 0);

ALTER TABLE "MealIngredient" DROP CONSTRAINT "MealIngredient_source_check";
ALTER TABLE "MealIngredient" ADD CONSTRAINT "MealIngredient_source_check"
  CHECK ("source" IN ('usda-fdc', 'ai-estimate', 'legacy', 'manual', 'food-catalog'));
