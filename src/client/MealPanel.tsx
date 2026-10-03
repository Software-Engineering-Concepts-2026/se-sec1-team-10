import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { mealSchema, type PublicMeal } from "../shared/contracts";
import type { CatalogFood, CatalogMatch } from "../shared/foodCatalog";
import { api, ApiError } from "./api";
import type { FavoriteMeal } from "./FavoriteMealsPanel";
import { rememberFavorite } from "./favorites";
import { FoodSearchPanel, type FoodSearchResult } from "./FoodSearchPanel";
import { MealIngredientEditor } from "./MealIngredientEditor";
import { MealList } from "./MealList";
import {
  localDate,
  mealOptions,
  type IngredientDraft,
} from "./mealHelpers";

type DailyMeals = {
  date: string;
  meals: PublicMeal[];
  caloriesConsumed: number;
};
type Analysis = {
  name: string;
  mealType: string;
  ingredients: IngredientDraft[];
  portionDescription: string;
  source: "ai-estimate";
  notes: string[];
  catalogMatches?: CatalogMatch[];
};

type MealPanelProps = {
  userId: string;
  selectedDate?: string;
  onDateChange?: (date: string) => void;
  initialMode?: "manual" | "photo";
  initialImage?: string | null;
  initialMeal?: PublicMeal | null;
  initialCatalogFood?: CatalogFood | null;
};

