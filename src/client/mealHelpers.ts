import type { MealIngredientRecord, ReferenceNutrients } from "../shared/contracts";

export type Nutrients = ReferenceNutrients;
export type IngredientDraft = Omit<MealIngredientRecord, "id" | keyof ReferenceNutrients>;

export const mealOptions = [
  { id: "breakfast", label: "อาหารเช้า" },
  { id: "lunch", label: "อาหารกลางวัน" },
  { id: "dinner", label: "อาหารเย็น" },
  { id: "snack", label: "ของว่าง" },
] as const;

export const localDate = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export const nutrientValues = (item: Partial<Nutrients>): Nutrients => ({ caloriesKcal: item.caloriesKcal ?? null, carbsGrams: item.carbsGrams ?? null, sugarGrams: item.sugarGrams ?? null, proteinGrams: item.proteinGrams ?? null, fatGrams: item.fatGrams ?? null });
export const scaled = (item: IngredientDraft): Nutrients => {
  const factor = item.amount / item.referenceAmount;
  return Object.fromEntries(Object.entries(item.referenceNutrients).map(([key, value]) => [key, value === null ? null : Math.round(value * factor * 100) / 100])) as Nutrients;
};
export const emptyIngredient = (): IngredientDraft => ({ name: "", amount: 1, unit: "serving", referenceAmount: 1, referenceUnit: "serving", source: "legacy", referenceNutrients: nutrientValues({}) });

export const calories = (items: IngredientDraft[]) =>
  Math.round(
    items.reduce((total, item) => {
      const value = scaled(item);
      return total + (value.caloriesKcal ?? 0);
    }, 0),
  );
