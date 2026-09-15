import { useId } from 'react';
import type { SectionId } from '@/content/profile';

export function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={down ? 'arrow-down' : ''}><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function DockShell() {
  const id = useId().replace(/:/g, '');
  return <svg className="dock-shell" viewBox="0 0 520 108" preserveAspectRatio="none" aria-hidden="true"><defs>
    <linearGradient id={`${id}-shell`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ecffff" stopOpacity=".95"/><stop offset=".28" stopColor="#b9f0f5" stopOpacity=".83"/><stop offset=".65" stopColor="#4aafce" stopOpacity=".91"/><stop offset="1" stopColor="#087baf" stopOpacity=".96"/></linearGradient>
    <linearGradient id={`${id}-lip`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#f5ffff"/><stop offset=".7" stopColor="#a8eafa"/><stop offset="1" stopColor="#55b2cf"/></linearGradient>
  </defs><path d="M25 16Q260-7 495 16Q516 19 518 43L515 76Q513 98 488 102Q260 115 32 102Q7 98 5 76L2 43Q4 19 25 16Z" fill={`url(#${id}-shell)`} stroke="#edfefe" strokeWidth="2"/><path d="M23 22Q260 1 497 22M15 92Q260 108 505 92" fill="none" stroke={`url(#${id}-lip)`} strokeWidth="3" strokeLinecap="round"/><path d="M25 95Q260 112 495 95" fill="none" stroke="#14587e" strokeOpacity=".6" strokeWidth="2"/></svg>;
}

/** Original miniature instruments share a fixed upper-left light source. */
export function HabitatIcon({ kind }: { kind: SectionId }) {
  const id = useId().replace(/:/g, '');
  const glass = `url(#${id}-glass)`; const shell = `url(#${id}-white)`; const gold = `url(#${id}-gold)`;
  return <span className={`habitat-icon icon-${kind}`} aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><defs>
    <linearGradient id={`${id}-glass`} x1=".2" y1="0" x2=".8" y2="1" gradientUnits="objectBoundingBox"><stop stopColor="#e7ffff"/><stop offset=".42" stopColor="#57d8df"/><stop offset=".6" stopColor="#1687b5"/><stop offset="1" stopColor="#075078"/></linearGradient>
    <linearGradient id={`${id}-white`} x1="0" y1="0" x2=".9" y2="1"><stop stopColor="#fff"/><stop offset=".48" stopColor="#f1ffff"/><stop offset="1" stopColor="#8cc0d0"/></linearGradient>
    <linearGradient id={`${id}-gold`} x1="0" y1="0" x2=".8" y2="1"><stop stopColor="#fff6bd"/><stop offset=".4" stopColor="#e7be53"/><stop offset=".72" stopColor="#9c6f18"/><stop offset="1" stopColor="#ffe298"/></linearGradient>
  </defs><ellipse cx="33" cy="53" rx="21" ry="4" fill="#0c4972" opacity=".22"/>
    {kind === 'work' && <><path d="M13 31 30 22 50 29v20L31 56 13 48Z" fill={shell} stroke="#43839a"/><path d="m18 33 13-6 14 5v14l-14 6-13-6Z" fill={glass}/><path d="M31 28v24m-7-21v18m15-19v19" stroke="#e2ffff" strokeWidth="1.5"/><ellipse cx="31" cy="22" rx="17" ry="7" transform="rotate(-29 31 22)" stroke="#0a759c" strokeWidth="5"/><ellipse cx="31" cy="21" rx="17" ry="7" transform="rotate(-29 31 21)" stroke={shell} strokeWidth="3"/><path d="m18 24 5 2m16-13 4 2" stroke="#72bd39" strokeWidth="4" strokeLinecap="round"/><circle cx="32" cy="22" r="5" fill={glass} stroke="white"/></>}
    {kind === 'research' && <><path d="M12 41q11-5 20 1 9-6 20-1v11q-11-3-20 2-9-5-20-2Z" fill={shell} stroke="#6b9dae"/><path d="M32 43v10m-15-8 10 2m10 0 10-2" stroke="#4381a0"/><path d="m27 37 5-13 5 13" stroke={shell} strokeWidth="5"/><ellipse cx="32" cy="24" rx="18" ry="8" transform="rotate(-43 32 24)" fill="#ecffff" stroke="#267fa2" strokeWidth="2"/><ellipse cx="32" cy="24" rx="12" ry="5" transform="rotate(-43 32 24)" fill={glass}/><circle cx="28" cy="20" r="3" fill="white"/><path d="m44 13 5-3m-3 9 5-1" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></>}
    {kind === 'purdue' && <><path d="m12 44 20-7 20 7v8l-20 5-20-5Z" fill={shell} stroke="#4e798b"/><path d="M20 46V28q12-11 24 0v18" stroke="#244456" strokeWidth="7"/><path d="M20 45V28q12-11 24 0v17" stroke={gold} strokeWidth="4"/><ellipse cx="32" cy="20" rx="13" ry="7" transform="rotate(-24 32 20)" stroke={gold} strokeWidth="4"/><circle cx="32" cy="20" r="4" fill={glass} stroke="white"/><path d="M24 47h16" stroke="#69cfb1" strokeWidth="3" strokeLinecap="round"/></>}
    {kind === 'about' && <><path d="M14 48q18-10 36 0l-4 5q-14 6-28 0Z" fill={shell} stroke="#478296"/><circle cx="32" cy="30" r="17" fill={glass} stroke="#f4ffff" strokeWidth="1.5"/><path d="M19 33c13 6 27-2 27-12M25 15c-7 22 5 29 13 29" stroke="#e4fafa" opacity=".75" strokeWidth="2"/><ellipse cx="27" cy="21" rx="8" ry="4" transform="rotate(-26 27 21)" fill="white" opacity=".8"/><path d="M30 45c-12-1-16-8-16-13 12-1 17 7 16 13Z" fill="#69b82d" stroke="#338831"/><path d="M31 47 19 37" stroke="#c6f09f" strokeWidth="1.5"/></>}
    {kind === 'contact' && <><path d="M13 48q19-9 38 0l-5 5H18Z" fill={shell} stroke="#478296"/><path d="M31 46V28" stroke={shell} strokeWidth="5"/><path d="M31 34C15 35 9 24 14 15c12 0 19 7 17 19Z" fill={glass} stroke="white" strokeWidth="1.5"/><path d="M32 34c-1-16 7-24 18-20 2 12-5 21-18 20Z" fill={glass} stroke="white" strokeWidth="1.5"/><path d="m19 20 12 14 13-14" stroke="#c8ffff" strokeWidth="1.5"/><circle cx="32" cy="36" r="5" fill={gold} stroke="white"/><path d="M10 28c-3 9 3 14 8 16m36-16c3 9-3 14-8 16" stroke="#258faf" strokeWidth="2" strokeLinecap="round"/></>}
    {kind === 'building' && <><path d="m25 50 3-25h8l3 25Z" fill={shell} stroke="#398299"/><path d="M24 21h16v7H24Z" fill={glass} stroke="#edfefe"/><path d="m23 21 9-8 9 8M21 50h22" stroke={shell} strokeWidth="4" strokeLinejoin="round"/><path d="M19 19 8 15m37 4 11-4" stroke="#c4faff" strokeWidth="3" strokeLinecap="round"/></>}
  </svg></span>;
}
