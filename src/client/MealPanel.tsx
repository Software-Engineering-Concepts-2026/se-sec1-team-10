import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { MealIngredientRecord, PublicMeal } from '../shared/contracts';
import { api, ApiError } from './api';

type IngredientDraft = Omit<MealIngredientRecord, 'id'>;
type DailyMeals = { date: string; meals: PublicMeal[]; caloriesConsumed: number };
const mealOptions = [{ id: 'breakfast', label: 'อาหารเช้า' }, { id: 'lunch', label: 'อาหารกลางวัน' }, { id: 'dinner', label: 'อาหารเย็น' }, { id: 'snack', label: 'ของว่าง' }] as const;
const emptyIngredient = (): IngredientDraft => ({ name: '', carbsGrams: 0, sugarGrams: 0, proteinGrams: 0, fatGrams: 0 });
const localDate = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const calories = (ingredients: IngredientDraft[]) => Math.round(ingredients.reduce((total, item) => total + item.carbsGrams * 4 + item.proteinGrams * 4 + item.fatGrams * 9, 0));

export function MealPanel() {
  const [date, setDate] = useState(localDate);
  const [meals, setMeals] = useState<DailyMeals | null>(null);
  const [name, setName] = useState('');
  const [mealType, setMealType] = useState('breakfast');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()]);
  const [imageData, setImageData] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load(selectedDate = date) {
    try { setMeals(await api<DailyMeals>(`/meals/daily?date=${encodeURIComponent(selectedDate)}`)); }
    catch (error) { setMessage({ text: error instanceof ApiError ? error.message : 'โหลดรายการอาหารไม่ได้', error: true }); }
  }
  useEffect(() => { void load(date); }, [date]);
  const reset = () => { setName(''); setMealType('breakfast'); setIngredients([emptyIngredient()]); setImageData(null); setEditingId(null); if (fileInput.current) fileInput.current.value = ''; };
  const updateIngredient = (index: number, field: keyof IngredientDraft, value: string) => setIngredients(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: field === 'name' ? value : Math.max(0, Number(value) || 0) } : item));
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 200_000) { setMessage({ text: 'เลือกรูป PNG, JPEG หรือ WebP ที่มีขนาดไม่เกิน 200 KB', error: true }); event.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => setImageData(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(null);
    const body = { name, mealType, activityDate: date, imageData, ingredients };
    try {
      const result = await api<{ meal: PublicMeal }>(editingId ? `/meals/${editingId}` : '/meals', body, editingId ? 'PUT' : 'POST');
      const favorites = JSON.parse(localStorage.getItem('lifebalance-favorites') ?? '[]') as { name: string; mealType: string; ingredients: IngredientDraft[] }[];
      if (!favorites.some(item => item.name === result.meal.name)) localStorage.setItem('lifebalance-favorites', JSON.stringify([...favorites, { name: result.meal.name, mealType: result.meal.mealType, ingredients }]));
      window.dispatchEvent(new Event('favorites-updated'));
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
  function edit(meal: PublicMeal) { setEditingId(meal.id); setName(meal.name); setMealType(meal.mealType); setIngredients(meal.ingredients.map(({ id: _id, ...ingredient }) => ingredient)); setImageData(meal.imageData ?? null); setMessage(null); }
  const previewCalories = calories(ingredients);

  return <section className="card meal-panel" aria-labelledby="meal-title">
    <div className="exercise-heading"><div><span className="eyebrow">DAILY NUTRITION</span><h2 id="meal-title">บันทึกอาหาร</h2><p className="muted">เพิ่มอาหารในแต่ละมื้อ ระบบคำนวณพลังงานจากคาร์บ โปรตีน และไขมันให้อัตโนมัติ</p></div><label className="compact-field">วันที่<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div>
    {message && <div className={`feedback ${message.error ? 'error' : 'success'}`} role={message.error ? 'alert' : 'status'}>{message.text}</div>}
    <form className="meal-form" onSubmit={save}><fieldset disabled={busy}>
      <div className="meal-top-row"><label className="compact-field">มื้ออาหาร<select value={mealType} onChange={event => setMealType(event.target.value)}>{mealOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label><label className="compact-field meal-name">ชื่ออาหาร<input value={name} maxLength={120} placeholder="เช่น ข้าวมันไก่" onChange={event => setName(event.target.value)} required /></label></div>
      <div className="image-picker"><input ref={fileInput} id="meal-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseImage} /><label htmlFor="meal-image">{imageData ? <img src={imageData} alt="ตัวอย่างรูปอาหาร" /> : <><strong>แนบรูปอาหาร</strong><span>PNG, JPEG หรือ WebP ไม่เกิน 200 KB</span></>}</label>{imageData && <button className="text-button" type="button" onClick={() => { setImageData(null); if (fileInput.current) fileInput.current.value = ''; }}>ลบรูป</button>}</div>
      <div className="nutrient-heading"><h3>ส่วนประกอบและสารอาหาร</h3><span>พลังงานรวม <strong>{previewCalories} kcal</strong></span></div>
      <p className="nutrient-note">น้ำตาลเป็นส่วนหนึ่งของคาร์โบไฮเดรต จึงแสดงแยกแต่ไม่ถูกนับพลังงานซ้ำ</p>
      {ingredients.map((ingredient, index) => <div className="ingredient-row" key={index}><input aria-label={`ชื่อส่วนประกอบ ${index + 1}`} value={ingredient.name} maxLength={120} placeholder="เช่น ข้าวสวย" onChange={event => updateIngredient(index, 'name', event.target.value)} required />{(['carbsGrams', 'sugarGrams', 'proteinGrams', 'fatGrams'] as const).map(field => <label key={field}>{({ carbsGrams: 'คาร์บ', sugarGrams: 'น้ำตาล', proteinGrams: 'โปรตีน', fatGrams: 'ไขมัน' } as Record<string, string>)[field]}<input aria-label={`${field} ${index + 1}`} type="number" min="0" max="10000" step="0.1" value={ingredient[field]} onChange={event => updateIngredient(index, field, event.target.value)} required /><small>ก.</small></label>)}{ingredients.length > 1 && <button className="remove-ingredient" type="button" onClick={() => setIngredients(current => current.filter((_, itemIndex) => itemIndex !== index))}>ลบ</button>}</div>)}
      <button className="secondary add-ingredient" type="button" onClick={() => setIngredients(current => [...current, emptyIngredient()])}>+ เพิ่มส่วนประกอบ</button>
      <div className="meal-actions"><button className="primary" type="submit">{busy ? 'กำลังบันทึก…' : editingId ? 'บันทึกการแก้ไข' : 'บันทึกข้อมูล'}</button>{editingId && <button className="secondary" type="button" onClick={reset}>ยกเลิก</button>}</div>
    </fieldset></form>
    <div className="meal-list"><div><h3>รายการอาหารของวันที่เลือก</h3><strong>{meals?.caloriesConsumed ?? 0} kcal</strong></div>{!meals?.meals.length ? <p className="empty-state">ยังไม่มีรายการอาหารในวันนี้</p> : meals.meals.map(meal => <article key={meal.id}>{meal.imageData && <img src={meal.imageData} alt="" />}<div><strong>{meal.name}</strong><span>{mealOptions.find(option => option.id === meal.mealType)?.label} · {meal.totalCalories} kcal</span></div><div className="row-actions"><button type="button" onClick={() => edit(meal)}>แก้ไข</button><button type="button" disabled={busy} onClick={() => void remove(meal.id)}>ลบ</button></div></article>)}</div>
  </section>;
}
