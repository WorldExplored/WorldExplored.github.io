import type { AudioPlaybackState, LicensedAudioSource } from '../content/audio';

export interface AudioPreferences { volume: number; muted: boolean }
export interface PlaylistSnapshot extends AudioPreferences { active: boolean; state: AudioPlaybackState; index: number }
export const AUDIO_PREFERENCES_KEY = 'portfolio-audio-preferences-v1';
export function readAudioPreferences(storage?: Pick<Storage, 'getItem'>): AudioPreferences {
  try {
    const value = JSON.parse(storage?.getItem(AUDIO_PREFERENCES_KEY) ?? 'null');
    return { volume: typeof value?.volume === 'number' && Number.isFinite(value.volume) ? Math.min(1, Math.max(0, value.volume)) : .25, muted: value?.muted === true };
  } catch { return { volume: .25, muted: false }; }
}
export function shuffledOrder(length: number, random = Math.random) {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = length - 1; index > 0; index--) { const swap = Math.floor(Math.max(0, Math.min(.99999999, random())) * (index + 1)); [order[index], order[swap]] = [order[swap], order[index]]; }
  return order;
}
export function adjacentTrack(order: readonly number[], current: number, direction: 1 | -1, failed: ReadonlySet<number>) {
  const cursor = order.indexOf(current);
  for (let offset = 1; offset < order.length; offset++) { const index = order[(cursor + offset * direction + order.length) % order.length]; if (!failed.has(index)) return index; }
  return null;
}
interface PlaylistOptions {
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  random?: () => number;
  reducedMotion?: () => boolean;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel?: (handle: ReturnType<typeof setTimeout>) => void;
}

