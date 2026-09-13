import type { SectionId } from '@/content/profile';

export function Arrow({ down = false }: { down?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className={down ? 'arrow-down' : ''}><path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function HabitatIcon({ kind }: { kind: SectionId }) {
  return <span className={`habitat-icon icon-${kind}`} aria-hidden="true"><svg viewBox="0 0 40 40" fill="none">
    {kind === 'work' && <><rect x="10" y="10" width="20" height="20" rx="5" fill="currentColor" /><rect x="15" y="15" width="10" height="10" rx="2" fill="white" fillOpacity=".8" /><path d="M14 6v4m6-4v4m6-4v4M14 30v4m6-4v4m6-4v4M6 14h4m-4 6h4m-4 6h4m20-12h4m-4 6h4m-4 6h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
    {kind === 'research' && <><path d="M7 10q7-3 13 2 6-5 13-2v22q-7-3-13 1-6-4-13-1Z" fill="white" fillOpacity=".9" stroke="currentColor" strokeWidth="1.5" /><path d="M20 12v21m-9-17 5 1m-5 4 5 1m8-5 5-1m-5 6 5-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>}
    {kind === 'purdue' && <><path d="m6 15 14-9 14 9v3H6Z" fill="currentColor" /><path d="M10 19v11m10-11v11m10-11v11" stroke="currentColor" strokeWidth="4" /><path d="M6 32h28" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></>}
    {kind === 'about' && <><circle cx="20" cy="14" r="6" fill="white" fillOpacity=".9" stroke="currentColor" strokeWidth="1.5" /><path d="M8 32c0-13 24-13 24 0Z" fill="currentColor" /></>}
    {kind === 'contact' && <><rect x="6" y="11" width="28" height="21" rx="5" fill="white" fillOpacity=".9" stroke="currentColor" strokeWidth="1.5" /><path d="m8 14 12 9 12-9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>}
    {kind === 'building' && <><circle cx="20" cy="13" r="6" fill="white" stroke="currentColor" strokeWidth="1.5" /><path d="M20 20v12m-6 1h12M9 13a11 11 0 0 1 22 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></>}
  </svg></span>;
}
