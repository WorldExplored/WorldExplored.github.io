export const TOWN_ACTIONS = ['fountain', 'station', 'solar', 'greenhouse', 'buoy', 'wind'] as const;
export type TownAction = typeof TOWN_ACTIONS[number];
export type FountainPattern = 0 | 1 | 2;
const durations: Record<TownAction, number> = { fountain: 20, station: 8, solar: 10, greenhouse: 12, buoy: 6, wind: 8 };

export interface TownTimers { set(callback: () => void, delay: number): unknown; clear(handle: unknown): void }
const wallTimers: TownTimers = {
  set(callback, delay) { const timer = setTimeout(callback, delay); if (typeof timer === 'object') timer.unref?.(); return timer; },
  clear(handle) { clearTimeout(handle as ReturnType<typeof setTimeout>); },
};

// Activation is bounded and reversible; render state is retained between frames.
export function createTownInteractionState(timers: TownTimers = wallTimers) {
  const states = Object.fromEntries(TOWN_ACTIONS.map(id => [id, { active: false, amount: 0, remaining: 0 }])) as Record<TownAction, { active: boolean; amount: number; remaining: number }>;
  const listeners = new Set<() => void>();
  const deadlines = new Map<TownAction, unknown>();
  let releaseTimer: unknown;
  const clearDeadline = (id: TownAction) => { if (deadlines.has(id)) timers.clear(deadlines.get(id)); deadlines.delete(id); };
  let revision = 0; let pattern: FountainPattern = 0;
  const publish = () => { revision++; listeners.forEach(listener => listener()); };
  return {
    states,
    get pattern() { return pattern; },
    snapshot: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate(id: TownAction) {
      clearDeadline(id);
      const state = states[id];
      if (id === 'fountain') { pattern = ((pattern + 1) % 3) as FountainPattern; state.active = pattern !== 0; }
      else state.active = !state.active;
      state.remaining = state.active ? durations[id] : 0;
      if (state.active) deadlines.set(id, timers.set(() => {
        deadlines.delete(id); state.active = false; state.remaining = 0;
        if (id === 'fountain') pattern = 0;
        publish();
      }, durations[id] * 1000));
      publish();
    },
    reset() { pattern = 0; for (const id of TOWN_ACTIONS) { clearDeadline(id); const state = states[id]; state.active = false; state.remaining = 0; state.amount = 0; } publish(); },
    retain() {
      if (releaseTimer !== undefined) timers.clear(releaseTimer);
      return () => { releaseTimer = timers.set(() => { for (const id of TOWN_ACTIONS) clearDeadline(id); listeners.clear(); }, 0); };
    },
    dispose() { if (releaseTimer !== undefined) timers.clear(releaseTimer); for (const id of TOWN_ACTIONS) clearDeadline(id); listeners.clear(); },
    advance(delta: number, reducedMotion: boolean) {
      const dt = Math.min(.1, Math.max(0, Number.isFinite(delta) ? delta : 0));
      let changed = false;
      for (const id of TOWN_ACTIONS) {
        const state = states[id];
        if (state.active) {
          state.remaining = Math.max(0, state.remaining - dt);
          if (!state.remaining) { clearDeadline(id); state.active = false; if (id === 'fountain') pattern = 0; changed = true; }
        }
        const goal = state.active ? 1 : 0;
        state.amount = reducedMotion ? goal : state.amount + (goal - state.amount) * (1 - Math.exp(-dt * 6));
        if (Math.abs(state.amount - goal) < .0001) state.amount = goal;
      }
      if (changed) publish();
    },
  };
}
export type TownInteractionState = ReturnType<typeof createTownInteractionState>;
