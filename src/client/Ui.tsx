import type { ReactNode } from 'react';

const shapes: Record<string, ReactNode> = {
  home: <path d="m3 10 9-7 9 7v10h-6v-6H9v6H3Z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  chart: <path d="M5 20V10m7 10V4m7 16v-8" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
  back: <path d="m14 5-7 7 7 7" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  camera: <><path d="m8 5 2-2h4l2 2h4v16H4V5Z" /><circle cx="12" cy="13" r="4" /></>,
  image: <><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="8" cy="8" r="1" /><path d="m3 17 5-5 4 4 3-3 6 5" /></>,
  run: <><circle cx="15" cy="4" r="2" /><path d="m5 10 5-3 4 3 5 1m-7-3-3 7 6 2 2 5m-8-7-3 6-3 1" /></>,
  edit: <><path d="m15 4 5 5M4 20l1-6L16 3a2 2 0 0 1 5 5L10 19Z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" /></>,
  leaf: <><path d="M20 3C7 1 1 10 7 17c7 6 16-1 13-14ZM4 21 16 9" /></>,
  carbs: <><path d="M6 8C1 5 4 2 12 2s11 3 6 6v13H6Z" /><path d="M9 9v8m6-8v8" /></>,
  protein: <><path d="M7 4c7-5 17 3 14 11-3 8-16 7-19-1-2-5 0-8 5-10Z" /><path d="m7 8 8 7m-9-3 5 5" /></>,
  fat: <><path d="m3 8 18-5v18H3Z" /><circle cx="8" cy="14" r="1" /><circle cx="16" cy="10" r="1" /><circle cx="17" cy="17" r="1" /></>,
  scale: <><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M7 9a5 5 0 0 1 10 0l-5 3Zm5 3 2-5" /></>,
  bell: <><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4Zm4 3h6M12 2v2" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-11v1" /></>,
  logout: <><path d="M10 4H4v16h6m5-13 5 5-5 5m-6-5h11" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  check: <path d="m5 12 4 4L20 5" />,
  refresh: <><path d="M20 9a8 8 0 0 0-14-4L3 8m0-5v5h5m-4 7a8 8 0 0 0 14 4l3-3m0 5v-5h-5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="m12 12 9-9m-1 0v4h-4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></>,
  bike: <><circle cx="5" cy="17" r="4" /><circle cx="19" cy="17" r="4" /><path d="m5 17 5-9 5 9H5m5-9h6l3 9M8 5h4m2-1h3v4" /></>,
  strength: <><path d="M2 9v6m4-9v12m12-12v12m4-9v6M6 12h12" /></>,
  yoga: <><circle cx="12" cy="4" r="2" /><path d="m5 11 7-3 7 3m-7-3v7m-5 6 5-6 5 6M4 21h16" /></>,
};

export function UiIcon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  return <svg className={`ui-icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{shapes[name] ?? shapes.info}</svg>;
}

export function BrandMark({ large = false }: { large?: boolean }) {
  return <span className={`ref-brand-mark ${large ? 'is-large' : ''}`} aria-hidden="true"><img src="/brand/lifebalance-mark.svg" alt="" width="96" height="96" /></span>;
}

export function BrandWordmark() {
  return <strong className="ref-brand-wordmark"><span>Life</span>Balance</strong>;
}

export function PageHeading({ title, onBack, action }: { title: string; onBack?: () => void; action?: ReactNode }) {
  return <header className="ref-heading">{onBack && <button type="button" className="icon-button" aria-label="ย้อนกลับ" onClick={onBack}><UiIcon name="back" /></button>}<h2>{title}</h2>{action}</header>;
}

export function LeafBackdrop() {
  return <svg className="ref-leaf-backdrop" viewBox="0 0 400 850" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="leaf-green" x2="1" y2="1"><stop stopColor="#dff4dc" /><stop offset="1" stopColor="#8bc798" /></linearGradient></defs>{[[0,120,1,15],[390,210,1.2,-150],[-30,580,1.4,-20],[390,760,1.8,-160],[90,850,1.6,-60],[330,30,.7,-130]].map(([x,y,s,r],i)=><g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} opacity=".6"><path fill="url(#leaf-green)" d="M0 0C-55-90 45-145 70-170 100-90 65-30 0 0Z" /><path fill="none" stroke="#73b183" strokeWidth="2" d="M0 15 55-130M22-40 2-72M35-75l35-9" /><path fill="#c7e7c8" d="M0 0C45-20 85 4 105 30 56 47 20 37 0 0Z" /></g>)}</svg>;
}
