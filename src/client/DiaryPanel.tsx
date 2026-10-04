import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { PublicMeal } from "../shared/contracts";
import type { PublicUser } from "../shared/contracts";
import type { CatalogFood } from "../shared/foodCatalog";
import { api, ApiError } from "./api";
import { localDate } from "./mealHelpers";

const MealPanel = lazy(() => import("./MealPanel").then((m) => ({ default: m.MealPanel })));
const ExercisePanel = lazy(() => import("./ExercisePanel").then((m) => ({ default: m.ExercisePanel })));

type Route = "home" | "manual" | "camera" | "activity" | "history";
const shiftDate = (date: string, amount: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
};

function Icon({ name }: { name: "camera" | "meal" | "activity" | "calendar" | "back" | "search" | "gallery" }) {
  const paths: Record<typeof name, React.ReactNode> = {
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></>,
    meal: <><path d="M4 11h16M6 11v7h12v-7M8 8c0-2 1.4-3 4-3s4 1 4 3"/><path d="M9 14h.01M12 14h.01M15 14h.01"/></>,
    activity: <><path d="M3 12h4l2-6 4 12 2-6h6"/></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4m8-4v4M4 10h16"/></>,
    back: <path d="m15 18-6-6 6-6M9 12h11"/>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4 4"/></>,
    gallery: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.5"/><path d="m21 15-5-5L5 20"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function DiaryPanel({ user, active }: { user: PublicUser; active: boolean }) {
  const [date, setDate] = useState(localDate);
  const [route, setRoute] = useState<Route>("home");
  const [query, setQuery] = useState("");
  const [meals, setMeals] = useState<PublicMeal[]>([]);
  const [error, setError] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [pendingMeal, setPendingMeal] = useState<PublicMeal | null>(null);
  const [pendingCatalogFood, setPendingCatalogFood] = useState<CatalogFood | null>(null);
  const [catalogFoods, setCatalogFoods] = useState<CatalogFood[]>([]);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState("");
  const catalogRequestRef = useRef(0);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const photoRequestRef = useRef(0);

  useEffect(() => {
    let alive = true;
    const from = route === "history" || query.trim() ? "2000-01-01" : shiftDate(localDate(), -30);
    const to = localDate();
    void api<{ meals: PublicMeal[] }>(`/meals/history?from=${from}&to=${to}`)
      .then((result) => { if (alive) { setMeals(result.meals); setError(""); } })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e.message : "โหลดประวัติไม่ได้"); });
    const changed = () => void api<{ meals: PublicMeal[] }>(`/meals/history?from=${from}&to=${to}`).then((r) => alive && setMeals(r.meals)).catch(() => undefined);
    window.addEventListener("daily-calories-updated", changed);
    return () => { alive = false; window.removeEventListener("daily-calories-updated", changed); };
  }, [date, route, query]);

  useEffect(() => {
    const term = query.trim();
    const request = ++catalogRequestRef.current;
    if (route !== "home" || term.length < 2 || term.length > 80) {
      setCatalogFoods([]); setCatalogError(""); setCatalogBusy(false);
      return;
    }
    setCatalogFoods([]);
    const timer = window.setTimeout(() => {
      setCatalogBusy(true); setCatalogError("");
      void api<{ foods: CatalogFood[] }>(`/foods/catalog?q=${encodeURIComponent(term)}`)
        .then((result) => { if (request === catalogRequestRef.current) setCatalogFoods(result.foods ?? []); })
        .catch((cause) => { if (request === catalogRequestRef.current) { setCatalogFoods([]); setCatalogError(cause instanceof ApiError ? cause.message : "ค้นหาฐานข้อมูลอาหารไม่ได้"); } })
        .finally(() => { if (request === catalogRequestRef.current) setCatalogBusy(false); });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, route]);

  useEffect(() => {
    if (route !== "camera" || !active) return;
    let cancelled = false;
    const cleanup = () => {
      cancelled = true;
      photoRequestRef.current += 1;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    setCameraReady(false);
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("กล้องใช้ไม่ได้ในเบราว์เซอร์นี้ กรุณาเลือกรูปจากอัลบั้มแทน");
      return cleanup;
    }
    void navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined); }
        setCameraReady(true);
      })
      .catch(() => { if (!cancelled) setCameraError("เปิดกล้องไม่ได้ กรุณาอนุญาตการใช้กล้อง หรือเลือกรูปจากอัลบั้ม"); });
    return cleanup;
  }, [route, active]);

  const visibleMeals = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("th");
    return meals.filter((meal) => !normalized || meal.name.toLocaleLowerCase("th").includes(normalized));
  }, [meals, query]);
  function updateQuery(value: string) {
    catalogRequestRef.current += 1;
    setCatalogFoods([]); setCatalogError(""); setCatalogBusy(false); setQuery(value);
  }
  function reuse(meal: PublicMeal) {
    setPendingCatalogFood(null);
    setPendingMeal(meal);
    setPhotoData(null);
    setRoute("manual");
  }
  function chooseCatalogFood(food: CatalogFood) {
    setPendingMeal(null); setPendingCatalogFood(food); setPhotoData(null); setRoute("manual");
  }
  function openCamera() { photoRequestRef.current += 1; setPendingMeal(null); setPendingCatalogFood(null); setPhotoData(null); setRoute("camera"); }
  async function compressPhoto(source: string): Promise<string> {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => { const item = new Image(); item.onload = () => resolve(item); item.onerror = reject; item.src = source; });
    const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("ไม่สามารถเตรียมรูปได้");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.82; let result = canvas.toDataURL("image/jpeg", quality);
    while (result.length * 0.75 > 200_000 && quality > 0.42) { quality -= 0.08; result = canvas.toDataURL("image/jpeg", quality); }
    if (result.length * 0.75 > 200_000) throw new Error("รูปนี้ยังใหญ่เกินไป ลองเลือกภาพที่เล็กลง");
    return result;
  }
  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1200 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const request = ++photoRequestRef.current;
    try {
      const compressed = await compressPhoto(canvas.toDataURL("image/jpeg", 0.82));
      if (request !== photoRequestRef.current) return;
      streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null;
      setPhotoData(compressed); setRoute("manual");
    } catch {
      if (request === photoRequestRef.current) { setCameraError("เตรียมรูปไม่ได้ กรุณาถ่ายใหม่หรือเลือกรูปอื่น"); setCameraReady(true); }
    }
  }
  async function choosePhoto(file?: File) {
    if (!file) return;
    const request = ++photoRequestRef.current;
    try {
      const original = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("อ่านรูปไม่ได้")); reader.onerror = () => reject(new Error("อ่านรูปไม่ได้")); reader.readAsDataURL(file); });
      const compressed = await compressPhoto(original);
      if (request !== photoRequestRef.current) return;
      setPhotoData(compressed); setRoute("manual");
    } catch { if (request === photoRequestRef.current) setCameraError("เตรียมรูปไม่ได้ กรุณาเลือกรูปอื่น"); }
  }
  const goHome = () => { photoRequestRef.current += 1; setPendingMeal(null); setPendingCatalogFood(null); setRoute("home"); setPhotoData(null); };

  return <section className="diary-panel" aria-label="บันทึกอาหาร">
    {route === "home" && <>
      <header className="diary-title"><span>DIARY</span><h1>บันทึกอาหาร</h1><p>เก็บทุกมื้อและกิจกรรมของคุณไว้ที่เดียว</p></header>
      <label className="diary-search"><Icon name="search"/><input aria-label="ค้นหาประวัติอาหาร" value={query} maxLength={80} onChange={(e) => updateQuery(e.target.value)} placeholder="ค้นหาประวัติหรือฐานข้อมูลอาหาร"/></label>
      <div className="diary-actions" aria-label="สร้างบันทึก">
        <button className="diary-action photo" type="button" onClick={openCamera}><span><Icon name="camera"/></span><strong>ถ่ายภาพอาหาร</strong><small>ใช้กล้องหรืออัลบั้ม</small></button>
        <button className="diary-action food" type="button" onClick={() => { setPhotoData(null); setPendingMeal(null); setPendingCatalogFood(null); setRoute("manual"); }}><span><Icon name="meal"/></span><strong>บันทึกอาหาร</strong><small>กรอกรายการด้วยตัวเอง</small></button>
        <button className="diary-action activity" type="button" onClick={() => setRoute("activity")}><span><Icon name="activity"/></span><strong>บันทึกกิจกรรม</strong><small>บันทึกการเคลื่อนไหว</small></button>
      </div>
      <div className="diary-history-head"><div><h2>ประวัติอาหาร</h2><p>{query.trim() ? "ค้นหาประวัติทั้งหมด" : "รายการย้อนหลัง 30 วัน"}</p></div><button type="button" className="diary-link" onClick={() => setRoute("history")}>ดูทั้งหมด <span aria-hidden="true">→</span></button></div>
      <MealHistory meals={visibleMeals} error={error} onReuse={reuse} emptyMessage={query.trim() ? "ไม่พบอาหารในประวัติที่ตรงกับการค้นหา" : undefined}/>
      {query.trim() && <section className="diary-catalog-results" aria-label="ฐานข้อมูลอาหาร">
        <div className="diary-history-head"><div><h2>ฐานข้อมูลอาหาร</h2><p>อาหารอ้างอิงจากแค็ตตาล็อกและแหล่งข้อมูลที่แสดงในแต่ละรายการ</p></div></div>
        {catalogBusy && <p role="status">กำลังค้นหาฐานข้อมูลอาหาร…</p>}
        {catalogError && <p className="diary-error" role="alert">{catalogError}</p>}
        {!catalogBusy && !catalogError && catalogFoods.length === 0 && query.trim().length >= 2 && <p className="diary-empty">ไม่พบอาหารในฐานข้อมูล</p>}
        <div className="diary-meal-history">{catalogFoods.map(food => { const complete = Object.values(food.nutrientsPer100g).every(value => typeof value === "number"); return <article className="diary-meal-row" key={food.id}>
          {food.imageUrl ? <img src={food.imageUrl} alt=""/> : <span className="diary-meal-image"><Icon name="meal"/></span>}
          <div className="diary-meal-info"><strong>{food.name}</strong><span>{food.nutrientsPer100g.caloriesKcal == null ? "ไม่ทราบ" : `${Math.round(food.nutrientsPer100g.caloriesKcal)} kcal`} · ต่อ 100 กรัม</span><small>{food.sourceName ?? "ฐานข้อมูลอาหาร"}{food.url && <> · <a href={food.url} target="_blank" rel="noreferrer">แหล่งข้อมูล</a></>}</small>{!complete && <small className="diary-catalog-unavailable">สารอาหารไม่ครบ ยังใช้บันทึกไม่ได้</small>}</div>
          <button type="button" aria-label={complete ? `ใช้ ${food.name}` : `${food.name}: สารอาหารไม่ครบ ยังใช้บันทึกไม่ได้`} disabled={!complete} onClick={() => chooseCatalogFood(food)}>+</button>
        </article>; })}</div>
      </section>}
    </>}
    {route === "manual" && <>
      <button type="button" className="diary-back" onClick={goHome}><Icon name="back"/> กลับไปบันทึก</button>
      <h1 className="diary-route-title">บันทึกอาหาร</h1>
      <Suspense fallback={<p role="status">กำลังเปิดแบบฟอร์ม…</p>}><MealPanel key={pendingCatalogFood?.id ?? "diary-meal"} userId={user.id} selectedDate={date} initialMode={photoData ? "photo" : "manual"} initialImage={photoData} initialMeal={pendingMeal} initialCatalogFood={pendingCatalogFood} onDateChange={setDate}/></Suspense>
    </>}
    {route === "camera" && <>
      <button type="button" className="diary-back" onClick={goHome}><Icon name="back"/> กลับไปบันทึก</button>
      <h1 className="diary-route-title">ถ่ายภาพอาหาร</h1>
      <div className="diary-camera">
        <video ref={videoRef} playsInline muted aria-label="ภาพจากกล้อง"/>
        {!cameraReady && <div className="diary-camera-placeholder" role="status">{cameraError || "กำลังเปิดกล้อง…"}</div>}
      </div>
      {cameraError && <p className="diary-camera-error" role="status">{cameraError}</p>}
      <div className="diary-camera-controls">
        <button type="button" className="diary-gallery" onClick={() => uploadRef.current?.click()}><Icon name="gallery"/><span>เลือกจากอัลบั้ม</span></button>
        <button type="button" className="diary-shutter" aria-label="ถ่ายภาพ" disabled={!cameraReady} onClick={capture}><span/></button>
        <span className="diary-camera-spacer" aria-hidden="true"/>
      </div>
      <input ref={uploadRef} className="diary-file-input" type="file" accept="image/*" aria-label="เลือกรูปอาหารจากอัลบั้ม" onChange={(e) => { choosePhoto(e.target.files?.[0]); e.currentTarget.value = ""; }}/>
    </>}
    {route === "activity" && <><button type="button" className="diary-back" onClick={goHome}><Icon name="back"/> กลับไปบันทึก</button><Suspense fallback={<p role="status">กำลังเปิดกิจกรรม…</p>}><ExercisePanel user={user}/></Suspense></>}
    {route === "history" && <><button type="button" className="diary-back" onClick={goHome}><Icon name="back"/> กลับไปบันทึก</button><div className="diary-history-head"><h1>ประวัติอาหาร</h1><button type="button" className="diary-link" onClick={() => setRoute("home")}>เสร็จสิ้น</button></div><label className="diary-search"><Icon name="search"/><input aria-label="ค้นหาประวัติอาหาร" value={query} maxLength={80} onChange={(e) => updateQuery(e.target.value)} placeholder="ค้นหาอาหารในประวัติ"/></label><MealHistory meals={visibleMeals} error={error} onReuse={reuse} emptyMessage="ยังไม่มีประวัติอาหารที่ตรงกับการค้นหา"/></>}
  </section>;
}

