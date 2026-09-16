'use client';

import { useEffect, useRef, useState } from 'react';
import { audio, isApprovedAudioSource, type LicensedAudioSource } from '@/content/audio';
import { AudioPlaylist, type PlaylistSnapshot } from './audioPlaylist';

function AudioIcon({ kind }: { kind: 'play' | 'pause' | 'sound' | 'muted' | 'close' | 'previous' | 'next' }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="currentColor">
    {kind === 'play' && <path d="M7 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5A1 1 0 0 1 7 19.5z" />}
    {kind === 'pause' && <path d="M6 4h4v16H6zm8 0h4v16h-4z" />}
    {(kind === 'sound' || kind === 'muted') && <path d="M3 9h4l6-5v16l-6-5H3z" />}
    {kind === 'sound' && <path d="M17 7c3 2 3 8 0 10m-2-7c1 1 1 3 0 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    {kind === 'muted' && <path d="m17 9 5 6m0-6-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    {(kind === 'previous' || kind === 'next') && <path d="M5 5h2v14H5zm14 0v14L8 12z" transform={kind === 'next' ? 'translate(24 0) scale(-1 1)' : undefined} />}
    {kind === 'close' && <path d="m6 6 12 12m0-12L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}

function MusicPlayer({ playlist, className }: { playlist: readonly LicensedAudioSource[]; className: string }) {
  const media = useRef<HTMLAudioElement>(null);
  const playControl = useRef<HTMLButtonElement>(null);
  const player = useRef<AudioPlaylist | null>(null);
  const [snapshot, setSnapshot] = useState<PlaylistSnapshot>({ active: false, state: 'ready', index: 0, volume: .25, muted: false });
  const { active, state, muted, volume } = snapshot;
  const source = playlist[snapshot.index];
  const playing = state === 'playing' || state === 'buffering' || state === 'loading';
  useEffect(() => {
    if (!media.current) return;
    let storage: Storage | undefined;
    try { storage = window.localStorage; } catch { /* Private browsing can restrict storage. */ }
    const controller = new AudioPlaylist(media.current, playlist, setSnapshot, { storage, reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    player.current = controller;
    function hide() { if (document.hidden && controller.snapshot.active) controller.pause(); }
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); controller.dispose(); player.current = null; };
  }, [playlist]);
  function close() { player.current?.close(); requestAnimationFrame(() => playControl.current?.focus()); }
  const playLabel = state === 'unavailable' ? audio.ui.retry : playing && active ? audio.ui.pause : audio.ui.play;
  return <div className={`audio-control ${className}`} role="group" aria-label={audio.ui.label} data-audio-active={active} onKeyDown={event => {
    if (active && event.key === 'Escape') { event.stopPropagation(); close(); }
  }}>
    <audio ref={media} preload="none" />
    <div className="audio-control__buttons">
      <button ref={playControl} type="button" className="audio-control__button" onClick={() => playing && active ? player.current?.pause() : player.current?.play()}><AudioIcon kind={playing && active ? 'pause' : 'play'} /><span>{playLabel}</span></button>
      {active && <>
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={muted ? audio.ui.unmute : audio.ui.mute} aria-pressed={muted} onClick={() => player.current?.setPreferences({ muted: !muted })}><AudioIcon kind={muted ? 'muted' : 'sound'} /></button>
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={audio.ui.close} onClick={close}><AudioIcon kind="close" /></button>
      </>}
    </div>
    {active && <div className="audio-control__surface" role="region" aria-label={audio.ui.player}>
      <div className="audio-control__status" role="status" aria-live="polite">{audio.labels[state]}{muted ? ` · ${audio.ui.muted}` : ''}</div>
      <p className="audio-control__title"><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.title}</a></p>
      <div className="audio-control__transport">
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={audio.ui.previous} disabled={state === 'unavailable'} onClick={() => player.current?.move(-1)}><AudioIcon kind="previous" /></button>
        <label className="audio-control__volume"><span>{audio.ui.volume}</span><input type="range" min="0" max="1" step="0.01" value={volume} aria-label={audio.ui.volume} onChange={event => player.current?.setPreferences({ volume: Number(event.target.value) })} /></label>
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={audio.ui.next} disabled={state === 'unavailable'} onClick={() => player.current?.move(1)}><AudioIcon kind="next" /></button>
      </div>
      <p className="audio-control__credit">{audio.ui.by} <a href={source.creatorUrl} target="_blank" rel="noopener noreferrer">{source.creator}</a> · <a href={source.license.url} target="_blank" rel="noopener noreferrer">{source.license.label}</a></p>
      {state === 'unavailable' && <p className="audio-control__failure">{audio.ui.retryHint}</p>}
    </div>}
  </div>;
}

export function AudioControl({ playlist = audio.playlist, className = '' }: { playlist?: readonly LicensedAudioSource[] | null; className?: string }) {
  return playlist?.length && playlist.every(isApprovedAudioSource) ? <MusicPlayer playlist={playlist} className={className} /> : null;
}
