import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import type { PublicMeal, PublicUser } from '../shared/contracts';
import { calorieBudget, dailyMacroTargets } from '../shared/goals';
import { api, ApiError } from './api';
import { UiIcon } from './Ui';
import { formatDisplayDate } from './formatDisplay';
import { localDate, mealOptions } from './mealHelpers';
import './home-meal-groups.css';

const MealPanel = lazy(() => import('./MealPanel').then(module => ({ default: module.MealPanel })));

type DailySummary = { caloriesConsumed: number; caloriesBurned: number; netCalories: number };
const shiftDay = (date: string, offset: number) => {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

export function DashboardPanel({ user }: { user: PublicUser }) {
  const [date, setDate] = useState(localDate);
  const [data, setData] = useState<{ daily: DailySummary; meals: PublicMeal[] } | null>(null);
  const [error, setError] = useState('');
  const [details, setDetails] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editingMeal, setEditingMeal] = useState<PublicMeal | null | undefined>(undefined);
  const [mealStatus, setMealStatus] = useState('');
  const [mealError, setMealError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useEffect(() => {
    let active = true; let sequence = 0;
    const refresh = async () => {
      const request = ++sequence;
      setLoading(true); setError('');
      try {
        const [daily, meals] = await Promise.all([api<DailySummary>(`/exercises/daily?date=${date}`), api<{ meals: PublicMeal[] }>(`/meals/daily?date=${date}`)]);
        if (active && request === sequence) { setData({ daily, meals: meals.meals }); setError(''); }
      } catch (e) { if (active && request === sequence) setError(e instanceof ApiError ? e.message : 'โหลดข้อมูลไม่ได้'); }
      finally { if (active && request === sequence) setLoading(false); }
    };
    setData(null); void refresh();
    const updated = () => { void refresh(); };
    window.addEventListener('daily-calories-updated', updated);
    return () => { active = false; window.removeEventListener('daily-calories-updated', updated); };
  }, [date, reloadVersion]);
  const target = user.dailyCalorieTarget;
  const consumed = data?.daily.caloriesConsumed ?? 0;
  const netCalories = data?.daily.netCalories ?? 0;
  const budget = calorieBudget(target, consumed, data?.daily.caloriesBurned ?? 0, user.goalSettings);
  const remaining = budget.remaining;
  const progress = target ? Math.max(0, Math.min(100, consumed / target * 100)) : 0;
  const macros = useMemo(() => {
    const ingredients = (data?.meals ?? []).flatMap(meal => meal.ingredients);
    return (['carbs', 'protein', 'fat'] as const).reduce((result, key) => {
      const field = `${key}Grams` as const;
      const known = ingredients.flatMap(ingredient => ingredient[field] == null ? [] : [ingredient[field] as number]);
      result[key] = { grams: known.reduce((sum, grams) => sum + grams, 0), known: known.length, total: ingredients.length };
      return result;
    }, {} as Record<'carbs' | 'protein' | 'fat', { grams: number; known: number; total: number }>);
  }, [data]);
  const macroTargets = dailyMacroTargets(target, user.goalSettings?.mode);
  const mealsByType = useMemo(() => {
    const groups: Array<{ id: string; label: string; meals: PublicMeal[] }> = mealOptions.map(option => ({ ...option, meals: data?.meals.filter(meal => meal.mealType === option.id) ?? [] }));
    const unrecognized = data?.meals.filter(meal => !mealOptions.some(option => option.id === meal.mealType)) ?? [];
    if (unrecognized.length) groups.push({ id: 'unrecognized', label: 'ไม่ระบุมื้อ', meals: unrecognized });
    return groups.filter(group => group.meals.length > 0);
  }, [data]);
  const isToday = date === localDate();
  const changeDate = (next: string) => { if (next === date) return; setMealStatus(''); setMealError(''); setData(null); setLoading(true); setDate(next); };
  function openMeal(meal?: PublicMeal) { setMealError(''); setMealStatus(''); setEditingMeal(meal ?? null); }
  async function deleteMeal(meal: PublicMeal) {
    if (!window.confirm(`ลบ ${meal.name} จากประวัติอาหารหรือไม่`)) return;
    setDeletingId(meal.id); setMealError(''); setMealStatus('');
    try {
      await api(`/meals/${meal.id}`, {}, 'DELETE');
      setMealStatus('ลบรายการอาหารแล้ว');
      window.dispatchEvent(new Event('daily-calories-updated'));
    } catch (cause) {
      setMealError(cause instanceof ApiError ? cause.message : 'ลบรายการอาหารไม่ได้');
    } finally { setDeletingId(null); }
  }
  if (editingMeal !== undefined) return <section className="dashboard-meal-editor" aria-label="บันทึกอาหาร">
    <button className="secondary dashboard-meal-back" type="button" onClick={() => setEditingMeal(undefined)}>← กลับหน้าแรก</button>
    <Suspense fallback={<p role="status">กำลังเปิดแบบฟอร์มอาหาร…</p>}>
      <MealPanel key={editingMeal?.id ?? 'new-meal'} userId={user.id} selectedDate={editingMeal?.activityDate ?? date} initialMeal={editingMeal} initialEdit={Boolean(editingMeal)} showDailyList={false} onSaved={(message) => { setEditingMeal(undefined); setMealStatus(message); }} />
    </Suspense>
  </section>;
  return <><section className="dashboard-panel ref-today" aria-label="พลังงานของคุณ">
    <div className="ref-date-selector" role="group" aria-label="เลือกวันที่ดูข้อมูลหน้าแรก">
      <button type="button" className="ref-date-arrow" aria-label="วันก่อนหน้า" onClick={() => changeDate(shiftDay(date, -1))}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
      <label className="ref-date"><UiIcon name="calendar" /><span>วันที่ <strong>{formatDisplayDate(date)}</strong></span><input aria-label={`เลือกวันที่ ${formatDisplayDate(date)}`} type="date" max={localDate()} value={date} onClick={event => { try { event.currentTarget.showPicker?.(); } catch { /* Native input remains available when showPicker is unsupported. */ } }} onChange={e => { if (e.target.value && e.target.value <= localDate()) changeDate(e.target.value); }} /></label>
      <button type="button" className="ref-date-arrow" aria-label="วันถัดไป" disabled={date >= localDate()} onClick={() => { const next = shiftDay(date, 1); if (next <= localDate()) changeDate(next); }}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button>
    </div>
    <div className="ref-today-summary">
      {error ? <div><p className="feedback error" role="alert">{error}</p><button className="secondary" type="button" disabled={loading} onClick={() => { setLoading(true); setReloadVersion(value => value + 1); }}>ลองโหลดอีกครั้ง</button></div> : !data ? <p role="status">กำลังโหลดข้อมูล…</p> : <>
        <div className="ref-overview">
          <div className="ref-intake-card"><div className="energy-ring ref-ring" style={{ background: `conic-gradient(var(--ref-green) ${progress}%, #dcefe3 0)` }} aria-label={target ? `รับประทานแล้ว ${consumed} กิโลแคลอรี จากเป้าหมาย ${target} กิโลแคลอรี` : `รับประทานแล้ว ${consumed} กิโลแคลอรี ยังไม่ได้ตั้งเป้าหมาย`}><span><strong className="energy-consumed">{consumed.toLocaleString()}</strong><small>kcal</small></span><span className="ref-ring-target">{target ? `จาก ${target.toLocaleString()} kcal` : 'ยังไม่ได้ตั้งเป้า'}</span></div></div>
          <div className="ref-energy-side">
            <div className="ref-remaining"><UiIcon name="target" /><div><strong>{remaining === null ? 'ตั้งเป้าหมายในหน้าบัญชี' : remaining < 0 ? <>เกินเป้าหมาย <span className="energy-remaining">{Math.abs(remaining).toLocaleString()}</span> kcal</> : <>เหลืออีก <span className="energy-remaining">{remaining.toLocaleString()}</span> kcal</>}</strong><small>{user.goalSettings ? 'เทียบอาหารกับเป้าหมายวันนี้' : 'เป้าหมายเดิมเทียบพลังงานสุทธิ'}</small></div></div>
            <div className="ref-macro-stack ref-macro-grid"><h3 className="ref-section-label">สารอาหารหลัก</h3>{(['carbs','protein','fat'] as const).map((key,i) => {
            const value = macros[key];
            const shown = value.known === value.total ? `${Math.round(value.grams)}` : value.known === 0 ? '—' : `~${Math.round(value.grams)}`;
            const complete = value.known === value.total;
            const label = complete ? macroTargets ? '' : 'ยังไม่ได้ตั้งเป้าสารอาหาร' : value.known === 0 ? 'ข้อมูลไม่ครบ' : 'บางส่วน';
            const targetGrams = macroTargets?.grams[key];
            const percent = complete && targetGrams ? value.grams / targetGrams * 100 : null;
            const width = percent === null ? 0 : Math.max(0, Math.min(100, percent));
            const progressLabel = !complete ? 'ไม่แสดงความคืบหน้า เนื่องจากข้อมูลสารอาหารไม่ครบ' : targetGrams == null ? 'ยังไม่ได้ตั้งเป้าสารอาหาร' : `${['คาร์บ','โปรตีน','ไขมัน'][i]} ${Math.round(value.grams)} จากเป้าหมายประมาณ ${Math.round(targetGrams)} กรัม · ${Math.round(percent!)} เปอร์เซ็นต์`;
            return <div key={key} className={`ref-macro-row ref-${key}`}><div><span><UiIcon name={key} size={17} />{['คาร์บ','โปรตีน','ไขมัน'][i]}</span><strong>{shown}{targetGrams != null && <> / {Math.round(targetGrams)}</>} <small>กรัม</small></strong></div>{label && <small className="ref-macro-status">{label}</small>}<div className="ref-macro-track" aria-label={progressLabel}><span style={{ width: `${width}%` }} /></div></div>;
          })}</div>
          </div>
        </div>
        <button className="ref-details-toggle" type="button" aria-expanded={details} onClick={() => setDetails(value => !value)}>{details ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียดเพิ่มเติม'}<span aria-hidden="true">{details ? '−' : '+'}</span></button>
        {details && <div className="ref-details"><div className="ref-small-stats"><div className="ref-stat"><UiIcon name="run" /><span>ออกกำลังกาย</span><strong>{data.daily.caloriesBurned.toLocaleString()} kcal</strong></div><div className="ref-stat"><UiIcon name="scale" /><span>ค่า BMI</span><strong>{user.bmi?.toFixed(1) ?? '—'}</strong></div><div className="ref-stat"><UiIcon name="carbs" /><span>จำนวนอาหารที่บันทึก</span><strong>{data.meals.length} รายการ</strong></div></div><p className="ref-note">แท่งแสดงปริมาณที่รับประทานเทียบเป้าหมายสารอาหารต่อวัน ค่าตั้งต้น{user.goalSettings ? 'ตามแนวทางที่เลือก' : 'แบบสมดุลสำหรับเป้าหมายเดิม'} ไม่ใช่คำแนะนำเฉพาะบุคคล{!isToday && ' · วันที่ย้อนหลังเทียบกับเป้าหมายปัจจุบัน'}</p><p className="ref-note">พลังงานสุทธิ {netCalories.toLocaleString()} kcal · {user.goalSettings ? 'ออกกำลังแสดงประกอบ ไม่บวกกลับเข้าเป้าหมาย' : 'รับประทานลบด้วยการออกกำลังกาย'}</p></div>}
      </>}
    </div>
    <section className="ref-today-meals" aria-labelledby="today-meals-title"><header className="ref-today-meals-header"><h2 id="today-meals-title">อาหาร · {formatDisplayDate(date)}</h2><div><span>{data ? `${data.meals.length} รายการ` : '—'}</span><button type="button" className="ref-meal-add" onClick={() => openMeal()} disabled={!data}>＋ เพิ่มรายการ</button></div></header>
      {mealStatus && <p className="feedback success" role="status">{mealStatus}</p>}{mealError && <p className="feedback error" role="alert">{mealError}</p>}
      {!data ? <p role={error ? 'alert' : 'status'}>{error ? 'โหลดรายการอาหารไม่ได้' : 'กำลังโหลดรายการอาหาร…'}</p> : data.meals.length === 0 ? <p className="ref-note">{isToday ? 'ยังไม่มีรายการอาหารในวันนี้' : 'ยังไม่มีรายการอาหารในวันที่เลือก'}</p> : <div className="ref-today-meal-groups">{mealsByType.map(group => <section className="ref-today-meal-group" key={group.id} aria-labelledby={`meal-group-${group.id}`}><header className="ref-today-meal-group-header"><h3 id={`meal-group-${group.id}`}>{group.label}</h3><span>{group.meals.length} รายการ · {Math.round(group.meals.reduce((sum, meal) => sum + meal.totalCalories, 0))} kcal</span></header><div className="ref-today-meal-list">{group.meals.map(meal => <article key={meal.id} className="ref-meal-card"><button type="button" className="ref-meal-main" onClick={() => openMeal(meal)} disabled={deletingId !== null} aria-label={`เปิดรายละเอียด ${meal.name}`}>{meal.imageData ? <img src={meal.imageData} alt="" /> : <span className="ref-meal-placeholder" aria-hidden="true"><UiIcon name="carbs" /></span>}<span className="ref-meal-info"><strong>{meal.name}</strong><span>{meal.ingredients.map(item => item.name).filter(Boolean).join(' · ') || 'ยังไม่มีส่วนประกอบ'}</span></span><strong className="ref-meal-calories">{Math.round(meal.totalCalories)} kcal</strong><span className="ref-meal-chevron" aria-hidden="true">›</span></button><div className="ref-meal-actions"><button type="button" aria-label={`แก้ไข ${meal.name}`} onClick={() => openMeal(meal)} disabled={deletingId !== null}><UiIcon name="edit" size={16} /> แก้ไข</button><button type="button" className="delete" aria-label={`ลบ ${meal.name}`} onClick={() => void deleteMeal(meal)} disabled={deletingId !== null}>{deletingId === meal.id ? 'กำลังลบ…' : <><UiIcon name="trash" size={16} /> ลบ</>}</button></div></article>)}</div></section>)}</div>}
    </section>
  </section><button type="button" className="mobile-quick-log" onClick={() => openMeal()} disabled={!data}>＋ {isToday ? 'บันทึกอาหารของวันนี้' : `บันทึกอาหารวันที่ ${formatDisplayDate(date)}`}</button></>;
}
