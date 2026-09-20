import type { IngredientDraft } from "./mealHelpers";
import type { FoodSearchResult } from "./FoodSearchPanel";

const nutrient = (value: number | null | undefined) => value == null ? "ไม่ทราบ" : `${value}g`;
const scaled = (item: IngredientDraft) => {
  const factor = item.amount / item.referenceAmount;
  return Object.fromEntries(Object.entries(item.referenceNutrients).map(([key, value]) => [key, value == null ? null : Math.round(value * factor * 10) / 10]));
};
const calories = (items: IngredientDraft[]) => {
  const values = items.map((item) => scaled(item).caloriesKcal);
  return values.some((value) => value == null) ? null : Math.round(values.reduce<number>((sum, value) => sum + (value as number), 0));
};

export function MealIngredientEditor({ ingredients, analysis, needsRecalculation, onQuantityChange, onRemove, onReplace: _onReplace, onReplaceRequest, onAdd, onRecalculate }: {
  ingredients: IngredientDraft[];
  analysis: { portionDescription: string; notes: string[] } | null;
  needsRecalculation: boolean;
  onQuantityChange: (index: number, amount: string) => void;
  onRemove: (index: number) => void;
  onReplace: (index: number, food: FoodSearchResult) => void;
  onReplaceRequest?: (index: number) => void;
  onAdd?: () => void;
  onRecalculate: () => void;
}) {
  if (!analysis && ingredients.length === 0) return null;
  return <>
    {analysis && <div className="analysis-note" role="status"><strong>ค่าประมาณจาก AI</strong><span>{analysis.portionDescription}</span>{analysis.notes.map((note) => <small key={note}>{note}</small>)}<em>ลบรายการที่ไม่ตรงและปรับปริมาณก่อนบันทึก</em></div>}
    <div className="nutrient-heading"><h3>ส่วนประกอบ</h3><span>พลังงานรวม <strong>{calories(ingredients) == null ? "ไม่ทราบ" : `${calories(ingredients)} kcal`}</strong></span></div>
    <p className="nutrient-note">ปรับปริมาณหรือลบส่วนประกอบ แล้วกดคำนวณใหม่เพื่อยืนยันผลลัพธ์</p>
    {ingredients.map((ingredient, index) => {
      const value = scaled(ingredient);
      const serving = ingredient.unit === "serving";
      return <div className="ingredient-row portion-row" key={`${ingredient.name}-${index}`}>
        <strong>{ingredient.name || `ส่วนประกอบ ${index + 1}`}</strong>
        <small className="ingredient-source">{ingredient.source === "legacy" ? "ส่วนเดิม · ไม่ทราบน้ำหนัก" : ingredient.source === "usda-fdc" ? "USDA FoodData Central" : "ค่าประมาณจาก AI"}</small>
        <label>{serving ? "ปริมาณ (ส่วน)" : "ปริมาณ (ก.)"}<input aria-label={`ปริมาณส่วนประกอบ ${index + 1}`} type="number" min="0.01" max="10000" step="any" value={ingredient.amount} onChange={(event) => onQuantityChange(index, event.target.value)} required /></label>
        <span className="ingredient-nutrients" aria-label={`สารอาหารส่วนประกอบ ${index + 1}`}>{value.caloriesKcal == null ? "พลังงานไม่ทราบ" : `${value.caloriesKcal} kcal`} · C {nutrient(value.carbsGrams)} · น้ำตาล {nutrient(value.sugarGrams)} · P {nutrient(value.proteinGrams)} · F {nutrient(value.fatGrams)}</span>
        <small>อ้างอิง {ingredient.referenceAmount} {ingredient.referenceUnit === "serving" ? "ส่วน" : "กรัม"}</small>
        <button className="remove-ingredient" type="button" onClick={() => onRemove(index)}>ลบ</button>
        {onReplaceRequest ? <button className="secondary replace-ingredient" type="button" onClick={() => onReplaceRequest(index)}>เลือกอาหารทดแทน</button> : <small className="replace-hint">เลือกอาหารทดแทนจากช่องค้นหาอาหารด้านบน</small>}
      </div>;
    })}
    {ingredients.length === 0 && <p className="empty-state">ลบส่วนประกอบแล้ว กรุณาเพิ่มรายการจากฐานข้อมูลก่อนบันทึก</p>}
    {onAdd && <button className="secondary add-ingredient" type="button" onClick={onAdd}>เพิ่มส่วนประกอบ</button>}
    {needsRecalculation && <p className="feedback" role="status">ข้อมูลเปลี่ยนแล้ว กรุณาคำนวณสารอาหารใหม่</p>}
    <button className="secondary manual-entry-button" type="button" onClick={onRecalculate} disabled={!ingredients.length}>คำนวณสารอาหารใหม่</button>
  </>;
}
