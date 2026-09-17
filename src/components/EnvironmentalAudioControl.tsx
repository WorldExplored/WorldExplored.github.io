'use client';

import { useEffect, useRef, useState } from 'react';
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

export function EnvironmentalAudioControl() {
  const engine = useRef<CoastalAudio | null>(null);
  const [active, setActive] = useState(false), [started, setStarted] = useState(false), [loading, setLoading] = useState(false);
  const [error, setError] = useState(''), [bellCount, setBellCount] = useState(0);
  const [preferences, setPreferences] = useState(readPreferences);
  const latest = useRef(preferences);
  useEffect(() => { latest.current = preferences; }, [preferences]);
  useEffect(() => {
    const bell = () => {
      engine.current ??= new CoastalAudio(latest.current); setStarted(true);
      void engine.current.bell().then(struck => { if (struck) setBellCount(value => value + 1); }).catch(() => setError('Bell audio unavailable. Try again.'));
    };
    const unsubscribeTechnology = subscribeToTechnologySounds(window, () => engine.current);
    window.addEventListener(COASTAL_BELL_EVENT, bell);
    return () => { unsubscribeTechnology(); window.removeEventListener(COASTAL_BELL_EVENT, bell); engine.current?.dispose(); };
  }, []);
  const persist = (next: CoastalAudioPreferences) => {
    setPreferences(next); try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch {}
    engine.current?.setPreferences(next);
  };
  const toggle = async () => {
    if (loading) return;
    if (active) { engine.current?.pause(); setActive(false); return; }
    setLoading(true); setError('');
    try { engine.current ??= new CoastalAudio(preferences); setStarted(true); await engine.current.start(); setActive(true); }
    catch { setError('Coastal audio unavailable. Try again.'); }
    finally { setLoading(false); }
  };
  return <div className="ambience-control" role="group" aria-label="Environmental ambience" data-audio-state={active ? 'playing' : started ? 'ready' : 'unstarted'} data-bell-strikes={bellCount}>
    <button type="button" className="audio-control__button" onClick={toggle} aria-pressed={active} disabled={loading}><span aria-hidden="true">≈</span><span>{loading ? 'Loading coast…' : active ? 'Pause ambience' : 'Start ambience'}</span></button>
    {started && <><button type="button" className="audio-control__button audio-control__button--square" aria-label={preferences.muted ? 'Unmute ambience' : 'Mute ambience'} aria-pressed={preferences.muted} onClick={() => persist({ ...preferences, muted: !preferences.muted })}>{preferences.muted ? '×' : '◖'}</button><label className="ambience-control__volume"><span>Ambience volume</span><input aria-label="Ambience volume" type="range" min="0" max="1" step="0.01" value={preferences.volume} onChange={event => persist({ ...preferences, volume: Number(event.target.value) })} /></label><a className="audio-control__button" href="/audio/coast/credits.html" target="_blank" rel="noreferrer" aria-label="Coastal sound credits">ⓘ</a></>}
    {error && <span role="status">{error}</span>}
  </div>;
}
