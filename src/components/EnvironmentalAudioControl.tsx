'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref, type ReactNode } from 'react';
import { profile } from '@/content/profile';
import { CoastalAudio, COASTAL_BELL_EVENT, TECHNOLOGY_SOUND_EVENT, type TechnologySoundEvent, type CoastalAudioPreferences } from './world/coastalAudio';

const STORAGE = 'portfolio-ambience-v1';
function readPreferences(): CoastalAudioPreferences {
  try {
    const saved = typeof window === 'undefined' ? null : localStorage.getItem(STORAGE);
    if (saved) { const value = JSON.parse(saved), volume = Number(value.volume); return { volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : .34, muted: value.muted === true }; }
  } catch {}
  return { volume: .34, muted: false };
}
/** The subscription only reads an existing gesture-created engine. */
export function subscribeToTechnologySounds(target: EventTarget, currentEngine: () => CoastalAudio | null) {
  const listener = (event: Event) => currentEngine()?.technology((event as CustomEvent<TechnologySoundEvent>).detail);
  target.addEventListener(TECHNOLOGY_SOUND_EVENT, listener);
  return () => target.removeEventListener(TECHNOLOGY_SOUND_EVENT, listener);
}

export interface EnvironmentalAudioHandle { start: () => Promise<void> }
export function EnvironmentalAudioControl({ ref, visible = true, children }: { ref?: Ref<EnvironmentalAudioHandle>; visible?: boolean; children?: ReactNode }) {
  const engine = useRef<CoastalAudio | null>(null);
  const [active, setActive] = useState(false), [started, setStarted] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [bellCount, setBellCount] = useState(0);
  const [preferences, setPreferences] = useState(readPreferences);
  const latest = useRef(preferences);
  useEffect(() => { latest.current = preferences; }, [preferences]);
  useEffect(() => {
    const bell = () => {
      engine.current ??= new CoastalAudio(latest.current); setStarted(true);
      void engine.current.bell().then(struck => { if (struck) setBellCount(value => value + 1); }).catch(() => setError(profile.soundSettings.bellUnavailable));
    };
    const unsubscribeTechnology = subscribeToTechnologySounds(window, () => engine.current);
    window.addEventListener(COASTAL_BELL_EVENT, bell);
    return () => { unsubscribeTechnology(); window.removeEventListener(COASTAL_BELL_EVENT, bell); engine.current?.dispose(); engine.current = null; };
  }, []);
  const persist = (next: CoastalAudioPreferences) => {
    latest.current = next; setPreferences(next); try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch {}
    engine.current?.setPreferences(next);
  };
  const start = async () => {
    if (loading) return;
    if (latest.current.muted) persist({ ...latest.current, muted: false });
    if (active) return;
    setLoading(true); setError('');
    try { engine.current ??= new CoastalAudio(latest.current); setStarted(true); await engine.current.start(); setActive(true); }
    catch { setError(profile.soundSettings.unavailable); }
    finally { setLoading(false); }
  };
  useImperativeHandle(ref, () => ({ start }));
  return <details hidden={!visible} className="ambience-control ambience-settings" role="group" aria-label={profile.soundSettings.group} data-audio-state={active ? 'playing' : started ? 'ready' : 'unstarted'} data-bell-strikes={bellCount}>
    <summary className="audio-control__button">◖ {profile.soundSettings.label}</summary>
    <div className="ambience-settings__panel">
    <label className="sound-setting"><span>{profile.soundSettings.ambience}</span><input type="checkbox" aria-label={profile.soundSettings.ambience} checked={active && !preferences.muted} disabled={loading} onChange={event => { const enabled = event.target.checked; persist({ ...preferences, muted: !enabled }); if (enabled) void start(); }} /></label>
    {started && <><label className="ambience-control__volume"><span>{profile.soundSettings.volume}</span><input aria-label={profile.soundSettings.volume} type="range" min="0" max="1" step="0.01" value={preferences.volume} onChange={event => persist({ ...preferences, volume: Number(event.target.value) })} /></label><a className="sound-credit" href="/audio/coast/credits.html" target="_blank" rel="noreferrer">{profile.soundSettings.credits}</a></>}
    {children}
    {error && <span role="status">{error}</span>}
    </div>
  </details>;
}
