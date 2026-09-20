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
const totalNutrient = (items: IngredientDraft[], key: "carbsGrams" | "proteinGrams" | "fatGrams") => {
  const values = items.map((item) => scaled(item)[key]);
  return values.some((value) => value == null) ? null : Math.round(values.reduce<number>((sum, value) => sum + (value as number), 0) * 10) / 10;
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
  const totalCalories = calories(ingredients);
  return <>
    <section className="meal-nutrition-overview" aria-label="สรุปโภชนาการมื้ออาหาร">
      <div className="meal-total-calories"><span>พลังงานรวม</span><strong>{totalCalories == null ? "ไม่ทราบ" : totalCalories}</strong><small>{totalCalories == null ? "ต้องมีข้อมูลสารอาหารครบ" : "กิโลแคลอรี"}</small></div>
      <div className="nutrition-summary-grid">
        {([['คาร์โบไฮเดรต', 'carbsGrams'], ['โปรตีน', 'proteinGrams'], ['ไขมัน', 'fatGrams']] as const).map(([label, key]) => {
          const value = totalNutrient(ingredients, key);
          return <div className="nutrition-card" key={key}><span>{label}</span><strong>{value == null ? "ไม่ทราบ" : value}</strong><small>{value == null ? "ข้อมูลไม่ครบ" : "กรัม"}</small></div>;
        })}
      </div>
    </section>
    {analysis && <div className="analysis-note" role="status"><strong>ค่าประมาณจาก AI</strong><span>{analysis.portionDescription}</span>{analysis.notes.map((note) => <small key={note}>{note}</small>)}<em>ลบรายการที่ไม่ตรงและปรับปริมาณก่อนบันทึก</em></div>}
    <div className="nutrient-heading"><h3>ส่วนประกอบ</h3><span>{ingredients.length} รายการ</span></div>
    <p className="nutrient-note">ปรับปริมาณหรือลบส่วนประกอบ แล้วกดคำนวณใหม่เพื่อยืนยันผลลัพธ์</p>
    {ingredients.map((ingredient, index) => {
      const value = scaled(ingredient);
      const serving = ingredient.unit === "serving";
      return <article className="ingredient-row portion-row" key={`${ingredient.name}-${index}`}>
        <div className="ingredient-card-heading"><strong>{ingredient.name || `ส่วนประกอบ ${index + 1}`}</strong><strong className="ingredient-calories">{value.caloriesKcal == null ? "ไม่ทราบ" : `${value.caloriesKcal} kcal`}</strong></div>
        <small className="ingredient-source">{ingredient.source === "legacy" ? "ส่วนเดิม · ไม่ทราบน้ำหนัก" : ingredient.source === "usda-fdc" ? "USDA FoodData Central" : "ค่าประมาณจาก AI"}</small>
        <label>{serving ? "ปริมาณ (ส่วน)" : "ปริมาณ (ก.)"}<input aria-label={`ปริมาณส่วนประกอบ ${index + 1}`} type="number" min="0.01" max="10000" step="any" value={ingredient.amount} onChange={(event) => onQuantityChange(index, event.target.value)} required /></label>
        <span className="ingredient-nutrients" aria-label={`สารอาหารส่วนประกอบ ${index + 1}`}>{value.caloriesKcal == null ? "พลังงานไม่ทราบ" : `${value.caloriesKcal} kcal`} · C {nutrient(value.carbsGrams)} · น้ำตาล {nutrient(value.sugarGrams)} · P {nutrient(value.proteinGrams)} · F {nutrient(value.fatGrams)}</span>
        <small>อ้างอิง {ingredient.referenceAmount} {ingredient.referenceUnit === "serving" ? "ส่วน" : "กรัม"}</small>
        <button className="remove-ingredient" type="button" onClick={() => onRemove(index)}>ลบ</button>
        {onReplaceRequest ? <button className="secondary replace-ingredient" type="button" onClick={() => onReplaceRequest(index)}>เลือกอาหารทดแทน</button> : <small className="replace-hint">เลือกอาหารทดแทนจากช่องค้นหาอาหารด้านบน</small>}
      </article>;
    })}
    {ingredients.length === 0 && <p className="empty-state">ลบส่วนประกอบแล้ว กรุณาเพิ่มรายการจากฐานข้อมูลก่อนบันทึก</p>}
    {onAdd && <button className="secondary add-ingredient" type="button" onClick={onAdd}>เพิ่มส่วนประกอบ</button>}
    {needsRecalculation && <p className="feedback" role="status">ข้อมูลเปลี่ยนแล้ว กรุณาคำนวณสารอาหารใหม่</p>}
    <button className="secondary manual-entry-button" type="button" onClick={onRecalculate} disabled={!ingredients.length}>คำนวณสารอาหารใหม่</button>
  </>;
}
