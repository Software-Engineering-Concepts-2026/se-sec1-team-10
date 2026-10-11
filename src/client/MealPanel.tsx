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
import { formatDisplayDate } from "./formatDisplay";
import { UiIcon } from "./Ui";
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
  initialEdit?: boolean;
  showDailyList?: boolean;
  onSaved?: (message: string) => void;
};

export function MealPanel({ userId, selectedDate, onDateChange, initialMode = "manual", initialImage = null, initialMeal = null, initialCatalogFood = null, initialEdit = false, showDailyList = true, onSaved }: MealPanelProps) {
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
  const [analysisElapsedSeconds, setAnalysisElapsedSeconds] = useState(0);
  const analysisTimerRef = useRef<number | null>(null);
  const [preparingImage, setPreparingImage] = useState(false);
  const [showManualFields, setShowManualFields] = useState(initialMode === "manual");
  const [catalogImageUrl, setCatalogImageUrl] = useState<string | null>(null);
  const [needsRecalculation, setNeedsRecalculation] = useState(false);
  const [foodTarget, setFoodTarget] = useState<number | null>(null);
  const [foodSearchOpen, setFoodSearchOpen] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const photoWorkflow = initialMode === "photo";

  useEffect(() => () => {
    if (analysisTimerRef.current !== null) window.clearInterval(analysisTimerRef.current);
  }, []);

  useEffect(() => {
    if (selectedDate) setDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!initialMeal) return;
    setName(initialMeal.name);
    setMealType(initialMeal.mealType);
    setIngredients(initialMeal.ingredients.map(({ id: _id, caloriesKcal: _calories, carbsGrams: _carbs, sugarGrams: _sugar, proteinGrams: _protein, fatGrams: _fat, ...item }) => item));
    setImageData(initialMeal.imageData ?? null);
    setEditingId(initialEdit ? initialMeal.id : null);
    setAnalysis(null);
    setShowManualFields(true);
    setNeedsRecalculation(false);
    setMessage({ text: 'ตรวจปริมาณก่อนบันทึก', error: false });
  }, [initialMeal, initialEdit]);

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
    if (showDailyList) void load();
  }, [date, showDailyList]);
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
        text: 'ตรวจปริมาณก่อนบันทึก',
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
    // Production CSP allows data images, but deliberately excludes blob URLs.
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("อ่านรูปไม่ได้"));
      reader.onerror = () => reject(new Error("อ่านรูปไม่ได้"));
      reader.readAsDataURL(file);
    });
    const source = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("อ่านรูปไม่ได้"));
      image.src = imageDataUrl;
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
    // Allow selecting the same file again after an error or removing its preview.
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ text: "เลือกรูปภาพอาหารที่ถูกต้อง", error: true });
      return;
    }
    setPreparingImage(true);
    setMessage(null);
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
        setMessage({ text: "แนบรูปแล้ว เพิ่มส่วนประกอบเพื่อบันทึก", error: false });
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
    setAnalysisElapsedSeconds(0);
    const started = Date.now();
    analysisTimerRef.current = window.setInterval(() => setAnalysisElapsedSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
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
        text: "วิเคราะห์แล้ว ตรวจปริมาณก่อนบันทึก",
        error: false,
      });
    } catch (error) {
      setMessage({
        text:
          error instanceof ApiError
            ? `${error.message} รูปและข้อมูลที่กรอกยังอยู่ การกดวิเคราะห์อีกครั้งจะใช้โควตาอีก 1 ครั้ง หรือกรอกข้อมูลเองแล้วบันทึกได้`
            : "วิเคราะห์รูปไม่ได้ รูปและข้อมูลที่กรอกยังอยู่ กดวิเคราะห์เพื่อลองใหม่จะใช้โควตาอีก 1 ครั้ง หรือกรอกข้อมูลเองแล้วบันทึกได้",
        error: true,
      });
    } finally {
      if (analysisTimerRef.current !== null) window.clearInterval(analysisTimerRef.current);
      analysisTimerRef.current = null;
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
      try {
        rememberFavorite(userId, {
          name: result.meal.name,
          mealType: result.meal.mealType as FavoriteMeal["mealType"],
          ingredients: body.ingredients,
        });
      } catch { /* The meal is already saved; local favorite storage is optional. */ }
      const successMessage = editingId ? "แก้ไขอาหารแล้ว" : "บันทึกอาหารแล้ว";
      setMessage({ text: successMessage, error: false });
      reset();
      window.dispatchEvent(new Event("daily-calories-updated"));
      if (onSaved) onSaved(successMessage);
      else await load();
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
      <div className="exercise-heading meal-panel-heading">
        <h2 id="meal-title">{editingId ? 'แก้ไขมื้ออาหาร' : 'บันทึกอาหาร'}</h2>
      </div>
      {message && (
        <div
          className={`feedback ${message.error ? "error" : "success"}`}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </div>
      )}
      {analyzing && <p className="analysis-note" role="status" aria-live="polite">
        กำลังวิเคราะห์… {analysisElapsedSeconds} วินาที
        {analysisElapsedSeconds >= 10 && ' บริการ AI อาจใช้เวลาสักครู่ กรุณารอ ไม่ต้องกดวิเคราะห์ซ้ำ'}
      </p>}
      <form className="meal-form" onSubmit={save}>
        <fieldset disabled={busy || analyzing || preparingImage}>
          <div className={`meal-photo-name-card ${imageData || catalogImageUrl ? "has-image" : ""}`}>
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
            {imageData || catalogImageUrl ? (
              <img src={imageData ?? catalogImageUrl ?? undefined} alt={imageData ? "ตัวอย่างรูปอาหาร" : `ภาพ ${name}`} />
            ) : (
              <div className="image-choice">
                <UiIcon name="image" size={28} />
              </div>
            )}

          </div>
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
              <div className="image-actions">
                {imageData || catalogImageUrl
                  ? <button className="secondary" type="button" onClick={() => uploadInput.current?.click()}>เปลี่ยนรูป</button>
                  : <><button className="secondary" type="button" onClick={() => cameraInput.current?.click()}>ถ่ายรูป</button><button className="secondary" type="button" onClick={() => uploadInput.current?.click()}>อัลบั้ม</button></>}
                {imageData && photoWorkflow && !analysis && <button
                  className="secondary"
                  type="button"
                  disabled={estimatingIngredient}
                  onClick={() => void analyzeImage()}
                >
                  {analyzing ? "กำลังวิเคราะห์…" : "วิเคราะห์รูป"}
                </button>}
                {imageData && <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setImageData(null);
                    setCatalogImageUrl(null);
                    setAnalysis(null);
                  }}
                >
                  ลบรูป
                </button>}
              </div>
          <div className="meal-top-row">
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
            <label className="compact-field">
              วันที่
              <span className="meal-date-control">
                <span className="meal-date-formatted" aria-hidden="true">{formatDisplayDate(date)}</span>
                <input
                  type="date"
                  aria-label="วันที่"
                  value={date}
                  onChange={(event) => { setDate(event.target.value); onDateChange?.(event.target.value); }}
                />
              </span>
            </label>
          </div>
          {analysis && imageData && name.trim() && name.trim() !== analysis.name && (
            <div className="analysis-note">
              <p id="meal-correction-warning">วิเคราะห์ใหม่ใช้โควตาอีก 1 ครั้ง และแทนที่ส่วนประกอบกับปริมาณที่แก้ไว้ทั้งหมด หากแก้เฉพาะชื่อ ให้บันทึกได้เลย</p>
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
      {showDailyList && <MealList
        meals={meals}
        busy={busy || analyzing || preparingImage}
        onEdit={edit}
        onRemove={(id) => void remove(id)}
      />}
    </section>
  );
}