function MealHistory({ meals, error, onReuse, emptyMessage = "ยังไม่มีรายการอาหารในช่วง 30 วันที่ผ่านมา" }: { meals: PublicMeal[]; error: string; onReuse: (meal: PublicMeal) => void; emptyMessage?: string }) {
  if (error) return <p className="diary-error" role="alert">{error}</p>;
  if (!meals.length) return <p className="diary-empty">{emptyMessage}</p>;
  return <div className="diary-meal-history">{meals.map((meal) => <article className="diary-meal-row" key={meal.id}>
    {meal.imageData ? <img src={meal.imageData} alt=""/> : <span className="diary-meal-image"><Icon name="meal"/></span>}
    <div className="diary-meal-info"><strong>{meal.name}</strong><span>{meal.ingredients.reduce((sum, item) => sum + item.amount, 0)} กรัม · {Math.round(meal.totalCalories)} kcal</span><small>{meal.activityDate} · {({ breakfast: "เช้า", lunch: "กลางวัน", dinner: "เย็น", snack: "ของว่าง" } as Record<string, string>)[meal.mealType] ?? meal.mealType}</small></div>
    <button type="button" aria-label={`บันทึกมื้อนี้อีกครั้ง: ${meal.name}`} onClick={() => onReuse(meal)}>+</button>
  </article>)}</div>;
}
