export interface CoastalSoundScene {
  listener: [number, number, number];
  ferry: [number, number, number];
  ferrySpeed: number;
  foliageDistance: number;
  fountainPressure: number;
}
export const coastalSoundScene: CoastalSoundScene = { listener: [42, 29, 76], ferry: [-14, .17, -60], ferrySpeed: 0, foliageDistance: 80, fountainPressure: 1 };
export const COASTAL_BELL_EVENT = 'portfolio:harbor-bell';
export const COASTAL_AUDIO_FILES = ['shore', 'leaves', 'fountain', 'motor', 'gull', 'bell'] as const;
type Sound = typeof COASTAL_AUDIO_FILES[number];
export interface CoastalAudioPreferences { volume: number; muted: boolean }

export function proximity(listener: readonly number[], source: readonly number[], radius: number) {
  const distance = Math.hypot(...listener.map((value, i) => value - source[i]));
  return 1 / (1 + (distance / radius) ** 2);
}

/** Remove the hard loop splice with a one-second equal-power overlap. */
export function loopSamples(data: Float32Array, fade: number) {
  const overlap = Math.min(Math.max(1, fade), Math.floor(data.length / 4));
  const result = data.slice(overlap);
  const start = result.length - overlap;
  for (let i = 0; i < overlap; i++) {
    const t = i / Math.max(1, overlap - 1);
    result[start + i] = data[data.length - overlap + i] * Math.cos(t * Math.PI / 2) + data[i] * Math.sin(t * Math.PI / 2);
  }
  return result;
}

export class CoastalAudio {
  readonly context: AudioContext;
  readonly master: GainNode;
  private ambient: GainNode;
  private buffers = new Map<Sound, Promise<AudioBuffer>>();
  private sources = new Set<AudioBufferSourceNode>();
  private layers = new Map<string, GainNode>();
  private technologyVoices = new Map<OscillatorNode, () => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private nextGull = 0;
  private gullUntil = 0;
  private lastBell = -Infinity;
  private lastTechnology = -Infinity;
  private running = false;
  private initialized = false;
  private disposed = false;
  bellCount = 0;

