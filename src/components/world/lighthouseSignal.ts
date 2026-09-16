import type { SceneRuntime } from '../../content/world';

export const LIGHTHOUSE_INTERACTION = { label: 'Illuminate lighthouse', seconds: 4 } as const;
export interface LighthouseSignal { remaining: number; intensity: number; serial: number }
const signals = new WeakMap<SceneRuntime, LighthouseSignal>();
export function lighthouseSignal(runtime: SceneRuntime) {
  let signal = signals.get(runtime);
  if (!signal) { signal = { remaining: 0, intensity: 0, serial: 0 }; signals.set(runtime, signal); }
  return signal;
}
export function illuminateLighthouse(runtime: SceneRuntime) {
  const signal = lighthouseSignal(runtime); signal.remaining = LIGHTHOUSE_INTERACTION.seconds; signal.intensity = 1; signal.serial++;
}
export function stepLighthouseSignal(signal: LighthouseSignal, delta: number, reducedMotion: boolean) {
  if (reducedMotion) return;
  signal.remaining = Math.max(0, signal.remaining - Math.max(0, delta));
  signal.intensity = signal.remaining === 0 ? 0 : Math.min(1, signal.remaining / .7);
}

interface SignalScheduler {
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (handle: ReturnType<typeof setTimeout>) => void;
}
/** Demand rendering needs one frame for activation and one for the wall-clock reset. */
export function createLighthouseActivation(runtime: SceneRuntime, invalidate: () => void, scheduler: SignalScheduler = {
  schedule: (callback, delay) => setTimeout(callback, delay), cancel: handle => clearTimeout(handle),
}) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const signal = lighthouseSignal(runtime);
  const clear = () => { if (timeout !== undefined) scheduler.cancel(timeout); timeout = undefined; };
  return {
    activate() {
      clear(); illuminateLighthouse(runtime); const serial = signal.serial;
      invalidate();
      timeout = scheduler.schedule(() => {
        if (signal.serial !== serial) return;
        timeout = undefined;
        signal.remaining = 0; signal.intensity = 0; invalidate();
      }, LIGHTHOUSE_INTERACTION.seconds * 1000);
    },
    dispose() { clear(); signal.remaining = 0; signal.intensity = 0; signal.serial++; },
  };
}
