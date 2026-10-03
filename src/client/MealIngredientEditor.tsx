import { useState } from "react";
import { api, ApiError } from "./api";
import { scaled, type IngredientDraft } from "./mealHelpers";

const display = (value: number | null) => value === null ? "ไม่ทราบ" : String(Math.round(value * 10) / 10);

export function MealIngredientEditor({ ingredients, analysis, needsRecalculation, onQuantityChange, onRemove, onAdd, onAddManual, onRecalculate, onEstimating }: {
  ingredients: IngredientDraft[];
  analysis: { portionDescription: string; notes: string[] } | null;
  needsRecalculation: boolean;
  onQuantityChange: (index: number, amount: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  onAddManual: (ingredient: IngredientDraft) => void;
  onRecalculate: () => void;
  onEstimating: (busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const values = ingredients.map(scaled);
  const total = (key: keyof IngredientDraft['referenceNutrients']) =>
    values.some(value => value[key] === null) ? null : values.reduce((sum, value) => sum + (value[key] ?? 0), 0);

  async function add() {
    if (busy) return;
    const grams = Number(amount);
    if (name.trim().length < 2 || name.trim().length > 120 || !amount.trim() || !Number.isFinite(grams) || grams <= 0 || grams > 10000) {
      setError("กรุณาระบุชื่อส่วนประกอบ และปริมาณมากกว่า 0 ถึง 10,000 กรัม");
      return;
    }
    setBusy(true);
    onEstimating(true);
    setError("");
    try {
      const result = await api<{ ingredient: IngredientDraft; catalogMatch?: IngredientDraft["catalogMatch"] }>("/foods/estimate", { name: name.trim(), amount: grams });
      onAddManual({ ...result.ingredient, ...(result.catalogMatch ? { catalogMatch: result.catalogMatch } : {}) });
      setName("");
      setAmount("");
      setOpen(false);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "เชื่อมต่อไม่ได้ ข้อมูลที่กรอกยังอยู่ กรุณาลองใหม่");
    } finally {
      setBusy(false);
      onEstimating(false);
    }
  }

  return <>
    <section className="meal-nutrition-overview" aria-label="สรุปโภชนาการมื้ออาหาร">
      <div className="meal-total-calories"><span>พลังงานรวม</span><strong>{needsRecalculation ? "รอคำนวณใหม่" : display(total('caloriesKcal'))}</strong><small>กิโลแคลอรี</small></div>
      <div className="nutrition-summary-grid">
        {([['คาร์โบไฮเดรต', 'carbsGrams'], ['โปรตีน', 'proteinGrams'], ['ไขมัน', 'fatGrams']] as const).map(([label, key]) =>
          <div className="nutrition-card" key={key}><span>{label}</span><strong>{needsRecalculation ? "—" : display(total(key))}</strong><small>กรัม</small></div>)}
      </div>
    </section>
    {analysis && <details className="analysis-note"><summary>รายละเอียดการประมาณจาก AI</summary><p>{analysis.portionDescription}</p>{analysis.notes.map(note => <small key={note}>{note}</small>)}</details>}
    <div className="nutrient-heading"><h3>ส่วนประกอบ</h3><span>{ingredients.length} รายการ</span></div>
    {ingredients.map((ingredient, index) => <article className="ingredient-row portion-row" key={`${ingredient.name}-${index}`}>
      <div className="ingredient-card-heading"><strong>{ingredient.name}</strong><strong className="ingredient-calories">{needsRecalculation ? "รอคำนวณ" : `${display(values[index].caloriesKcal)} kcal`}</strong></div>
      <label>ปริมาณ ({ingredient.unit === 'g' ? 'กรัม' : 'ส่วนเดิม'})<input aria-label={`ปริมาณส่วนประกอบ ${index + 1}`} type="number" min="0.01" max="10000" step="any" value={ingredient.amount || ''} onChange={event => onQuantityChange(index, event.target.value)} required /></label>
      <small>{ingredient.source === 'ai-estimate' ? 'ค่าประมาณจาก AI' : ingredient.source === 'usda-fdc' ? 'USDA FoodData Central' : ingredient.source === 'food-catalog' ? 'ฐานข้อมูลอาหาร' : ingredient.source === 'manual' ? 'ข้อมูลที่กรอกเอง' : 'ข้อมูลเดิม · ไม่ทราบน้ำหนักเป็นกรัม'}</small>
      {ingredient.catalogMatch?.status === 'matched' && ingredient.catalogMatch.food && <small className="catalog-match-feedback">{ingredient.catalogMatch.food.sourceName ?? 'ฐานข้อมูลอาหาร'}{ingredient.catalogMatch.food.url && <> · <a href={ingredient.catalogMatch.food.url} target="_blank" rel="noreferrer">แหล่งข้อมูล</a></>}{ingredient.photoEstimate && <> · ปริมาณยังเป็นค่าประมาณจากภาพ</>}</small>}
      {ingredient.catalogMatch && ingredient.catalogMatch.status !== 'matched' && <small className="catalog-match-warning" role="status">{ingredient.catalogMatch.status === 'ambiguous' ? 'ยังจับคู่กับฐานข้อมูลอาหารไม่ได้แน่ชัด' : ingredient.catalogMatch.status === 'incomplete' ? 'ข้อมูลสารอาหารในฐานข้อมูลยังไม่ครบ' : 'ไม่พบในฐานข้อมูลอาหาร'} · ยังคงเป็นค่าประมาณจาก AI สามารถลบหรือค้นหาจากฐานข้อมูลได้</small>}
      {ingredient.photoEstimate && !ingredient.catalogMatch && ingredient.source === 'ai-estimate' && <small className="catalog-match-warning" role="status">ยังเป็นค่าประมาณจาก AI สามารถลบหรือค้นหาจากฐานข้อมูลได้</small>}
      <button className="remove-ingredient" type="button" aria-label={`ลบ ${ingredient.name}`} onClick={() => onRemove(index)}>ลบ</button>
    </article>)}
    {!ingredients.length && <p className="empty-state">ยังไม่มีส่วนประกอบ เพิ่มรายการหรือวิเคราะห์รูปอาหารเพื่อเริ่มต้น</p>}
    <button className="secondary add-ingredient" type="button" onClick={() => { setOpen(true); setError(''); }}>เพิ่มส่วนประกอบ</button>
    {open && <section className="manual-ingredient-form" aria-label="เพิ่มส่วนประกอบ" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void add(); } }}>
      <div className="manual-ingredient-heading"><h3>เพิ่มส่วนประกอบ</h3><button type="button" disabled={busy} onClick={() => setOpen(false)}>ยกเลิก</button></div>
      <p>ระบุชื่อและกรัม ให้ AI ประมาณสารอาหาร แล้วตรวจสอบก่อนบันทึก</p>
      <label>ชื่อส่วนประกอบ<input autoFocus maxLength={120} disabled={busy} value={name} placeholder="เช่น ข้าวสวยสุก" onChange={event => setName(event.target.value)} /></label>
      <label>ปริมาณที่เพิ่ม (กรัม)<input type="number" min="0.01" max="10000" step="any" disabled={busy} value={amount} onChange={event => setAmount(event.target.value)} /></label>
      {error && <p className="feedback error" role="alert">{error}</p>}
      <button type="button" className="primary" disabled={busy} onClick={() => void add()}>{busy ? 'กำลังประมาณสารอาหาร…' : 'ประมาณและเพิ่มส่วนประกอบ'}</button>
      <button type="button" className="text-button" disabled={busy} onClick={() => { setOpen(false); onAdd(); }}>ค้นหาจากฐานข้อมูลอาหาร</button>
    </section>}
    {needsRecalculation && <p className="feedback" role="status">ข้อมูลเปลี่ยนแล้ว กรุณาคำนวณสารอาหารใหม่</p>}
    <button className="secondary manual-entry-button" type="button" onClick={onRecalculate} disabled={!ingredients.length || busy}>คำนวณสารอาหารใหม่</button>
  </>;
}
