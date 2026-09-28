ALTER TABLE "MealIngredient"
  ADD COLUMN "amount" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'serving',
  ADD COLUMN "referenceAmount" DOUBLE PRECISION NOT NULL DEFAULT 1,
  ADD COLUMN "referenceUnit" TEXT NOT NULL DEFAULT 'serving',
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN "referenceCaloriesKcal" DOUBLE PRECISION,
  ADD COLUMN "referenceCarbsGrams" DOUBLE PRECISION,
  ADD COLUMN "referenceSugarGrams" DOUBLE PRECISION,
  ADD COLUMN "referenceProteinGrams" DOUBLE PRECISION,
  ADD COLUMN "referenceFatGrams" DOUBLE PRECISION;

-- Existing nutrients are a saved legacy serving. Copy the basis so later reads can
-- identify it without claiming an unknown gram weight.
UPDATE "MealIngredient"
SET "referenceCarbsGrams" = "carbsGrams",
    "referenceSugarGrams" = "sugarGrams",
    "referenceProteinGrams" = "proteinGrams",
    "referenceFatGrams" = "fatGrams",
    "referenceCaloriesKcal" = ("carbsGrams" * 4) + ("proteinGrams" * 4) + ("fatGrams" * 9);

ALTER TABLE "MealIngredient"
  ADD CONSTRAINT "MealIngredient_amount_check" CHECK ("amount" > 0 AND "amount" <= 100000),
  ADD CONSTRAINT "MealIngredient_reference_amount_check" CHECK ("referenceAmount" > 0 AND "referenceAmount" <= 100000),
  ADD CONSTRAINT "MealIngredient_unit_check" CHECK ("unit" IN ('g', 'serving')),
  ADD CONSTRAINT "MealIngredient_reference_unit_check" CHECK ("referenceUnit" IN ('g', 'serving')),
  ADD CONSTRAINT "MealIngredient_matching_unit_check" CHECK ("unit" = "referenceUnit"),
  ADD CONSTRAINT "MealIngredient_source_check" CHECK ("source" IN ('usda-fdc', 'ai-estimate', 'legacy'));
