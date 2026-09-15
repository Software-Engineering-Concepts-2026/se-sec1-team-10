import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { MealIngredientRecord, PublicMeal } from '../shared/contracts';
import { api, ApiError } from './api';
import type { FavoriteMeal } from './FavoriteMealsPanel';
import { rememberFavorite } from './favorites';
import { FoodSearchPanel, type FoodSearchResult } from './FoodSearchPanel';

type IngredientDraft = Omit<MealIngredientRecord, 'id'>;
type DailyMeals = { date: string; meals: PublicMeal[]; caloriesConsumed: number };
type Analysis = { name: string; mealType: string; ingredients: IngredientDraft[]; portionDescription: string; source: 'ai-estimate'; notes: string[] };
const mealOptions = [{ id: 'breakfast', label: 'อาหารเช้า' }, { id: 'lunch', label: 'อาหารกลางวัน' }, { id: 'dinner', label: 'อาหารเย็น' }, { id: 'snack', label: 'ของว่าง' }] as const;
const emptyIngredient = (): IngredientDraft => ({ name: '', carbsGrams: 0, sugarGrams: 0, proteinGrams: 0, fatGrams: 0 });
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const calories = (ingredients: IngredientDraft[]) => Math.round(ingredients.reduce((total, item) => total + item.carbsGrams * 4 + item.proteinGrams * 4 + item.fatGrams * 9, 0));

