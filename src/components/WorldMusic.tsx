'use client';

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { profile, type BackgroundMusicTrack } from '@/content/profile';
import { AudioPlaylist, type PlaylistSnapshot } from './audioPlaylist';

export interface WorldMusicHandle { play: () => void }
/** Direct audio uses the existing playlist transport without placing a video over the world. */
export function WorldMusic({ ref, tracks = profile.soundtrack.audioTracks }: { ref?: Ref<WorldMusicHandle>; tracks?: readonly BackgroundMusicTrack[] }) {
  const controller = useRef<AudioPlaylist | null>(null);
  const [snapshot, setSnapshot] = useState<PlaylistSnapshot>({ active: false, state: 'ready', index: 0, volume: .25, muted: false });
  function play() {
    if (!tracks.length) return;
    if (!controller.current) {
      const media = new Audio(); media.preload = 'none';
      let storage: Storage | undefined;
      try { storage = window.localStorage; } catch {}
      controller.current = new AudioPlaylist(media, tracks, setSnapshot, { storage, random: () => .999, reducedMotion: () => window.matchMedia('(prefers-reduced-motion: reduce)').matches });
    }
    controller.current.setPreferences({ muted: false });
    controller.current.play();
  }
  useImperativeHandle(ref, () => ({ play }));
  useEffect(() => {
    function hide() { if (document.hidden) controller.current?.pause(); }
    document.addEventListener('visibilitychange', hide);
    return () => { document.removeEventListener('visibilitychange', hide); controller.current?.dispose(); controller.current = null; };
  }, [tracks]);
  const playing = snapshot.active && ['playing', 'loading', 'buffering'].includes(snapshot.state);
  return <div className="sound-music" role="group" aria-label={profile.soundtrack.settings}>
    {tracks.length > 0 ? <>
      <label className="sound-setting"><span>{profile.soundtrack.settings}</span><input type="checkbox" aria-label={profile.soundtrack.settings} checked={playing} onChange={event => event.target.checked ? play() : controller.current?.pause()} /></label>
      <label className="ambience-control__volume"><span>{profile.soundtrack.volume}</span><input aria-label={profile.soundtrack.volume} type="range" min="0" max="1" step="0.01" value={snapshot.volume} onChange={event => controller.current?.setPreferences({ volume: Number(event.target.value) })} /></label>
      {snapshot.active && <span className="sound-track" role="status">{tracks[snapshot.index].title}{snapshot.state === 'unavailable' ? ` · ${profile.soundtrack.trackUnavailable}` : ''}</span>}
    </> : <>
      <span className="sound-track">{profile.soundtrack.external}</span>
      {profile.soundtrack.tracks.map(track => <a key={track.videoId} href={`https://www.youtube.com/watch?v=${track.videoId}`} target="_blank" rel="noreferrer">{track.title} · {track.artist}</a>)}
    </>}
  </div>;
}