  constructor(preferences: CoastalAudioPreferences, context?: AudioContext) {
    this.context = context ?? new AudioContext();
    this.master = this.context.createGain();
    this.master.connect(this.context.destination);
    this.ambient = this.context.createGain();
    this.ambient.gain.value = 0;
    this.ambient.connect(this.master);
    this.setPreferences(preferences);
  }
  setPreferences(preferences: CoastalAudioPreferences) {
    this.master.gain.setTargetAtTime(preferences.muted ? 0 : preferences.volume, this.context.currentTime, .06);
  }
  private load(name: Sound) {
    let pending = this.buffers.get(name);
    if (!pending) {
      pending = fetch(`/audio/coast/${name}.mp3`).then(response => {
        if (!response.ok) throw new Error(`Coastal audio unavailable: ${name}`);
        return response.arrayBuffer();
      }).then(data => this.context.decodeAudioData(data));
      this.buffers.set(name, pending);
      void pending.catch(() => this.buffers.delete(name));
    }
    return pending;
  }
  private source(buffer: AudioBuffer, output: AudioNode) {
    const source = this.context.createBufferSource();
    source.buffer = buffer; source.connect(output); this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    return source;
  }
  private async loop(name: Sound, key: string, frequency: number, type: BiquadFilterType = 'lowpass') {
    const input = await this.load(name);
    if (this.disposed) return;
    const data = loopSamples(input.getChannelData(0), Math.round(input.sampleRate));
    const buffer = this.context.createBuffer(1, data.length, input.sampleRate);
    buffer.copyToChannel(data, 0);
    const filter = this.context.createBiquadFilter(), gain = this.context.createGain();
    filter.type = type; filter.frequency.value = frequency; filter.Q.value = .4;
    gain.gain.value = 0; filter.connect(gain).connect(this.ambient); this.layers.set(key, gain);
    const source = this.source(buffer, filter); source.loop = true; source.start();
  }
  async start() {
    // Called directly from a gesture, before awaiting downloads.
    await this.context.resume();
    if (!this.initialized) {
      // Complete downloads before creating loops, so a failed retry cannot duplicate a layer.
      await Promise.all(['shore', 'leaves', 'fountain', 'motor', 'gull'].map(name => this.load(name as Sound)));
      if (this.disposed) return;
      await Promise.all([this.loop('shore', 'shore', 6500), this.loop('leaves', 'wind', 650), this.loop('leaves', 'rustle', 1100, 'highpass'), this.loop('fountain', 'fountain', 7000), this.loop('motor', 'motor', 480), this.load('gull')]);
      this.initialized = true;
      this.timer = setInterval(() => this.update(), 200);
    }
    if (this.disposed) return;
    this.running = true; this.nextGull = this.context.currentTime + 8;
    this.ambient.gain.setTargetAtTime(1, this.context.currentTime, .8); this.update();
  }
  pause() { this.running = false; this.ambient.gain.setTargetAtTime(0, this.context.currentTime, .15); }
  private update() {
    const now = this.context.currentTime, scene = coastalSoundScene;
    const levels: Record<string, number> = {
      shore: .26,
      wind: .045,
      rustle: .08 / (1 + (scene.foliageDistance / 7) ** 2),
      fountain: .30 * proximity(scene.listener, [-16.2, 1.4, -70], 8) * scene.fountainPressure,
      motor: .065 * proximity(scene.listener, scene.ferry, 12) * Math.min(1, scene.ferrySpeed / 1.8),
    };
    for (const [key, gain] of this.layers) gain.gain.setTargetAtTime(levels[key] ?? 0, now, .3);
    if (this.running && !document.hidden && now >= this.nextGull && now >= this.gullUntil) {
      this.nextGull = now + 32 + Math.random() * 27;
      void this.load('gull').then(buffer => {
        if (!this.running || this.disposed) return;
        const gain = this.context.createGain(); gain.gain.value = .075;
        const pan = this.context.createStereoPanner(); pan.pan.value = Math.random() * 1.4 - .7;
        gain.connect(pan).connect(this.ambient);
        const source = this.source(buffer, gain); source.playbackRate.value = .95 + Math.random() * .1;
        source.start(); this.gullUntil = now + buffer.duration / source.playbackRate.value;
        source.addEventListener('ended', () => { gain.disconnect(); pan.disconnect(); });
      }).catch(() => { /* A missing call sample does not interrupt the shore bed. */ });
    }
  }
  async bell() {
    const now = this.context.currentTime;
    if (now - this.lastBell < .65 || this.disposed) return false;
    this.lastBell = now;
    await this.context.resume();
    const buffer = await this.load('bell');
    if (this.disposed) return false;
    const gain = this.context.createGain();
    gain.gain.value = .75 * Math.max(.25, proximity(coastalSoundScene.listener, [-10, .8, -57.4], 12));
    gain.connect(this.master);
    const source = this.source(buffer, gain); source.start();
    source.addEventListener('ended', () => gain.disconnect()); this.bellCount++;
    return true;
  }
  technology(event: TechnologySoundEvent) {
    // No implicit permission: contextual sounds only run after this audio context is started.
    const now = this.context.currentTime;
    if (this.disposed || this.context.state !== 'running' || now - this.lastTechnology < .18) return;
    const distanceGain = proximity(coastalSoundScene.listener, event.position, 8);
    if (distanceGain < .02) return;
    this.lastTechnology = now;
    const gain = this.context.createGain(), pan = this.context.createStereoPanner();
    const oscillator = this.context.createOscillator();
    const duration = event.kind === 'servo' ? .48 : event.kind === 'hover' ? .1 : .26;
    const frequency = event.kind === 'arrival' ? 740 : event.kind === 'servo' ? 120 : 480;
    oscillator.type = event.kind === 'servo' ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * (event.kind === 'arrival' ? 1.33 : .72), now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(distanceGain * (event.kind === 'hover' ? .035 : .075), now + .015);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    pan.pan.value = Math.max(-.75, Math.min(.75, (event.position[0] - coastalSoundScene.listener[0]) / 20));
    oscillator.connect(gain).connect(pan).connect(this.master);
    const cleanup = () => { this.technologyVoices.delete(oscillator); oscillator.onended = null; oscillator.disconnect(); gain.disconnect(); pan.disconnect(); };
    this.technologyVoices.set(oscillator, cleanup);
    oscillator.onended = cleanup;
    oscillator.start(now); oscillator.stop(now + duration + .02);
  }
  dispose() {
    this.disposed = true; this.running = false; clearInterval(this.timer);
    for (const source of this.sources) { try { source.stop(); } catch {} source.disconnect(); }
    this.sources.clear();
    for (const [oscillator, cleanup] of this.technologyVoices) { try { oscillator.stop(); } catch {} cleanup(); }
    void this.context.close();
  }
}

export const TECHNOLOGY_SOUND_EVENT = 'portfolio:technology-sound';
export type TechnologySound = 'activate' | 'hover' | 'arrival' | 'servo';
export interface TechnologySoundEvent { kind: TechnologySound; position: readonly number[] }
export function emitTechnologySound(kind: TechnologySound, position: readonly number[]) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<TechnologySoundEvent>(TECHNOLOGY_SOUND_EVENT, { detail: { kind, position } }));
}