export function MealPanel({ userId, selectedDate, onDateChange, initialMode = "manual", initialImage = null, initialMeal = null, initialCatalogFood = null }: MealPanelProps) {
  const [date, setDate] = useState(selectedDate ?? localDate);
  const [meals, setMeals] = useState<DailyMeals | null>(null);
  const [name, setName] = useState("");
  const [mealType, setMealType] = useState("breakfast");
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([]);
  const [estimatingIngredient, setEstimatingIngredient] = useState(false);
  const [imageData, setImageData] = useState<string | null>(initialImage);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const analyzingRef = useRef(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [showManualFields, setShowManualFields] = useState(initialMode === "manual");
  const [catalogImageUrl, setCatalogImageUrl] = useState<string | null>(null);
  const [needsRecalculation, setNeedsRecalculation] = useState(false);
  const [foodTarget, setFoodTarget] = useState<number | null>(null);
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const photoWorkflow = initialMode === "photo";

  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!initialMeal) return;
    setName(initialMeal.name);
    setMealType(initialMeal.mealType);
    setIngredients(initialMeal.ingredients.map(({ id: _id, caloriesKcal: _calories, carbsGrams: _carbs, sugarGrams: _sugar, proteinGrams: _protein, fatGrams: _fat, ...item }) => item));
    setImageData(initialMeal.imageData ?? null);
    setEditingId(null);
    setAnalysis(null);
    setShowManualFields(true);
    setNeedsRecalculation(false);
    setMessage({ text: `เติมข้อมูล ${initialMeal.name} แล้ว ตรวจสอบปริมาณก่อนบันทึกได้เลย`, error: false });
  }, [initialMeal]);

  useEffect(() => {
    if (!initialCatalogFood) return;
    const food = initialCatalogFood;
    setName(food.name.slice(0, 120));
    setMealType("breakfast");
    setIngredients([{ name: food.name.slice(0, 120), amount: 100, unit: "g", referenceAmount: 100, referenceUnit: "g", source: "food-catalog", referenceNutrients: food.nutrientsPer100g }]);
    setCatalogImageUrl(food.imageUrl);
    setImageData(null);
    setEditingId(null);
    setAnalysis(null);
    setShowManualFields(true);
    setNeedsRecalculation(false);
    setMessage({ text: `เพิ่ม ${food.name} จำนวน 100 กรัมแล้ว ปรับปริมาณก่อนบันทึกได้`, error: false });
  }, [initialCatalogFood]);

  async function load() {
    try {
      setMeals(
        await api<DailyMeals>(`/meals/daily?date=${encodeURIComponent(date)}`),
      );
    } catch (error) {
      setMessage({
        text:
          error instanceof ApiError ? error.message : "โหลดรายการอาหารไม่ได้",
        error: true,
      });
    }
  }
  useEffect(() => {
    void load();
  }, [date]);
  const reset = () => {
    setName("");
    setMealType("breakfast");
    setIngredients([]);
    setImageData(null);
    setCatalogImageUrl(null);
    setAnalysis(null);
    setShowManualFields(false);
    setEditingId(null);
    setNeedsRecalculation(false);
    [cameraInput.current, uploadInput.current].forEach((input) => {
      if (input) input.value = "";
    });
  };
  useEffect(() => {
    const selectFavorite = (event: Event) => {
      const favorite = (event as CustomEvent<FavoriteMeal>).detail;
      if (!favorite || analyzingRef.current) return;
      setName(favorite.name);
      setMealType(favorite.mealType);
      setIngredients(favorite.ingredients);
      setImageData(null);
      setCatalogImageUrl(null);
      setAnalysis(null);
      setShowManualFields(true);
      setEditingId(null);
      setNeedsRecalculation(false);
      setMessage({
        text: `เติมข้อมูล ${favorite.name} แล้ว ตรวจสอบปริมาณก่อนบันทึกได้เลย`,
        error: false,
      });
    };
    window.addEventListener("favorite-selected", selectFavorite);
    return () =>
      window.removeEventListener("favorite-selected", selectFavorite);
  }, []);
  function changeQuantity(index: number, value: string) {
    setIngredients((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, amount: Math.max(0, Number(value) || 0) }
          : item,
      ),
    );
    setNeedsRecalculation(true);
  }
  function removeIngredient(index: number) {
    setIngredients((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setNeedsRecalculation(true);
  }
  function recalculate() {
    const valid = mealSchema.safeParse({ name: name || 'มื้ออาหาร', mealType, activityDate: date, ingredients });
    if (!valid.success) {
      setMessage({ text: 'กรุณาระบุปริมาณกรัมมากกว่า 0 ก่อนคำนวณ', error: true });
      return;
    }
    setNeedsRecalculation(false);
    setMessage({
      text: "คำนวณสารอาหารใหม่แล้ว ตรวจสอบผลรวมก่อนบันทึก",
      error: false,
    });
  }
  function applyFood(food: FoodSearchResult, quantityGrams: number) {
    const referenceNutrients = { caloriesKcal: food.nutrientsPer100g.caloriesKcal ?? null, carbsGrams: food.nutrientsPer100g.carbsGrams ?? null, sugarGrams: food.nutrientsPer100g.sugarGrams ?? null, proteinGrams: food.nutrientsPer100g.proteinGrams ?? null, fatGrams: food.nutrientsPer100g.fatGrams ?? null };
    setShowManualFields(true);
    const next = { name: food.name.slice(0, 120), amount: quantityGrams, unit: "g" as const, referenceAmount: 100, referenceUnit: "g" as const, source: food.source, referenceNutrients };
    setIngredients(current => foodTarget === null ? [...current.filter(item => item.name), next] : current.map((item, index) => index === foodTarget ? next : item));
    setFoodTarget(null);
    setFoodSearchOpen(false);
    setNeedsRecalculation(true);
  }
  function addManualIngredient(ingredient: IngredientDraft) {
    setIngredients((current) => [...current.filter((item) => item.name), ingredient]);
    setShowManualFields(true);
    setFoodSearchOpen(false);
    setNeedsRecalculation(true);
  }
  async function compressImage(file: File): Promise<string> {
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("อ่านรูปไม่ได้"));
      image.src = URL.createObjectURL(file);
    });
    const scale = Math.min(
      1,
      768 / Math.max(source.naturalWidth, source.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("ไม่สามารถเตรียมรูปได้");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(source.src);
    let quality = 0.82;
    let result = canvas.toDataURL("image/jpeg", quality);
    while (result.length * 0.75 > 200_000 && quality > 0.42) {
      quality -= 0.08;
      result = canvas.toDataURL("image/jpeg", quality);
    }
    if (result.length * 0.75 > 200_000)
      throw new Error("รูปนี้ยังใหญ่เกินไป ลองเลือกภาพที่เล็กลง");
    return result;
  }
  async function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    if (analyzingRef.current || busy || preparingImage) return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ text: "เลือกรูปภาพอาหารที่ถูกต้อง", error: true });
      return;
    }
    setPreparingImage(true);
    try {
      setImageData(await compressImage(file));
      setIngredients((current) => current.map(({ catalogMatch: _match, photoEstimate: _photo, ...item }) => item));
      setCatalogImageUrl(null);
      setAnalysis(null);
      if (photoWorkflow) {
        setShowManualFields(false);
        setNeedsRecalculation(false);
        setMessage({ text: "เตรียมรูปแล้ว กดวิเคราะห์เพื่อรับค่าประมาณ", error: false });
      } else {
        setShowManualFields(true);
        setMessage({ text: "แนบรูปแล้ว กรอกรายการอาหารและส่วนประกอบได้เลย", error: false });
      }
    } catch (error) {
      setMessage({
        text: error instanceof Error ? error.message : "เตรียมรูปไม่ได้",
        error: true,
      });
    } finally {
      setPreparingImage(false);
    }
  }
  async function analyzeImage(correctedMealName?: string) {
    if (!imageData || analyzingRef.current || busy || preparingImage || estimatingIngredient) return;
    if (correctedMealName !== undefined && (correctedMealName.length < 2 || correctedMealName.length > 120)) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    setMessage(null);
    try {
      const result = await api<{ analysis: Analysis }>("/meals/analyze", {
        imageData,
        ...(correctedMealName !== undefined ? { correctedMealName } : {}),
      });
      const next = result.analysis;
      const matches = new Map((next.catalogMatches ?? []).map((match) => [match.index, match]));
      setName(correctedMealName ?? next.name);
      if (correctedMealName === undefined) setMealType(next.mealType);
      setIngredients(next.ingredients.map((ingredient, index) => ({
        ...ingredient,
        ...(matches.has(index) ? { catalogMatch: matches.get(index) } : {}),
        photoEstimate: true,
      })));
      setAnalysis({ ...next, name: correctedMealName ?? next.name });
      setShowManualFields(true);
      setNeedsRecalculation(false);
      setMessage({
        text: "วิเคราะห์แล้ว ปรับปริมาณหรือลบส่วนประกอบก่อนบันทึกได้",
        error: false,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof ApiError
            ? `${error.message} คุณยังกรอกข้อมูลเองแล้วบันทึกได้`
            : "วิเคราะห์รูปไม่ได้ คุณยังกรอกข้อมูลเองแล้วบันทึกได้",
        error: true,
      });
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || analyzingRef.current || preparingImage || estimatingIngredient || !ingredients.length) return;
    if (needsRecalculation) {
      setMessage({
        text: "ข้อมูลเปลี่ยนแล้ว กรุณากดคำนวณสารอาหารใหม่ก่อนบันทึก",
        error: true,
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    const body = {
      name,
      mealType,
      activityDate: date,
      imageData,
      ingredients: ingredients.map(({ catalogMatch: _catalogMatch, photoEstimate: _photoEstimate, ...ingredient }) => ingredient),
    };
    try {
      const result = await api<{ meal: PublicMeal }>(
        editingId ? `/meals/${editingId}` : "/meals",
        body,
        editingId ? "PUT" : "POST",
      );
      rememberFavorite(userId, {
        name: result.meal.name,
        mealType: result.meal.mealType as FavoriteMeal["mealType"],
        ingredients: body.ingredients,
      });
      setMessage({
        text: editingId ? "แก้ไขอาหารแล้ว" : "บันทึกอาหารแล้ว",
        error: false,
      });
      reset();
      await load();
      window.dispatchEvent(new Event("daily-calories-updated"));
    } catch (error) {
      setMessage({
        text: error instanceof ApiError ? error.message : "บันทึกอาหารไม่ได้",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (analyzingRef.current) return;
    setBusy(true);
    try {
      await api(`/meals/${id}`, {}, "DELETE");
      setMessage({ text: "ลบรายการอาหารแล้ว", error: false });
      await load();
      window.dispatchEvent(new Event("daily-calories-updated"));
    } catch (error) {
      setMessage({
        text: error instanceof ApiError ? error.message : "ลบรายการอาหารไม่ได้",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  }
  function edit(meal: PublicMeal) {
    if (analyzingRef.current) return;
    setEditingId(meal.id);
    setName(meal.name);
    setMealType(meal.mealType);
    setIngredients(
      meal.ingredients.map(({ id: _id, caloriesKcal: _calories, carbsGrams: _carbs, sugarGrams: _sugar, proteinGrams: _protein, fatGrams: _fat, ...item }) => item),
    );
    setImageData(meal.imageData ?? null);
    setAnalysis(null);
    setShowManualFields(true);
    setNeedsRecalculation(false);
    setMessage(null);
  }
  return (
    <section className="card meal-panel" aria-labelledby="meal-title">
      <div className="exercise-heading">
        <div>
          <span className="eyebrow">DAILY NUTRITION</span>
          <h2 id="meal-title">บันทึกอาหาร</h2>
          <p className="muted">
            เพิ่มจากรูปหรือฐานข้อมูล แล้วตรวจปริมาณก่อนบันทึก
          </p>
        </div>
        <label className="compact-field">
          วันที่
          <input
            type="date"
            disabled={busy || analyzing || preparingImage}
            value={date}
              onChange={(event) => { setDate(event.target.value); onDateChange?.(event.target.value); }}
          />
        </label>
      </div>
      {message && (
        <div
          className={`feedback ${message.error ? "error" : "success"}`}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}
      <form className="meal-form" onSubmit={save}>
        <fieldset disabled={busy || analyzing || preparingImage}>
          <div className="image-picker">
            <input
              ref={cameraInput}
              id="meal-camera"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={chooseImage}
            />
            <input
              ref={uploadInput}
              id="meal-upload"
              type="file"
              accept="image/*"
              onChange={chooseImage}
            />
            {imageData ? (
              <img src={imageData} alt="ตัวอย่างรูปอาหาร" />
            ) : (
              <div className="image-choice">
                <strong>เพิ่มรูปอาหาร</strong>
                <span>ถ่ายรูปใหม่หรือเลือกจากอัลบั้ม</span>
                <div>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => cameraInput.current?.click()}
                  >
                    ถ่ายรูป
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => uploadInput.current?.click()}
                  >
                    อัลบั้ม
                  </button>
                </div>
              </div>
            )}
            {imageData && (
              <div className="image-actions">
                {photoWorkflow && !analysis && <button
                  className="secondary"
                  type="button"
                  disabled={estimatingIngredient}
                  onClick={() => void analyzeImage()}
                >
                  {analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์รูป"}
                </button>}
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setImageData(null);
                    setCatalogImageUrl(null);
                    setAnalysis(null);
                  }}
                >
                  ลบรูป
                </button>
              </div>
            )}
          </div>
          <div className="meal-top-row">
            {catalogImageUrl && <img className="catalog-food-image" src={catalogImageUrl} alt={`ภาพ ${name}`} />}
            <label className="compact-field">
              มื้ออาหาร
              <select
                value={mealType}
                onChange={(event) => setMealType(event.target.value)}
              >
                {mealOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="compact-field meal-name">
              ชื่ออาหาร
              <input
                value={name}
                maxLength={120}
                placeholder="เช่น ข้าวมันไก่"
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>
          </div>
          {analysis && imageData && name.trim() && name.trim() !== analysis.name && (
            <div className="analysis-note">
              <p id="meal-correction-warning">วิเคราะห์รูปเดิมตามชื่อที่แก้ไข จะใช้โควตาอีก 1 ครั้งและแทนที่ส่วนประกอบเดิมทั้งหมด รวมถึงปริมาณที่แก้ไว้ กรุณาตรวจสอบก่อนบันทึก หากต้องการแก้เฉพาะชื่อ สามารถบันทึกได้เลย</p>
              <button className="secondary" type="button" aria-describedby="meal-correction-warning" disabled={estimatingIngredient || name.trim().length < 2 || name.trim().length > 120} onClick={() => void analyzeImage(name.trim())}>
                {analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์ใหม่ตามชื่อที่แก้ไข"}
              </button>
            </div>
          )}
          {!showManualFields && !analysis && photoWorkflow && (
            <button
              className="secondary manual-entry-button"
              type="button"
              onClick={() => setShowManualFields(true)}
            >
              เพิ่มรายการเอง
            </button>
          )}
          <MealIngredientEditor
            ingredients={ingredients}
            analysis={analysis}
            needsRecalculation={needsRecalculation}
            onQuantityChange={changeQuantity}
            onRemove={removeIngredient}
            onAdd={() => { setFoodTarget(null); setFoodSearchOpen(true); }}
            onAddManual={addManualIngredient}
            onEstimating={setEstimatingIngredient}
            onRecalculate={recalculate}
          />
          {foodSearchOpen && (
            <section className="food-search-inline" aria-labelledby="add-food-title">
              <div className="food-search-inline-heading">
                <h3 id="add-food-title">เพิ่มส่วนประกอบจากฐานข้อมูล</h3>
                <button className="text-button" type="button" onClick={() => setFoodSearchOpen(false)}>ปิด</button>
              </div>
              <FoodSearchPanel onSelect={applyFood} />
            </section>
          )}
          {(showManualFields || analysis) && (
            <div className="meal-actions">
              <button className="primary" type="submit" disabled={busy || analyzing || preparingImage || estimatingIngredient || needsRecalculation || !ingredients.length}>
                {busy
                  ? "กำลังบันทึก…"
                  : editingId
                    ? "บันทึกการแก้ไข"
                    : "บันทึกข้อมูล"}
              </button>
              {editingId && (
                <button className="secondary" type="button" onClick={reset}>
                  ยกเลิก
                </button>
              )}
            </div>
          )}
        </fieldset>
      </form>
      <MealList
        meals={meals}
        busy={busy || analyzing || preparingImage}
        onEdit={edit}
        onRemove={(id) => void remove(id)}
      />
    </section>
  );
}
