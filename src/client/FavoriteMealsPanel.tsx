import { useEffect, useState } from 'react';

export type FavoriteMeal = { name: string; mealType: string; ingredients: { name: string; carbsGrams: number; sugarGrams: number; proteinGrams: number; fatGrams: number }[] };

export function FavoriteMealsPanel() {
  const [items, setItems] = useState<FavoriteMeal[]>([]);
  const load = () => setItems(JSON.parse(localStorage.getItem('lifebalance-favorites') ?? '[]'));
  useEffect(() => { load(); window.addEventListener('favorites-updated', load); return () => window.removeEventListener('favorites-updated', load); }, []);
  return <section className="card favorite-panel"><span className="eyebrow">FREQUENT MEALS</span><h2>มื้อที่กินบ่อย</h2><p className="muted">เลือกรายการเพื่อเติมชื่ออาหารและสารอาหารกลับเข้าแบบฟอร์ม</p>{items.length ? items.map(item => <article key={item.name}><div><strong>{item.name}</strong><span>{item.ingredients.length} ส่วนประกอบ</span></div><button className="secondary" type="button" onClick={() => window.dispatchEvent(new CustomEvent<FavoriteMeal>('favorite-selected', { detail: item }))}>ใช้รายการนี้</button></article>) : <p className="empty-state">บันทึกอาหารสักรายการเพื่อสร้างมื้อที่กินบ่อย</p>}</section>;
}
