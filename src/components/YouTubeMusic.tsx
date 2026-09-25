'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { profile } from '@/content/profile';
import { readAudioPreferences, AUDIO_PREFERENCES_KEY } from './audioPlaylist';
import { loadYouTubePlayer, type YouTubePlayer } from './youtubePlayer';
import type { WorldMusicHandle } from './WorldMusic';
import { YouTubeTransport, type MusicState } from './youtubeTransport';


/** One retained player is prepared before entry; only the entry gesture requests sound. */
export function YouTubeMusic({ ref }: { ref?: Ref<WorldMusicHandle> }) {
  const host = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const ready = useRef(false), selected = useRef(0), transport = useRef<YouTubeTransport | null>(null);
  const volume = useRef(25), retryRequested = useRef(false);
  const [level, setLevel] = useState(25), [index, setIndex] = useState(0);
  const [state, setState] = useState<MusicState>('preparing'), [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0), [errorCode, setErrorCode] = useState<number | null>(null);
  function controller() {
    if (!transport.current) transport.current = new YouTubeTransport({
      videos: profile.soundtrack.tracks.map(track => track.videoId), now: () => Date.now(),
      settingsOpen: () => host.current?.closest('[data-settings-open]')?.getAttribute('data-settings-open') === 'true' && document.activeElement === host.current?.querySelector('iframe'),
      changed: (next, track, error) => { selected.current = track; setIndex(track); setState(next); setErrorCode(error ?? null); },
    });
    return transport.current;
  }
  function start() {
    controller().start();
    if (state === 'unavailable' && !ready.current) { retryRequested.current = true; setState('preparing'); setAttempt(value => value + 1); }
  }
  function pause() { controller().pause(); }
  useImperativeHandle(ref, () => ({ play: start }));
  useEffect(() => {
    let disposed = false, instance: YouTubePlayer | undefined;
    ready.current = false;
    try { volume.current = readAudioPreferences(localStorage).volume * 100; } catch { volume.current = 25; }
    // Preparation does not play media. A pending entry request survives a slow API download.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const iframe = document.createElement('iframe');
    iframe.width = '246'; iframe.height = '200'; iframe.loading = 'eager';
    iframe.title = profile.soundtrack.player;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    const source = new URL(`https://www.youtube.com/embed/${profile.soundtrack.tracks[selected.current].videoId}`);
    source.search = new URLSearchParams({ playsinline: '1', controls: '1', rel: '0', autoplay: '0', enablejsapi: '1', origin: location.origin }).toString();
    iframe.src = source.href;
    host.current?.appendChild(iframe);
    void loadYouTubePlayer().then(api => {
      if (disposed || !host.current) return;
      timeout = setTimeout(() => { if (!disposed && !ready.current) controller().onError(); }, 20000);
      instance = new api.Player(iframe, {
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            clearTimeout(timeout); ready.current = true; player.current = target;
            setLevel(volume.current); controller().setVolume(volume.current);
            if (retryRequested.current) { retryRequested.current = false; controller().start(); }
            controller().ready(target);
          },
          onStateChange: ({ data }) => { if (!disposed) controller().onState(data); },
          onAutoplayBlocked: () => { if (!disposed) controller().onBlocked(); },
          onError: ({ data }) => { clearTimeout(timeout); if (!disposed) controller().onError(data); },
        },
      });
      player.current = instance;

    }).catch(() => { clearTimeout(timeout); if (!disposed) controller().onError(); });
    const check = () => { if (ready.current) { controller().tick(); setElapsed(Math.floor(player.current?.getCurrentTime() ?? 0)); } };
    const progress = setInterval(check, 1000);
    const returnToPage = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', returnToPage);
    window.addEventListener('online', check);
    window.addEventListener('pageshow', check);
    return () => {
      disposed = true; clearTimeout(timeout); clearInterval(progress);
      document.removeEventListener('visibilitychange', returnToPage); window.removeEventListener('online', check); window.removeEventListener('pageshow', check);
      transport.current?.dispose(); transport.current = null; instance?.destroy(); iframe.remove(); player.current = null; ready.current = false;
    };
  }, [attempt]);
  const active = state === 'playing' || state === 'loading';
  return <div className="sound-music" role="group" aria-label={profile.soundtrack.settings} data-music-state={state} data-music-seconds={elapsed} data-music-error={errorCode ?? undefined}>
    <label className="sound-setting"><span>{profile.soundtrack.settings}</span><input type="checkbox" aria-label={profile.soundtrack.settings} checked={active} onChange={event => event.target.checked ? start() : pause()} /></label>
    <label className="ambience-control__volume"><span>{profile.soundtrack.volume}</span><input aria-label={profile.soundtrack.volume} type="range" min="0" max="100" step="1" value={level} onChange={event => {
      const value = Number(event.target.value); volume.current = value; setLevel(value); controller().setVolume(value);
      try { localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume: value / 100, muted: false })); } catch {}
    }} /></label>
    <label className="sound-track">{profile.soundtrack.track}<select aria-label={profile.soundtrack.track} value={index} onChange={event => {
      controller().select(Number(event.target.value));
    }}>{profile.soundtrack.tracks.map((track, i) => <option value={i} key={track.videoId}>{track.title} · {track.artist}</option>)}</select></label>
    <div ref={host} className="sound-music__player" />
    <span className="sound-track" role="status">{profile.soundtrack.states[state]}</span>
    {(state === 'blocked' || state === 'unavailable') && <button type="button" className="audio-control__button" onClick={start}>{profile.soundtrack.retry}</button>}
  </div>;
}