export function MealPanel({ userId }: { userId: string }) {
  const [date, setDate] = useState(localDate);
  const [meals, setMeals] = useState<DailyMeals | null>(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showManualFields, setShowManualFields] = useState(false);
  const [foodSource, setFoodSource] = useState<'usda-fdc' | 'ai-estimate' | null>(null);
  const analysisRequest = useRef(0);
  const draftRevision = useRef(0);
  const loadRequest = useRef(0);

  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);

  async function load(selectedDate = date) {
    const request = ++loadRequest.current;
    try { const result = await api<DailyMeals>(`/meals/daily?date=${encodeURIComponent(selectedDate)}`); if (request === loadRequest.current) setMeals(result); }
    catch (error) { setMessage({ text: error instanceof ApiError ? error.message : 'โหลดรายการอาหารไม่ได้', error: true }); }
  }
  useEffect(() => { void load(date); }, [date]);
  const reset = () => { analysisRequest.current += 1; draftRevision.current += 1; setAnalyzing(false); setName(''); setMealType('breakfast'); setIngredients([emptyIngredient()]); setImageData(null); setAnalysis(null); setFoodSource(null); setShowManualFields(false); setEditingId(null); [cameraInput.current, uploadInput.current].forEach(input => { if (input) input.value = ''; }); };
  useEffect(() => {
    const useFavorite = (event: Event) => {
      const favorite = (event as CustomEvent<FavoriteMeal>).detail;
      if (!favorite) return;
      analysisRequest.current += 1; draftRevision.current += 1; setAnalyzing(false); setName(favorite.name); setMealType(favorite.mealType); setIngredients(favorite.ingredients); setImageData(null); setAnalysis(null); setFoodSource(null); setShowManualFields(true); setEditingId(null);
      setMessage({ text: `เติมข้อมูล ${favorite.name} แล้ว ตรวจสอบและบันทึกได้เลย`, error: false });
    };
    window.addEventListener('favorite-selected', useFavorite);
    return () => window.removeEventListener('favorite-selected', useFavorite);
  }, []);
  const updateIngredient = (index: number, field: keyof IngredientDraft, value: string) => { draftRevision.current += 1; setIngredients(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'name' ? value : Math.max(0, Number(value) || 0) } : item)); };
  function applyFood(food: FoodSearchResult, portionGrams: number) {
    const factor = portionGrams / 100; const n = food.nutrientsPer100g;
    analysisRequest.current += 1; draftRevision.current += 1; setAnalyzing(false); setEditingId(null); setName(food.name.slice(0, 120)); setFoodSource('usda-fdc'); setAnalysis(null); setImageData(null); setShowManualFields(true);
    setIngredients([{ name: `${food.name.slice(0, 105)} (${Math.round(portionGrams)} ก.)`.slice(0, 120), carbsGrams: Math.round(Number(n.carbsGrams) * factor * 10) / 10, sugarGrams: Math.round(Number(n.sugarGrams) * factor * 10) / 10, proteinGrams: Math.round(Number(n.proteinGrams) * factor * 10) / 10, fatGrams: Math.round(Number(n.fatGrams) * factor * 10) / 10 }]);
  }
  async function compressImage(file: File): Promise<string> {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('อ่านรูปไม่ได้')); image.src = URL.createObjectURL(file); });
    const scale = Math.min(1, 768 / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext('2d'); if (!context) throw new Error('ไม่สามารถเตรียมรูปได้'); context.drawImage(source, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(source.src);
    let quality = .82; let result = canvas.toDataURL('image/jpeg', quality);
    while (result.length * .75 > 200_000 && quality > .42) { quality -= .08; result = canvas.toDataURL('image/jpeg', quality); }
    if (result.length * .75 > 200_000) throw new Error('รูปนี้ยังใหญ่เกินไป ลองเลือกภาพที่เล็กลง');
    return result;
  }
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setMessage({ text: 'เลือกรูปภาพอาหารที่ถูกต้อง', error: true }); event.target.value = ''; return; }
    const pickerRequest = ++analysisRequest.current; draftRevision.current += 1; setAnalyzing(false); setAnalysis(null);
    try { const compressed = await compressImage(file); if (pickerRequest !== analysisRequest.current) return; setImageData(compressed); setFoodSource(null); setShowManualFields(false); setMessage({ text: 'เตรียมรูปแล้ว กดวิเคราะห์เพื่อรับค่าประมาณ', error: false }); }
    catch (error) { setMessage({ text: error instanceof Error ? error.message : 'เตรียมรูปไม่ได้', error: true }); event.target.value = ''; }
  }
  async function analyzeImage() {
    if (!imageData || analyzing) return;
    const requestId = ++analysisRequest.current; const imageAtRequest = imageData; const revisionAtRequest = draftRevision.current;
    setAnalyzing(true); setMessage(null);
    try {
      const result = await api<{ analysis: Analysis }>('/meals/analyze', { imageData: imageAtRequest });
      if (requestId !== analysisRequest.current || imageAtRequest !== imageData || revisionAtRequest !== draftRevision.current) return;
      const next = result.analysis; setName(next.name); setMealType(next.mealType); setFoodSource('ai-estimate'); setIngredients(next.ingredients.map(item => ({ ...emptyIngredient(), ...item, carbsGrams: Number(item.carbsGrams) || 0, sugarGrams: Number(item.sugarGrams) || 0, proteinGrams: Number(item.proteinGrams) || 0, fatGrams: Number(item.fatGrams) || 0 })));
      setAnalysis(next); setShowManualFields(true); setMessage({ text: 'วิเคราะห์แล้ว ตรวจสอบและแก้ไขข้อมูลก่อนบันทึก', error: false });
    } catch (error) { if (requestId === analysisRequest.current) setMessage({ text: error instanceof ApiError ? `${error.message} คุณยังกรอกข้อมูลเองแล้วบันทึกได้` : 'วิเคราะห์รูปไม่ได้ คุณยังกรอกข้อมูลเองแล้วบันทึกได้', error: true }); }
    finally { if (requestId === analysisRequest.current) setAnalyzing(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const body = { name, mealType, activityDate: date, imageData, ingredients };
    try {
      const result = await api<{ meal: PublicMeal }>(editingId ? `/meals/${editingId}` : '/meals', body, editingId ? 'PUT' : 'POST');
      rememberFavorite(userId, { name: result.meal.name, mealType: result.meal.mealType as FavoriteMeal['mealType'], ingredients });
      setMessage({ text: editingId ? 'แก้ไขอาหารแล้ว' : 'บันทึกอาหารแล้ว', error: false }); reset(); await load(); window.dispatchEvent(new Event('daily-calories-updated'));
    } catch (error) { setMessage({ text: error instanceof ApiError ? error.message : 'บันทึกอาหารไม่ได้', error: true }); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setMessage(null);
    try { await api(`/meals/${id}`, {}, 'DELETE'); setMessage({ text: 'ลบรายการอาหารแล้ว', error: false }); if (editingId === id) reset(); await load(); window.dispatchEvent(new Event('daily-calories-updated')); }
    catch (error) { setMessage({ text: error instanceof ApiError ? error.message : 'ลบรายการอาหารไม่ได้', error: true }); }
    finally { setBusy(false); }
  }
  function edit(meal: PublicMeal) { analysisRequest.current += 1; draftRevision.current += 1; setAnalyzing(false); setEditingId(meal.id); setName(meal.name); setMealType(meal.mealType); setIngredients(meal.ingredients.map(({ id: _id, ...ingredient }) => ingredient)); setImageData(meal.imageData ?? null); setAnalysis(null); setFoodSource(null); setShowManualFields(true); setMessage(null); }
  const previewCalories = calories(ingredients);

  return <section className="card meal-panel" aria-labelledby="meal-title">
    <div className="exercise-heading"><div><span className="eyebrow">DAILY NUTRITION</span><h2 id="meal-title">บันทึกอาหาร</h2><p className="muted">เพิ่มอาหารในแต่ละมื้อ ระบบคำนวณพลังงานจากคาร์บ โปรตีน และไขมันให้อัตโนมัติ</p></div><label className="compact-field">วันที่<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    {message && <div className={`feedback ${message.error ? 'error' : 'success'}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    <form className="meal-form" onSubmit={save}><fieldset disabled={busy || analyzing}>
      <div className="image-picker"><input ref={cameraInput} id="meal-camera" type="file" accept="image/*" capture="environment" onChange={chooseImage} /><input ref={uploadInput} id="meal-upload" type="file" accept="image/*" onChange={chooseImage} />{imageData ? <img src={imageData} alt="ตัวอย่างรูปอาหาร" /> : <div className="image-choice"><strong>เพิ่มรูปอาหาร</strong><span>ถ่ายรูปใหม่หรือเลือกจากอัลบั้ม</span><div><button className="secondary" type="button" onClick={() => cameraInput.current?.click()}>ถ่ายรูป</button><button className="secondary" type="button" onClick={() => uploadInput.current?.click()}>อัลบั้ม</button></div></div>}{imageData && <div className="image-actions"><button className="secondary" type="button" onClick={() => void analyzeImage()} disabled={analyzing}>{analyzing ? 'กำลังวิเคราะห์…' : 'วิเคราะห์รูป'}</button><button className="text-button" type="button" onClick={() => { analysisRequest.current += 1; draftRevision.current += 1; setAnalyzing(false); setImageData(null); setAnalysis(null); [cameraInput.current, uploadInput.current].forEach(input => { if (input) input.value = ''; }); }}>ลบรูป</button></div>}</div>
      <details className="food-search-details"><summary>ค้นหาจากฐานข้อมูลอาหาร</summary><FoodSearchPanel onSelect={applyFood} /></details>
      <div className="meal-top-row"><label className="compact-field">มื้ออาหาร<select value={mealType} onChange={event => { draftRevision.current += 1; setMealType(event.target.value); }}>{mealOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="compact-field meal-name">ชื่ออาหาร<input value={name} maxLength={120} placeholder="เช่น ข้าวมันไก่" onChange={event => { draftRevision.current += 1; setName(event.target.value); }} required /></label></div>
      {!showManualFields && !analysis && <button className="secondary manual-entry-button" type="button" onClick={() => setShowManualFields(true)}>กรอกสารอาหารเอง</button>}
      {analysis && <div className="analysis-note" role="status"><strong>ค่าประมาณจาก AI</strong><span>{analysis.portionDescription}</span>{analysis.notes.map(note => <small key={note}>{note}</small>)}<em>ตรวจสอบข้อมูลก่อนบันทึกทุกครั้ง</em></div>}
      {foodSource === 'usda-fdc' && <div className="source-note" role="status"><strong>อ้างอิง USDA FoodData Central</strong><span>คำนวณตามปริมาณกรัมที่คุณระบุ ตรวจสอบและแก้ไขก่อนบันทึก</span></div>}
      {(showManualFields || analysis) && <>
      <div className="nutrient-heading"><h3>ส่วนประกอบและสารอาหาร</h3><span>พลังงานรวม <strong>{previewCalories} kcal</strong></span></div>
      <p className="nutrient-note">น้ำตาลเป็นส่วนหนึ่งของคาร์โบไฮเดรต จึงแสดงแยกแต่ไม่ถูกนับพลังงานซ้ำ</p>
      {ingredients.map((ingredient, index) => <div className="ingredient-row" key={index}><input aria-label={`ชื่อส่วนประกอบ ${index + 1}`} value={ingredient.name} maxLength={120} placeholder="เช่น ข้าวสวย" onChange={event => updateIngredient(index, 'name', event.target.value)} required />{(['carbsGrams', 'sugarGrams', 'proteinGrams', 'fatGrams'] as const).map(field => <label key={field}>{({ carbsGrams: 'คาร์บ', sugarGrams: 'น้ำตาล', proteinGrams: 'โปรตีน', fatGrams: 'ไขมัน' } as Record<string, string>)[field]}<input aria-label={`${field} ${index + 1}`} type="number" min="0" max="10000" step="0.1" value={ingredient[field]} onChange={event => updateIngredient(index, field, event.target.value)} required /><small>ก.</small></label>)}{ingredients.length > 1 && <button className="remove-ingredient" type="button" onClick={() => setIngredients(current => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</button>}</div>)}
      <button className="secondary add-ingredient" type="button" onClick={() => setIngredients(current => [...current, emptyIngredient()])}>+ เพิ่มส่วนประกอบ</button>
      <div className="meal-actions"><button className="primary" type="submit">{busy ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</button>{editingId && <button className="secondary" type="button" onClick={reset}>ยกเลิก</button>}</div></>}
    </fieldset></form>
    <div className="meal-list"><div><h3>รายการอาหารของวันที่เลือก</h3><strong>{meals?.caloriesConsumed ?? 0} kcal</strong></div>{!meals?.meals.length ? <p className="empty-state">ยังไม่มีรายการอาหารในวันนี้</p> : meals.meals.map(meal => <article key={meal.id}>{meal.imageData && <img src={meal.imageData} alt="" />}<div><strong>{meal.name}</strong><span>{mealOptions.find(option => option.id === meal.mealType)?.label} · {meal.totalCalories} kcal</span></div><div className="row-actions"><button type="button" onClick={() => edit(meal)}>แก้ไข</button><button type="button" disabled={busy} onClick={() => void remove(meal.id)}>ลบ</button></div></article>)}</div>
  </section>;
}
