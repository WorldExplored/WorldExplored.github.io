'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { profile } from '@/content/profile';
import { readAudioPreferences, AUDIO_PREFERENCES_KEY } from './audioPlaylist';
import { loadYouTubePlayer, type YouTubePlayer } from './youtubePlayer';
import type { WorldMusicHandle } from './WorldMusic';

type MusicState = 'preparing' | 'ready' | 'loading' | 'playing' | 'paused' | 'blocked' | 'unavailable';

/** One retained player is prepared before entry; only the entry gesture requests sound. */
export function YouTubeMusic({ ref }: { ref?: Ref<WorldMusicHandle> }) {
  const host = useRef<HTMLDivElement>(null), player = useRef<YouTubePlayer | null>(null);
  const ready = useRef(false), requested = useRef(false), selected = useRef(0);
  const volume = useRef(25);
  const [level, setLevel] = useState(25), [index, setIndex] = useState(0);
  const [state, setState] = useState<MusicState>('preparing'), [attempt, setAttempt] = useState(0);
  const [elapsed, setElapsed] = useState(0), [errorCode, setErrorCode] = useState<number | null>(null);
  function start() {
    requested.current = true; setErrorCode(null);
    if (state === 'unavailable') { setState('preparing'); setAttempt(value => value + 1); return; }
    setState('loading');
    if (ready.current) { player.current?.unMute(); player.current?.setVolume(volume.current); player.current?.playVideo(); }
  }
  function pause() { requested.current = false; player.current?.pauseVideo(); setState('paused'); }
  useImperativeHandle(ref, () => ({ play: start }));
  useEffect(() => {
    let disposed = false, instance: YouTubePlayer | undefined;
    ready.current = false;
    try { volume.current = readAudioPreferences(localStorage).volume * 100; } catch { volume.current = 25; }
    // Preparation does not play media. A pending entry request survives a slow API download.
    const timeout = setTimeout(() => { if (!disposed && !ready.current) setState('unavailable'); }, 20000);
    void loadYouTubePlayer().then(api => {
      if (disposed || !host.current) return;
      const mount = document.createElement('div'); host.current.appendChild(mount);
      instance = new api.Player(mount, {
        width: 246, height: 200, host: 'https://www.youtube.com', videoId: profile.soundtrack.tracks[selected.current].videoId,
        playerVars: { playsinline: 1, controls: 1, rel: 0, autoplay: 0, origin: location.origin },
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            clearTimeout(timeout); ready.current = true; player.current = target;
            target.setVolume(volume.current); setLevel(volume.current);
            if (requested.current) { target.unMute(); target.playVideo(); setState('loading'); }
            else setState('ready');
          },
          onStateChange: ({ data }) => {
            if (disposed) return;
            if (data === 1) {
              if (!requested.current && !host.current?.closest('details')?.open) { instance?.pauseVideo(); return; }
              requested.current = true;
              setState('playing');
            } else if (data === 2) setState('paused');
            else if (data === 3 && requested.current) setState('loading');
            else if (data === 0 && requested.current) {
              selected.current = (selected.current + 1) % profile.soundtrack.tracks.length;
              setIndex(selected.current); instance?.loadVideoById(profile.soundtrack.tracks[selected.current].videoId);
            }
          },
          onAutoplayBlocked: () => { if (!disposed) setState('blocked'); },
          onError: ({ data }) => { clearTimeout(timeout); if (!disposed) { setErrorCode(data); setState('unavailable'); } },
        },
      });
      player.current = instance;
      const iframe = instance.getIframe();
      iframe.title = profile.soundtrack.player;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
    }).catch(() => { clearTimeout(timeout); if (!disposed) setState('unavailable'); });
    const progress = setInterval(() => { if (ready.current && requested.current) setElapsed(Math.floor(player.current?.getCurrentTime() ?? 0)); }, 1000);
    // Keep the listening intent across tab changes and collapsed settings.
    return () => { disposed = true; clearTimeout(timeout); clearInterval(progress); instance?.destroy(); player.current = null; ready.current = false; };
  }, [attempt]);
  const active = state === 'playing' || state === 'loading';
  return <div className="sound-music" role="group" aria-label={profile.soundtrack.settings} data-music-state={state} data-music-seconds={elapsed} data-music-error={errorCode ?? undefined}>
    <label className="sound-setting"><span>{profile.soundtrack.settings}</span><input type="checkbox" aria-label={profile.soundtrack.settings} checked={active} onChange={event => event.target.checked ? start() : pause()} /></label>
    <label className="ambience-control__volume"><span>{profile.soundtrack.volume}</span><input aria-label={profile.soundtrack.volume} type="range" min="0" max="100" step="1" value={level} onChange={event => {
      const value = Number(event.target.value); volume.current = value; setLevel(value); player.current?.setVolume(value);
      try { localStorage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify({ volume: value / 100, muted: false })); } catch {}
    }} /></label>
    <label className="sound-track">{profile.soundtrack.track}<select aria-label={profile.soundtrack.track} value={index} onChange={event => {
      selected.current = Number(event.target.value); setIndex(selected.current); requested.current = true;
      if (ready.current) { player.current?.unMute(); player.current?.loadVideoById(profile.soundtrack.tracks[selected.current].videoId); setState('loading'); } else start();
    }}>{profile.soundtrack.tracks.map((track, i) => <option value={i} key={track.videoId}>{track.title} · {track.artist}</option>)}</select></label>
    <div ref={host} className="sound-music__player" />
    <span className="sound-track" role="status">{profile.soundtrack.states[state]}</span>
    {(state === 'blocked' || state === 'unavailable') && <button type="button" className="audio-control__button" onClick={start}>{profile.soundtrack.retry}</button>}
  </div>;
}
