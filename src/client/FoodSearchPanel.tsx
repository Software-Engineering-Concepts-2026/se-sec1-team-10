import { useState } from 'react';
import { api, ApiError } from './api';

export type FoodSearchResult = {
  fdcId: string | number;
  name: string;
  dataType: string;
  nutrientsPer100g: { caloriesKcal?: number | null; carbsGrams?: number | null; proteinGrams?: number | null; fatGrams?: number | null; sugarGrams?: number | null };
  source: 'usda-fdc';
  url?: string;
};

export function FoodSearchPanel({ onSelect }: { onSelect: (food: FoodSearchResult, portionGrams: number) => void }) {
  const [query, setQuery] = useState('');
  const [portion, setPortion] = useState('100');
  const [foods, setFoods] = useState<FoodSearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 80) { setMessage('กรุณาค้นหาด้วยชื่ออาหารอย่างน้อย 2 ตัวอักษร'); return; }
    setBusy(true); setMessage('');
    try {
      const result = await api<{ foods: FoodSearchResult[] }>(`/foods/search?q=${encodeURIComponent(trimmed)}`);
      const complete = (result.foods ?? []).filter(food => ['carbsGrams', 'proteinGrams', 'fatGrams', 'sugarGrams'].every(key => typeof food.nutrientsPer100g[key as keyof FoodSearchResult['nutrientsPer100g']] === 'number'));
      setFoods(complete);
      if (!complete.length) setMessage('ไม่พบอาหารที่มีสารอาหารครบสำหรับคำนวณ');
    } catch (error) { setFoods([]); setMessage(error instanceof ApiError && error.status === 503 ? 'ฐานข้อมูลอาหารยังไม่พร้อมใช้งาน คุณยังกรอกเองหรือใช้รูปอาหารได้' : error instanceof ApiError ? error.message : 'ค้นหาอาหารไม่ได้ ลองใหม่หรือกรอกข้อมูลเอง'); }
    finally { setBusy(false); }
  }
  function choose(food: FoodSearchResult) {
    const grams = Number(portion);
    if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) { setMessage('กรุณาระบุปริมาณเป็นกรัมระหว่าง 1 ถึง 10,000'); return; }
    onSelect(food, grams); setMessage(`เติม ${Math.round(grams)} กรัมแล้ว ตรวจสอบข้อมูลก่อนบันทึก`);
  }
  return <section className="food-search" aria-labelledby="food-search-title">
    <div className="food-search-heading"><div><strong id="food-search-title">ค้นหาอาหารสำเร็จรูป</strong><span>อ้างอิงฐานข้อมูล USDA ต่อ 100 กรัม</span></div><label>ปริมาณ (ก.)<input type="number" min="1" max="10000" step="1" value={portion} onChange={event => setPortion(event.target.value)} /></label></div>
    <div className="food-search-row"><input aria-label="ค้นหาอาหาร" value={query} maxLength={80} placeholder="เช่น ข้าวสวย หรือ banana" onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void search(); } }} /><button className="secondary" type="button" onClick={() => void search()} disabled={busy}>{busy ? 'กำลังค้นหา…' : 'ค้นหา'}</button></div>
    {message && <p className="food-search-message" role="status">{message}</p>}
    {foods.length > 0 && <div className="food-results">{foods.map(food => <div key={food.fdcId} className="food-result"><button type="button" onClick={() => choose(food)}><span><strong>{food.name}</strong><small>USDA · ต่อ 100 กรัม</small></span><span className="food-result-macros">{food.nutrientsPer100g.caloriesKcal == null ? '—' : `${Math.round(food.nutrientsPer100g.caloriesKcal)} kcal`} · C {Math.round(food.nutrientsPer100g.carbsGrams!)}g · P {Math.round(food.nutrientsPer100g.proteinGrams!)}g</span></button>{food.url && <a href={food.url} target="_blank" rel="noreferrer">แหล่งข้อมูล</a>}</div>)}</div>}
  </section>;
}
