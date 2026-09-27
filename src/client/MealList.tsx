import type { PublicMeal } from "../shared/contracts";
import { mealOptions } from "./mealHelpers";

export function MealList({
  meals,
  busy,
  onEdit,
  onRemove,
}: {
  meals: { meals: PublicMeal[]; caloriesConsumed: number } | null;
  busy: boolean;
  onEdit: (meal: PublicMeal) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="meal-list">
      <div>
        <h3>รายการอาหารของวันที่เลือก</h3>
        <strong>{meals?.caloriesConsumed ?? 0} kcal</strong>
      </div>
      {!meals?.meals.length ? (
        <p className="empty-state">ยังไม่มีรายการอาหารในวันนี้</p>
      ) : (
        meals.meals.map((meal) => (
          <article key={meal.id}>
            {meal.imageData && <img src={meal.imageData} alt="" />}
            <div>
              <strong>{meal.name}</strong>
              <span>
                {
                  mealOptions.find((option) => option.id === meal.mealType)
                    ?.label
                }{" "}
                · {meal.totalCalories} kcal
              </span>
              <small>
                {meal.ingredients.map((ingredient) => `${ingredient.name} ${ingredient.amount} ${ingredient.unit === "serving" ? "ส่วน" : "ก."}`).join(" · ")}
              </small>
            </div>
            <div className="row-actions">
              <button type="button" onClick={() => onEdit(meal)}>
                แก้ไข
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(meal.id)}
              >
                ลบ
              </button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
