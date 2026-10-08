import { useEffect, useRef, useState } from "react";
import type { CatalogFood } from "../shared/foodCatalog";
import { api, ApiError } from "./api";

type LegacyUsdaFood = { fdcId: string | number; name: string; dataType: string; nutrientsPer100g: CatalogFood["nutrientsPer100g"]; source: "usda-fdc"; url?: string };
export type FoodSearchResult = CatalogFood | LegacyUsdaFood;

const completeNutrients = (food: FoodSearchResult) => Object.values(food.nutrientsPer100g).every((value) => typeof value === "number");
const foodId = (food: FoodSearchResult) => food.source === "food-catalog" ? food.id : String(food.fdcId);
const sourceLabel = (food: FoodSearchResult) => food.source === "food-catalog" ? food.sourceName ?? "ฐานข้อมูลอาหาร" : "USDA FoodData Central";

export function FoodSearchPanel({ onSelect, initialAmount }: { onSelect: (food: FoodSearchResult, portionGrams: number) => void; initialAmount?: number }) {
  const [query, setQuery] = useState(""); const [portion, setPortion] = useState(initialAmount == null ? "" : String(initialAmount)); const [foods, setFoods] = useState<FoodSearchResult[]>([]); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const requestRef = useRef(0);
  useEffect(() => setPortion(initialAmount == null ? "" : String(initialAmount)), [initialAmount]);
  async function search() {
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed.length > 80) { setMessage("กรุณาระบุชื่ออาหารระหว่าง 2 ถึง 80 ตัวอักษร"); return; }
    const request = ++requestRef.current;
    setBusy(true); setFoods([]); setMessage("");
    try { const result = await api<{ foods: FoodSearchResult[] }>(`/foods/catalog?q=${encodeURIComponent(trimmed)}`); const found = result.foods ?? []; if (request === requestRef.current) { setFoods(found); if (!found.length) setMessage("ไม่พบอาหารจากฐานข้อมูล"); } }
    catch (error) { if (request === requestRef.current) { setFoods([]); setMessage(error instanceof ApiError && error.status === 503 ? "ฐานข้อมูลอาหารยังไม่พร้อมใช้งาน กรุณาลองใหม่ภายหลัง" : error instanceof ApiError ? error.message : "ค้นหาอาหารไม่ได้ ลองใหม่"); } }
    finally { if (request === requestRef.current) setBusy(false); }
  }
  function changeQuery(value: string) { requestRef.current += 1; setQuery(value); setFoods([]); setMessage(""); setBusy(false); }
  function choose(food: FoodSearchResult) { const grams = Number(portion); if (!Number.isFinite(grams) || grams <= 0 || grams > 10000) { setMessage("กรุณาระบุปริมาณเป็นกรัมระหว่าง 1 ถึง 10,000"); return; } if (!completeNutrients(food)) { setMessage("รายการนี้มีสารอาหารไม่ครบ ยังใช้บันทึกไม่ได้"); return; } onSelect(food, grams); setMessage(`เติม ${Math.round(grams)} กรัมแล้ว ตรวจสอบข้อมูลก่อนบันทึก`); }
  return <section className="food-search" aria-labelledby="food-search-title"><div className="food-search-heading"><div><strong id="food-search-title">ค้นหาส่วนประกอบอาหาร</strong><span>อ้างอิงฐานข้อมูลอาหาร ต่อ 100 กรัม</span></div><label>ปริมาณ (กรัม)<input type="number" min="1" max="10000" step="1" value={portion} onChange={(event) => setPortion(event.target.value)} /></label></div><div className="food-search-row"><input aria-label="ค้นหาอาหาร" value={query} maxLength={80} placeholder="เช่น ข้าวสวย หรือ banana" onChange={(event) => changeQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void search(); } }} /><button className="secondary" type="button" onClick={() => void search()} disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหา"}</button></div>{message && <p className="food-search-message" role="status">{message}</p>}{foods.length > 0 && <div className="food-results">{foods.map((food) => { const complete = completeNutrients(food); const imageUrl = food.source === "food-catalog" ? food.imageUrl : null; return <div key={foodId(food)} className="food-result"><button type="button" onClick={() => choose(food)} disabled={!complete}>{imageUrl ? <img className="food-result-thumb" src={imageUrl} alt="" /> : <span className="food-result-thumb food-result-placeholder" aria-hidden="true">{food.name.slice(0,1)}</span>}<span><strong>{food.name}</strong><small>{sourceLabel(food)} · ต่อ 100 กรัม</small><span className="food-result-macros">{food.nutrientsPer100g.caloriesKcal == null ? "ไม่ทราบ kcal" : `${Math.round(food.nutrientsPer100g.caloriesKcal)} kcal`} · คาร์บ {food.nutrientsPer100g.carbsGrams == null ? "ไม่ทราบ" : `${Math.round(food.nutrientsPer100g.carbsGrams)} กรัม`} · โปรตีน {food.nutrientsPer100g.proteinGrams == null ? "ไม่ทราบ" : `${Math.round(food.nutrientsPer100g.proteinGrams)} กรัม`}</span></span></button>{!complete && <small className="food-search-message">สารอาหารไม่ครบ ยังใช้บันทึกไม่ได้</small>}{food.url && <a href={food.url} target="_blank" rel="noreferrer">แหล่งข้อมูล</a>}</div>; })}</div>}</section>;
}
