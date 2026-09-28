import { useEffect, useState } from 'react';

import { readFavorites, type FavoriteMeal } from './favorites';
export type { FavoriteMeal } from './favorites';

export function FavoriteMealsPanel({ userId }: { userId: string }) {
  const [items, setItems] = useState<FavoriteMeal[]>([]);
  useEffect(() => { const load = () => setItems(readFavorites(userId)); load(); window.addEventListener('favorites-updated', load); return () => window.removeEventListener('favorites-updated', load); }, [userId]);
  return <section className="card favorite-panel"><span className="eyebrow">FREQUENT MEALS</span><h2>มื้อที่กินบ่อย</h2><p className="muted">เลือกรายการเพื่อเติมชื่ออาหารและสารอาหารกลับเข้าแบบฟอร์ม</p>{items.length ? items.map(item => <article key={item.name}><div><strong>{item.name}</strong><span>{item.ingredients.length} ส่วนประกอบ</span></div><button className="secondary" type="button" onClick={() => window.dispatchEvent(new CustomEvent<FavoriteMeal>('favorite-selected', { detail: item }))}>ใช้รายการนี้</button></article>) : <p className="empty-state">บันทึกอาหารสักรายการเพื่อสร้างมื้อที่กินบ่อย</p>}</section>;
}
