-- This is intentionally a follow-up migration. The prior ingredient-reference
-- migration may already have been applied to shared development databases.
ALTER TABLE "MealIngredient"
  DROP CONSTRAINT "MealIngredient_source_check";

ALTER TABLE "MealIngredient"
  ADD CONSTRAINT "MealIngredient_source_check"
  CHECK ("source" IN ('usda-fdc', 'ai-estimate', 'legacy', 'manual'));
