export interface Preferences { reduced: boolean; saveData: boolean; forced: boolean; mobile: boolean; hidden: boolean }
const initial: Preferences = { reduced: false, saveData: false, forced: false, mobile: false, hidden: false };
let cache = initial;
const queries = ['(prefers-reduced-motion: reduce)', '(forced-colors: active)', '(max-width: 767px)'];
function connection() { return (navigator as Navigator & { connection?: EventTarget & { saveData?: boolean } }).connection; }
export function readPreferences() {
  const next = { reduced: window.matchMedia(queries[0]).matches, forced: window.matchMedia(queries[1]).matches, mobile: window.matchMedia(queries[2]).matches, saveData: Boolean(connection()?.saveData), hidden: document.hidden };
  if (Object.keys(next).some(key => next[key as keyof Preferences] !== cache[key as keyof Preferences])) cache = next;
  return cache;
}
export function serverPreferences() { return initial; }
export function subscribePreferences(callback: () => void) {
  const media = queries.map(query => window.matchMedia(query));
  media.forEach(query => query.addEventListener('change', callback));
  document.addEventListener('visibilitychange', callback);
  connection()?.addEventListener('change', callback);
  return () => {
    media.forEach(query => query.removeEventListener('change', callback));
    document.removeEventListener('visibilitychange', callback);
    connection()?.removeEventListener('change', callback);
  };
}
