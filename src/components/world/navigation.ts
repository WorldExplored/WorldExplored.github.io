import type { SectionId } from '@/content/profile';
import { profile } from '@/content/profile';

const ids = new Set<string>(profile.sections.map(section => section.id));
const initial = { id: '' as SectionId | '', serial: 0 };
let snapshot = initial;
let previousHash = '';

export function readNavigation() {
  const hash = window.location.hash.slice(1);
  if (hash !== previousHash) {
    previousHash = hash;
    const id = ids.has(hash) ? hash as SectionId : '';
    if (id !== snapshot.id) snapshot = { id, serial: snapshot.serial + 1 };
  }
  return snapshot;
}
export function serverNavigation() { return initial; }
export function subscribeNavigation(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener('hashchange', callback);
  window.addEventListener('habitat:navigate', callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener('hashchange', callback);
    window.removeEventListener('habitat:navigate', callback);
  };
}
export function pushDestination(id: SectionId) {
  if (readNavigation().id === id) return;
  const state = window.history.state;
  const depth = readNavigation().id && state?.habitatDepth ? state.habitatDepth + 1 : 1;
  const base = readNavigation().id ? state?.habitatBaseHash ?? window.location.hash : '';
  window.history.pushState({ ...state, habitatDepth: depth, habitatBaseHash: base }, '', `#${id}`);
  window.dispatchEvent(new Event('habitat:navigate'));
}
export function clearDestination() {
  const current = readNavigation();
  const state = window.history.state;
  // Recovery is a new flight even when the URL already names the overview.
  if (!current.id) {
    snapshot = { id: '', serial: current.serial + 1 };
    previousHash = '';
    window.history.replaceState({ ...state, habitatDepth: 0, habitatBaseHash: '' }, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new Event('habitat:navigate'));
    return;
  }
  if (state?.habitatDepth && state.habitatBaseHash === '') window.history.go(-state.habitatDepth);
  else {
    window.history.replaceState(state, '', window.location.pathname + window.location.search);
    window.dispatchEvent(new Event('habitat:navigate'));
  }
}

/** Escape also recovers a camera that has moved while the overview URL is unchanged. */
export function subscribeOverviewRecovery(recover: () => void) {
  const escape = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    event.preventDefault(); recover();
  };
  window.addEventListener('keydown', escape);
  return () => window.removeEventListener('keydown', escape);
}