/** One native audio element keeps the first play call inside the user gesture. */
export class AudioPlaylist {
  snapshot: PlaylistSnapshot;
  private order: number[] = [];
  private failed = new Set<number>();
  private intent = false;
  private serial = 0;
  private disposed = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly schedule: NonNullable<PlaylistOptions['schedule']>;
  private readonly cancel: NonNullable<PlaylistOptions['cancel']>;
  private readonly now: () => number;
  constructor(private media: HTMLAudioElement, private tracks: readonly LicensedAudioSource[], private changed: (snapshot: PlaylistSnapshot) => void, private options: PlaylistOptions = {}) {
    this.snapshot = { active: false, state: 'ready', index: 0, ...readAudioPreferences(options.storage) };
    this.schedule = options.schedule ?? ((callback, delay) => setTimeout(callback, delay));
    this.cancel = options.cancel ?? (handle => clearTimeout(handle));
    this.now = options.now ?? (() => performance.now());
    media.volume = this.snapshot.volume; media.muted = this.snapshot.muted;
    media.addEventListener('playing', this.onPlaying); media.addEventListener('waiting', this.onWaiting); media.addEventListener('ended', this.onEnded); media.addEventListener('error', this.onError);
  }
  private publish(patch: Partial<PlaylistSnapshot>) { this.snapshot = { ...this.snapshot, ...patch }; if (!this.disposed) this.changed(this.snapshot); }
  private clearWait() { if (this.timer !== null) this.cancel(this.timer); this.timer = null; }
  private clearFade() { if (this.fadeTimer !== null) this.cancel(this.fadeTimer); this.fadeTimer = null; }
  private currentEvent() { return !this.disposed && this.intent && (!this.media.currentSrc || this.media.currentSrc === this.tracks[this.snapshot.index]?.playbackUrl); }
  private watch() { if (this.timer !== null) return; const serial = this.serial; this.timer = this.schedule(() => { if (serial === this.serial) this.fail(); }, 20000); }
  private ramp(target: number, duration: number, done?: () => void) {
    this.clearFade(); if (this.options.reducedMotion?.()) duration = 0;
    const start = this.media.volume, began = this.now(), serial = this.serial;
    const tick = () => {
      if (this.disposed || serial !== this.serial) return;
      const progress = duration ? Math.min(1, (this.now() - began) / duration) : 1;
      this.media.volume = start + (target - start) * progress;
      if (progress < 1) this.fadeTimer = this.schedule(tick, 20); else { this.fadeTimer = null; done?.(); }
    };
    tick();
  }
  private load(index: number) {
    if (this.disposed || !this.intent) return;
    const serial = ++this.serial; this.clearWait(); this.clearFade(); this.media.pause();
    this.publish({ active: true, index, state: 'loading' }); this.media.src = this.tracks[index].playbackUrl; this.media.volume = this.options.reducedMotion?.() ? this.snapshot.volume : 0; this.media.muted = this.snapshot.muted;
    this.watch();
    void this.media.play().catch((error: unknown) => {
      if (this.disposed || serial !== this.serial) return;
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError') { this.intent = false; this.clearWait(); this.publish({ state: 'ready' }); }
      else this.fail();
    });
  }
  play() {
    if (this.disposed || !this.tracks.length) return;
    if (!this.order.length) this.order = shuffledOrder(this.tracks.length, this.options.random);
    if (this.snapshot.state === 'unavailable') this.failed.clear();
    this.intent = true;
    const index = this.snapshot.active ? this.snapshot.index : this.order[0];
    if (this.media.getAttribute('src') === this.tracks[index].playbackUrl && this.snapshot.state === 'paused') {
      const serial = ++this.serial; this.publish({ state: 'loading' }); this.watch();
      void this.media.play().catch(() => { if (serial === this.serial) { this.intent = false; this.clearWait(); this.publish({ state: 'ready' }); } });
    } else this.load(index);
  }
  pause() { this.intent = false; this.serial++; this.clearWait(); this.clearFade(); this.media.pause(); this.media.volume = this.snapshot.volume; this.publish({ state: 'paused' }); }
  move(direction: 1 | -1) {
    if (!this.snapshot.active || this.disposed) return;
    const next = adjacentTrack(this.order, this.snapshot.index, direction, this.failed);
    if (next === null) return;
    if (!this.intent) { this.serial++; this.clearWait(); this.clearFade(); this.media.pause(); this.media.removeAttribute('src'); this.media.load(); this.publish({ index: next, state: 'paused' }); return; }
    this.ramp(0, 220, () => this.load(next));
  }
  private fail() {
    if (!this.intent || this.disposed) return;
    this.serial++; this.clearWait(); this.clearFade(); this.media.pause(); this.failed.add(this.snapshot.index);
    const next = adjacentTrack(this.order, this.snapshot.index, 1, this.failed);
    if (next === null) { this.intent = false; this.publish({ state: 'unavailable' }); return; }
    const serial = this.serial; this.timer = this.schedule(() => { if (serial === this.serial) this.load(next); }, 0);
  }
  private onError = () => { if (this.currentEvent()) this.fail(); };
  private onWaiting = () => { if (this.currentEvent()) { this.publish({ state: 'buffering' }); this.watch(); } };
  private onPlaying = () => { if (this.currentEvent()) { this.clearWait(); this.publish({ state: 'playing' }); this.ramp(this.snapshot.volume, 420); } };
  private onEnded = () => {
    if (!this.currentEvent()) return;
    const next = adjacentTrack(this.order, this.snapshot.index, 1, this.failed);
    if (next === null) { this.intent = false; this.clearWait(); this.publish({ state: 'ended' }); } else this.load(next);
  };
  setPreferences(patch: Partial<AudioPreferences>) {
    const volume = patch.volume === undefined ? this.snapshot.volume : Math.min(1, Math.max(0, Number.isFinite(patch.volume) ? patch.volume : .25));
    const muted = patch.muted ?? this.snapshot.muted; this.clearFade(); this.media.volume = volume; this.media.muted = muted; this.publish({ volume, muted });
    try { this.options.storage?.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume, muted })); } catch { /* Playback also works when storage is unavailable. */ }
  }
  close() { this.pause(); this.media.removeAttribute('src'); this.media.load(); this.publish({ active: false, state: 'ready' }); }
  dispose() { this.disposed = true; this.intent = false; this.serial++; this.clearWait(); this.clearFade(); this.media.pause(); this.media.removeAttribute('src'); this.media.load(); this.media.removeEventListener('playing', this.onPlaying); this.media.removeEventListener('waiting', this.onWaiting); this.media.removeEventListener('ended', this.onEnded); this.media.removeEventListener('error', this.onError); }
}
