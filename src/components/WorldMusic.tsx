'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { profile } from '@/content/profile';
import { loadYouTubePlayer, type YouTubePlayer } from './youtubePlayer';

export interface WorldMusicHandle { play: () => void }
export function WorldMusic({ onClose, ref, autoStart = false }: { onClose: () => void; ref?: Ref<WorldMusicHandle>; autoStart?: boolean }) {
  const playerRef = useRef<YouTubePlayer | null>(null);
  const requested = useRef(autoStart);
  useImperativeHandle(ref, () => ({ play() { requested.current = true; playerRef.current?.playVideo(); } }));
  const host = useRef<HTMLDivElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState(profile.soundtrack.loading);
  useEffect(() => {
    let disposed = false;
    let player: YouTubePlayer | undefined;
    const timeout = setTimeout(() => { if (!disposed) { player?.destroy(); player = undefined; playerRef.current = null; setStatus(profile.soundtrack.unavailable); disposed = true; } }, 20000);
    const hide = () => { if (document.hidden) player?.pauseVideo(); };
    document.addEventListener('visibilitychange', hide);
    void loadYouTubePlayer().then(api => {
      if (disposed || !host.current) return;
      const mount = document.createElement('div'); host.current.appendChild(mount);
      player = new api.Player(mount, {
        width: 300, height: 200, videoId: profile.soundtrack.tracks[0].videoId, host: 'https://www.youtube.com',
        playerVars: { playsinline: 1, controls: 1, rel: 0, origin: location.origin, playlist: profile.soundtrack.tracks.map(track => track.videoId).join(','), loop: 1 },
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            clearTimeout(timeout);
            target.getIframe().title = profile.soundtrack.label;
            target.setVolume(22); target.setLoop(true);
            if (requested.current && !document.hidden) target.playVideo();
            setStatus(profile.soundtrack.ready);
          },
          onStateChange: ({ data }) => { if (!disposed) setStatus(data === 1 ? profile.soundtrack.playing : profile.soundtrack.ready); },
          onAutoplayBlocked: () => { if (!disposed) setStatus(profile.soundtrack.blocked); },
          onError: () => { clearTimeout(timeout); if (!disposed) setStatus(profile.soundtrack.unavailable); },
        },
      });
      playerRef.current = player;
      player.getIframe().referrerPolicy = 'strict-origin-when-cross-origin';
      player.getIframe().title = profile.soundtrack.label;
    }).catch(() => { clearTimeout(timeout); if (!disposed) setStatus(profile.soundtrack.unavailable); });
    return () => { disposed = true; clearTimeout(timeout); document.removeEventListener('visibilitychange', hide); player?.destroy(); playerRef.current = null; };
  }, [attempt]);
  return <aside className="world-music" aria-label={profile.soundtrack.label}>
    <div className="world-music__bar"><span>♫ {profile.soundtrack.label}</span><button type="button" aria-label={profile.soundtrack.close} onClick={onClose}>×</button></div>
    <div ref={host} className="world-music__video" hidden={status === profile.soundtrack.unavailable} />
    <div className="world-music__foot"><span role="status">{status}</span><a href={profile.soundtrack.reference} target="_blank" rel="noreferrer">{profile.soundtrack.source}</a></div>
    {status === profile.soundtrack.unavailable && <div className="world-music__links"><button className="audio-control__button" onClick={() => { requested.current = true; setStatus(profile.soundtrack.loading); setAttempt(value => value + 1); }}>Retry music</button>{profile.soundtrack.tracks.map(track => <a key={track.videoId} href={`https://www.youtube.com/watch?v=${track.videoId}`} target="_blank" rel="noreferrer">{track.title} · {track.artist}</a>)}</div>}
  </aside>;
}
