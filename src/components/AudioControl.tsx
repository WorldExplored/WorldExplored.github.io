'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { audio, isApprovedAudioSource, playbackStateFromYouTube, youtubeEmbedUrl, type AudioPlaybackState, type YouTubeAudioSource } from '@/content/audio';

interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getPlayerState: () => number;
  destroy: () => void;
}
interface YouTubeApi {
  Player: new (element: HTMLIFrameElement, options: {
    events: {
      onReady: (event: { target: YouTubePlayer }) => void;
      onStateChange: (event: { data: number }) => void;
      onError: () => void;
      onAutoplayBlocked: () => void;
    };
  }) => YouTubePlayer;
}
type YouTubeWindow = Window & { YT?: YouTubeApi; onYouTubeIframeAPIReady?: () => void };
let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi() {
  const host = window as YouTubeWindow;
  if (host.YT?.Player) return Promise.resolve(host.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const previousReady = host.onYouTubeIframeAPIReady;
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      host.onYouTubeIframeAPIReady = previousReady;
      script.remove();
      reject(new Error('The music player could not be loaded.'));
    };
    const timeout = window.setTimeout(fail, 15000);
    host.onYouTubeIframeAPIReady = () => {
      clearTimeout(timeout);
      host.onYouTubeIframeAPIReady = previousReady;
      if (host.YT?.Player) resolve(host.YT); else fail();
      previousReady?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = fail;
    document.head.append(script);
  });
  void apiPromise.catch(() => { apiPromise = null; });
  return apiPromise;
}

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

function ActiveAudio({ source, onClose }: { source: YouTubeAudioSource; onClose: () => void }) {
  const iframe = useRef<HTMLIFrameElement>(null);
  const playControl = useRef<HTMLButtonElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const player = useRef<YouTubePlayer | null>(null);
  const ready = useRef(false);
  const visible = useRef(true);
  const [state, setState] = useState<AudioPlaybackState>('loading');
  const [muted, setMuted] = useState(false);
  const regionId = useId();
  const embedUrl = youtubeEmbedUrl(source.videoId, window.location.origin);

  useEffect(() => {
    playControl.current?.focus();
    let cancelled = false;
    let instance: YouTubePlayer | null = null;
    const pause = () => {
      if (ready.current && instance) instance.pauseVideo();
    };
    const handleVisibility = () => { if (document.hidden) pause(); };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
      visible.current = Boolean(entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.5);
      if (!visible.current) pause();
    }, { threshold: 0.5 });
    if (surface.current) observer?.observe(surface.current);
    document.addEventListener('visibilitychange', handleVisibility);

    void loadYouTubeApi().then(api => {
      if (cancelled || !iframe.current) return;
      instance = new api.Player(iframe.current, { events: {
        onReady: event => {
          if (cancelled) return;
          ready.current = true;
          player.current = event.target;
          event.target.setVolume(25);
          setState('ready');
          if (!document.hidden && visible.current) event.target.playVideo();
        },
        onStateChange: event => {
          if (cancelled) return;
          if (event.data === 1 && (document.hidden || !visible.current)) pause();
          setState(playbackStateFromYouTube(event.data));
        },
        onError: () => { if (!cancelled) setState('unavailable'); },
        onAutoplayBlocked: () => { if (!cancelled) setState('ready'); },
      } });
    }).catch(() => { if (!cancelled) setState('unavailable'); });

    // Keep the compact control aligned with changes made in YouTube's visible controls.
    const poll = window.setInterval(() => {
      if (!ready.current || !instance || document.hidden) return;
      setMuted(instance.isMuted());
      setState(current => current === 'unavailable' ? current : playbackStateFromYouTube(instance!.getPlayerState()));
    }, 1000);
    return () => {
      cancelled = true;
      ready.current = false;
      player.current = null;
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', handleVisibility);
      observer?.disconnect();
      instance?.destroy();
    };
  }, [source.videoId]);

  const playing = state === 'playing' || state === 'buffering';
  const unavailable = state === 'loading' || state === 'unavailable';
  return <div className="audio-control__active" onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
  }}>
    <div className="audio-control__buttons">
      <button ref={playControl} type="button" className="audio-control__button" aria-disabled={unavailable} aria-controls={regionId} onClick={() => {
        if (unavailable) return;
        if (playing) player.current?.pauseVideo(); else player.current?.playVideo();
      }}><AudioIcon kind={playing ? 'pause' : 'play'} /><span>{playing ? audio.ui.pause : audio.ui.play}</span></button>
      <button type="button" className="audio-control__button audio-control__button--square" disabled={unavailable} aria-label={muted ? audio.ui.unmute : audio.ui.mute} title={muted ? audio.ui.unmute : audio.ui.mute} onClick={() => {
        if (!player.current) return;
        if (player.current.isMuted()) player.current.unMute(); else player.current.mute();
        setMuted(player.current.isMuted());
      }}><AudioIcon kind={muted ? 'muted' : 'sound'} /></button>
      <button type="button" className="audio-control__button audio-control__button--square" aria-label={audio.ui.close} title={audio.ui.close} onClick={onClose}><AudioIcon kind="close" /></button>
    </div>
    <div ref={surface} id={regionId} className="audio-control__surface" role="region" aria-label={audio.ui.player}>
      <div className="audio-control__status" role="status" aria-live="polite">{audio.labels[state]}{muted ? ` · ${audio.ui.muted}` : ''}</div>
      <iframe ref={iframe} className="audio-control__frame" title={`${source.title} ${audio.ui.by} ${source.creator}`} src={embedUrl} width="304" height="200" allow="autoplay; encrypted-media" referrerPolicy="strict-origin-when-cross-origin" />
      <p className="audio-control__credit"><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.title}</a> {audio.ui.by} <a href={source.creatorUrl} target="_blank" rel="noopener noreferrer">{source.creator}</a> · <a href={source.license.url} target="_blank" rel="noopener noreferrer">{source.license.label}</a></p>
    </div>
  </div>;
}

export function AudioControl({ source = audio.source, className = '' }: { source?: YouTubeAudioSource | null; className?: string }) {
  const [activatedId, setActivatedId] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!isApprovedAudioSource(source)) return null;
  const active = activatedId === source.videoId;
  return <div className={`audio-control ${className}`} role="group" aria-label={audio.ui.label} data-audio-active={active}>
    {active ? <ActiveAudio key={source.videoId} source={source} onClose={() => {
      setActivatedId(null);
      requestAnimationFrame(() => trigger.current?.focus());
    }} /> : <button ref={trigger} type="button" className="audio-control__button" onClick={() => setActivatedId(source.videoId)}><AudioIcon kind="play" /><span>{audio.ui.play}</span></button>}
  </div>;
}
