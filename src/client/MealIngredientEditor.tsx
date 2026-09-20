import { useState, type FormEvent } from "react";
import type { IngredientDraft } from "./mealHelpers";

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

export function MealIngredientEditor({ ingredients, analysis, needsRecalculation, onQuantityChange, onRemove, onAdd, onAddManual, onRecalculate }: {
  ingredients: IngredientDraft[];
  analysis: { portionDescription: string; notes: string[] } | null;
  needsRecalculation: boolean;
  onQuantityChange: (index: number, amount: string) => void;
  onRemove: (index: number) => void;
  onAdd?: () => void;
  onAddManual?: (ingredient: { name: string; amount: number; unit: "g"; referenceAmount: 100; referenceUnit: "g"; source: "manual"; referenceNutrients: { caloriesKcal: number; carbsGrams: number; sugarGrams: number; proteinGrams: number; fatGrams: number } }) => void;
  onRecalculate: () => void;
}) {
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ name: "", amount: "", caloriesKcal: "", carbsGrams: "", sugarGrams: "", proteinGrams: "", fatGrams: "" });
  const [manualError, setManualError] = useState("");
  const openManual = () => { setManualOpen(true); onAdd?.(); };
  const addManual = (event: FormEvent) => {
    event.preventDefault();
    const values = { name: manual.name.trim(), amount: Number(manual.amount), caloriesKcal: Number(manual.caloriesKcal), carbsGrams: Number(manual.carbsGrams), sugarGrams: Number(manual.sugarGrams), proteinGrams: Number(manual.proteinGrams), fatGrams: Number(manual.fatGrams) };
    const nutrientKeys = ["caloriesKcal", "carbsGrams", "sugarGrams", "proteinGrams", "fatGrams"] as const;
    if (!values.name) { setManualError("กรุณากรอกชื่อส่วนประกอบ"); return; }
    if (!Number.isFinite(values.amount) || values.amount <= 0) { setManualError("กรุณาระบุปริมาณเป็นกรัมมากกว่า 0"); return; }
    if (nutrientKeys.some((key) => !Number.isFinite(values[key]) || values[key] < 0)) { setManualError("กรุณากรอกสารอาหารทุกช่องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป"); return; }
    onAddManual?.({ name: values.name, amount: values.amount, unit: "g", referenceAmount: 100, referenceUnit: "g", source: "manual", referenceNutrients: { caloriesKcal: values.caloriesKcal, carbsGrams: values.carbsGrams, sugarGrams: values.sugarGrams, proteinGrams: values.proteinGrams, fatGrams: values.fatGrams } });
    setManual({ name: "", amount: "", caloriesKcal: "", carbsGrams: "", sugarGrams: "", proteinGrams: "", fatGrams: "" }); setManualError(""); setManualOpen(false);
  };
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
        <small className="ingredient-source">{ingredient.source === "legacy" ? "ส่วนเดิม · ไม่ทราบน้ำหนัก" : ingredient.source === "usda-fdc" ? "USDA FoodData Central" : "ค่าประมาณจาก AI · ปริมาณเป็นกรัม"}</small>
        <label>{serving ? "ปริมาณ (ส่วน)" : "ปริมาณ (ก.)"}<input aria-label={`ปริมาณส่วนประกอบ ${index + 1}`} type="number" min="0.01" max="10000" step="any" value={ingredient.amount} onChange={(event) => onQuantityChange(index, event.target.value)} required /></label>
        <span className="ingredient-nutrients" aria-label={`สารอาหารส่วนประกอบ ${index + 1}`}>{value.caloriesKcal == null ? "พลังงานไม่ทราบ" : `${value.caloriesKcal} kcal`} · C {nutrient(value.carbsGrams)} · น้ำตาล {nutrient(value.sugarGrams)} · P {nutrient(value.proteinGrams)} · F {nutrient(value.fatGrams)}</span>
        <small>อ้างอิง {ingredient.referenceAmount} {ingredient.referenceUnit === "serving" ? "ส่วน" : "กรัม"}</small>
        <button className="remove-ingredient" type="button" onClick={() => onRemove(index)}>ลบ</button>
      </article>;
    })}
    {ingredients.length === 0 && <p className="empty-state">ลบส่วนประกอบแล้ว กรุณาเพิ่มรายการจากฐานข้อมูลก่อนบันทึก</p>}
    {onAdd && <button className="secondary add-ingredient" type="button" onClick={openManual}>เพิ่มส่วนประกอบ</button>}
    {manualOpen && <form className="manual-ingredient-form" onSubmit={addManual} noValidate><div className="manual-ingredient-heading"><h3>เพิ่มส่วนประกอบเอง</h3><button className="text-button" type="button" onClick={() => { setManualOpen(false); setManualError(""); }}>ยกเลิก</button></div><p>กรอกสารอาหารต่อ 100 กรัมให้ครบ ระบบจะไม่เติมค่าแทนให้</p><label>ชื่อส่วนประกอบ<input value={manual.name} onChange={(event) => setManual((current) => ({ ...current, name: event.target.value }))} required /></label><label>ปริมาณ (ก.)<input type="number" min="0.01" step="any" value={manual.amount} onChange={(event) => setManual((current) => ({ ...current, amount: event.target.value }))} required /></label><div className="manual-nutrient-grid">{([["พลังงาน (kcal)", "caloriesKcal"], ["คาร์โบไฮเดรต (g)", "carbsGrams"], ["น้ำตาล (g)", "sugarGrams"], ["โปรตีน (g)", "proteinGrams"], ["ไขมัน (g)", "fatGrams"]] as const).map(([label, key]) => <label key={key}>{label}<input type="number" min="0" step="any" value={manual[key]} onChange={(event) => setManual((current) => ({ ...current, [key]: event.target.value }))} required /></label>)}</div>{manualError && <p className="feedback error" role="alert">{manualError}</p>}<button className="primary" type="submit">เพิ่มส่วนประกอบ</button></form>}
    {needsRecalculation && <p className="feedback" role="status">ข้อมูลเปลี่ยนแล้ว กรุณาคำนวณสารอาหารใหม่</p>}
    <button className="secondary manual-entry-button" type="button" onClick={onRecalculate} disabled={!ingredients.length}>คำนวณสารอาหารใหม่</button>
  </>;
}
