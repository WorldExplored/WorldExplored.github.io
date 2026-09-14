'use client';

import { useEffect, useRef, useState } from 'react';
import { audio, isApprovedAudioSource, type AudioPlaybackState, type LicensedAudioSource } from '@/content/audio';

function AudioIcon({ kind }: { kind: 'play' | 'pause' | 'sound' | 'muted' | 'close' }) {
  return <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false" fill="currentColor">
    {kind === 'play' && <path d="M7 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5A1 1 0 0 1 7 19.5z" />}
    {kind === 'pause' && <path d="M6 4h4v16H6zm8 0h4v16h-4z" />}
    {(kind === 'sound' || kind === 'muted') && <path d="M3 9h4l6-5v16l-6-5H3z" />}
    {kind === 'sound' && <path d="M17 7c3 2 3 8 0 10m-2-7c1 1 1 3 0 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    {kind === 'muted' && <path d="m17 9 5 6m0-6-5 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    {kind === 'close' && <path d="m6 6 12 12m0-12L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
  </svg>;
}

function MusicPlayer({ source, className }: { source: LicensedAudioSource; className: string }) {
  const media = useRef<HTMLAudioElement>(null);
  const playControl = useRef<HTMLButtonElement>(null);
  const attempt = useRef(0);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(false);
  const [state, setState] = useState<AudioPlaybackState>('ready');
  const [muted, setMuted] = useState(false);
  const playing = state === 'playing' || state === 'buffering' || state === 'loading';

  function clearLoading() { if (timeout.current) clearTimeout(timeout.current); timeout.current = null; }
  useEffect(() => {
    const element = media.current;
    function hide() { if (document.hidden) element?.pause(); }
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      if (timeout.current) clearTimeout(timeout.current);
      element?.pause();
      element?.removeAttribute('src');
      element?.load();
    };
  }, []);

  function play() {
    const element = media.current;
    if (!element) return;
    const serial = ++attempt.current;
    clearLoading();
    if (!element.getAttribute('src')) { element.src = source.playbackUrl; element.volume = 0.25; }
    setActive(true);
    setState('loading');
    timeout.current = setTimeout(() => {
      attempt.current++;
      element.pause();
      setState('unavailable');
    }, 20000);
    void element.play().catch((error: unknown) => {
      if (attempt.current !== serial) return;
      clearLoading();
      setState(error instanceof DOMException && error.name === 'NotAllowedError' ? 'ready' : 'unavailable');
    });
  }
  function pause() { attempt.current++; clearLoading(); media.current?.pause(); setState('paused'); }
  function close() {
    attempt.current++;
    clearLoading();
    media.current?.pause();
    media.current?.removeAttribute('src');
    media.current?.load();
    setActive(false);
    setMuted(false);
    if (media.current) media.current.muted = false;
    setState('ready');
    requestAnimationFrame(() => playControl.current?.focus());
  }

  return <div className={`audio-control ${className}`} role="group" aria-label={audio.ui.label} data-audio-active={active} onKeyDown={event => {
    if (active && event.key === 'Escape') { event.stopPropagation(); close(); }
  }}>
    <audio ref={media} preload="none" onPlaying={() => { clearLoading(); setState('playing'); }} onPause={() => setState(current => current === 'unavailable' ? current : 'paused')} onWaiting={() => { if (active && !media.current?.paused) setState('buffering'); }} onEnded={() => { clearLoading(); setState('ended'); }} onError={() => { clearLoading(); setState('unavailable'); }} />
    <div className="audio-control__buttons">
      <button ref={playControl} type="button" className="audio-control__button" onClick={playing && active ? pause : play}><AudioIcon kind={playing && active ? 'pause' : 'play'} /><span>{playing && active ? audio.ui.pause : audio.ui.play}</span></button>
      {active && <>
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={muted ? audio.ui.unmute : audio.ui.mute} onClick={() => { if (media.current) { media.current.muted = !media.current.muted; setMuted(media.current.muted); } }}><AudioIcon kind={muted ? 'muted' : 'sound'} /></button>
        <button type="button" className="audio-control__button audio-control__button--square" aria-label={audio.ui.close} onClick={close}><AudioIcon kind="close" /></button>
      </>}
    </div>
    {active && <div className="audio-control__surface" role="region" aria-label={audio.ui.player}>
      <div className="audio-control__status" role="status" aria-live="polite">{audio.labels[state]}{muted ? ` · ${audio.ui.muted}` : ''}</div>
      <p className="audio-control__credit"><a href={source.license.evidenceUrl} target="_blank" rel="noopener noreferrer">{source.title}</a> {audio.ui.by} <a href={source.creatorUrl} target="_blank" rel="noopener noreferrer">{source.creator}</a> · <a href={source.license.url} target="_blank" rel="noopener noreferrer">{source.license.label}</a> · <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{audio.ui.youtube}</a></p>
    </div>}
  </div>;
}

export function AudioControl({ source = audio.source, className = '' }: { source?: LicensedAudioSource | null; className?: string }) {
  return isApprovedAudioSource(source) ? <MusicPlayer key={source.playbackUrl} source={source} className={className} /> : null;
}
