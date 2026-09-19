import type { MealIngredientRecord } from "../shared/contracts";

export type Nutrients = Pick<
  MealIngredientRecord,
  "carbsGrams" | "sugarGrams" | "proteinGrams" | "fatGrams"
>;
export type IngredientDraft = Omit<MealIngredientRecord, "id"> & {
  quantityGrams: number;
  nutrientsPer100g: Nutrients;
};

export const mealOptions = [
  { id: "breakfast", label: "อาหารเช้า" },
  { id: "lunch", label: "อาหารกลางวัน" },
  { id: "dinner", label: "อาหารเย็น" },
  { id: "snack", label: "ของว่าง" },
] as const;

export const localDate = () => new Date().toISOString().slice(0, 10);

export const nutrientValues = (item: {
  carbsGrams?: number | null;
  sugarGrams?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
}): Nutrients => ({
  carbsGrams: Number(item.carbsGrams) || 0,
  sugarGrams: Number(item.sugarGrams) || 0,
  proteinGrams: Number(item.proteinGrams) || 0,
  fatGrams: Number(item.fatGrams) || 0,
});

export const withQuantity = (
  item: Omit<IngredientDraft, "quantityGrams" | "nutrientsPer100g">,
  quantityGrams = 100,
): IngredientDraft => ({
  ...item,
  ...nutrientValues(item),
  quantityGrams,
  nutrientsPer100g: nutrientValues(item),
});

export const scaled = (item: IngredientDraft): Nutrients => {
  const factor = Math.max(0, Number(item.quantityGrams) || 0) / 100;
  return Object.fromEntries(
    Object.entries(item.nutrientsPer100g).map(([key, value]) => [
      key,
      Math.round(Number(value) * factor * 10) / 10,
    ]),
  ) as Nutrients;
};

export const emptyIngredient = () =>
  withQuantity({
    name: "",
    carbsGrams: 0,
    sugarGrams: 0,
    proteinGrams: 0,
    fatGrams: 0,
  });

export const calories = (items: IngredientDraft[]) =>
  Math.round(
    items.reduce((total, item) => {
      const value = scaled(item);
      return (
        total +
        value.carbsGrams * 4 +
        value.proteinGrams * 4 +
        value.fatGrams * 9
      );
    }, 0),
  );
