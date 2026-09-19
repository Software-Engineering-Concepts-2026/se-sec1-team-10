import type { IngredientDraft } from "./mealHelpers";
import { calories, scaled } from "./mealHelpers";

export function MealIngredientEditor({
  ingredients,
  showManualFields,
  analysis,
  foodSource,
  needsRecalculation,
  onQuantityChange,
  onRemove,
  onRecalculate,
}: {
  ingredients: IngredientDraft[];
  showManualFields: boolean;
  analysis: { portionDescription: string; notes: string[] } | null;
  foodSource: "usda-fdc" | "ai-estimate" | null;
  needsRecalculation: boolean;
  onQuantityChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onRecalculate: () => void;
}) {
  if (!showManualFields && !analysis) return null;
  return (
    <>
      {analysis && (
        <div className="analysis-note" role="status">
          <strong>ค่าประมาณจาก AI</strong>
          <span>{analysis.portionDescription}</span>
          {analysis.notes.map((note) => (
            <small key={note}>{note}</small>
          ))}
          <em>ลบรายการที่ไม่ตรงและปรับปริมาณก่อนบันทึก</em>
        </div>
      )}
      {foodSource === "usda-fdc" && (
        <div className="source-note" role="status">
          <strong>อ้างอิง USDA FoodData Central</strong>
          <span>ปริมาณและผลรวมคำนวณจากข้อมูลต่อ 100 กรัม</span>
        </div>
      )}
      <div className="nutrient-heading">
        <h3>ส่วนประกอบ</h3>
        <span>
          พลังงานรวม <strong>{calories(ingredients)} kcal</strong>
        </span>
      </div>
      <p className="nutrient-note">
        ปรับปริมาณหรือลบส่วนประกอบได้ ระบบใช้ค่าสารอาหารตั้งต้นต่อ 100
        กรัมในการคำนวณ
      </p>
      {ingredients.map((ingredient, index) => {
        const value = scaled(ingredient);
        return (
          <div className="ingredient-row portion-row" key={index}>
            <strong>{ingredient.name || `ส่วนประกอบ ${index + 1}`}</strong>
            <label>
              ปริมาณ (ก.)
              <input
                aria-label={`ปริมาณส่วนประกอบ ${index + 1}`}
                type="number"
                min="0"
                max="10000"
                step="1"
                value={ingredient.quantityGrams}
                onChange={(event) =>
                  onQuantityChange(index, event.target.value)
                }
                required
              />
            </label>
            <span>
              C {value.carbsGrams}g · P {value.proteinGrams}g · F{" "}
              {value.fatGrams}g
            </span>
            <button
              className="remove-ingredient"
              type="button"
              onClick={() => onRemove(index)}
              disabled={ingredients.length === 1}
            >
              ลบ
            </button>
          </div>
        );
      })}
      {showManualFields && !analysis && (
        <p className="empty-state">
          รายการที่กรอกเองเริ่มต้นที่ 0 สารอาหาร
          แนะนำให้ค้นหาจากฐานข้อมูลหรือวิเคราะห์รูปเพื่อให้มีค่าตั้งต้น
        </p>
      )}
      {needsRecalculation && (
        <p className="feedback" role="status">
          ข้อมูลเปลี่ยนแล้ว กรุณาคำนวณสารอาหารใหม่
        </p>
      )}
      <button
        className="secondary manual-entry-button"
        type="button"
        onClick={onRecalculate}
      >
        คำนวณสารอาหารใหม่
      </button>
    </>
  );
}
